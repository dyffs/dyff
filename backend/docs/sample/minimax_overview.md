Diff Summary

Intent

This PR optimizes AML Studio's frontend object listing performance by introducing a dedicated database web worker (AmlDatabase) that indexes AML bindings, decorators, and
 diagnostics in-memory, plus a serialized cache mechanism to load pre-parsed AML state from LevelDB instead of re-parsing from scratch. It also fixes tag lookup
performance on the dev tree (#SRP-1101) by introducing a file-path-to-FQN mapping.

Two feature toggles gate the new behavior:
- aml_studio:fe_use_database_web_worker — routes object listing through the database worker
- aml_studio:fe_use_serialize_cache — initializes the AML parser from serialized cache

---
Change Threads

Thread 1: New AmlDatabase in-memory indexed store

- Origin: packages/aml-studio/aml/aml-2.0/amlDatabase/amlDatabase.ts (new file)
  - AmlDatabase class maintains bindingsDatabase, diagnosticsDatabase, decoratorsDatabase
  - Exposes bindings(), objects(), diagnostics(), decorators() with filter support
  - setRuntimeContext() / markStale() handle VFS updates
- Propagation: amlDatabase.worker.ts exposes bindings, objects, getObjectTagsWithFilePath, getTemplates actions; useDevAmlDatabaseWorker.ts (new composable) is the
client-facing interface

Thread 2: Serialized cache infrastructure (Ruby + TypeScript)

- Origin (Ruby): app/lib/serialized_cache.rb + app/lib/level_db/client.rb (new files)
  - SerializedCache wraps LevelDB with typed cache keys (CacheKeyByCommit, CacheKeyByBranchName)
  - New API endpoint GET /aml_studio/repositories/:id/serialized_cache streams cached JSON in 32KB chunks
- Propagation (TS): packages/aml-studio/aml/aml-2.0/serializedCache.ts (new file)
  - setParserBackendWithSerializedCache() action; setSerializeCacheToCacheStorageAction, deleteSerializeCacheFromCacheKeyAction
  - Imported by amlHolistics.worker.ts, amlDiagnostics.worker.ts, amlLanguageService.worker.ts, amlDatabase.worker.ts

Thread 3: Tag store file-path-to-FQN mapping (SRP-1101 fix)

- Origin: tagStore.ts — added objectFilePathToFqn: Map<string, string> reactive map
- Propagation:
  - TaggedObjectWrapper.vue — accepts currentObjectPath prop, resolves FQN via the map
  - useTag.ts — populates the map during fetchAllTags() when using database worker
  - DevTaggingService / ReportingTaggingService — fetchObjectTags() renamed to fetchObjectTagsWithFilePath() and returns { tags, filePathFqnMap }

Thread 4: Frontend FT-gated database worker usage

- Origin: useDevAmlDatabaseWorker.ts (new composable)
- Propagation (all gated by ftUseDatabaseWorker):
  - useContextResources.ts — fetches dev datasets via objects({ types: ['Dataset'] })
  - FetchDevDatasetService.getAllDatasetFQNs() — uses bindings({ filter: { types: ['Dataset'] } })
  - useDevDashboardDrillthroughs.ts — listCanvasDashboards() uses bindings()
  - useObjectTreeSelect.ts — fetchObjectsInfo() uses bindings()
  - useDashboardTemplates.ts — uses getTemplates() from database worker
  - holisticsWorkerUtil/dashboard.ts — listCanvasDashboards() is now async and uses database worker

Thread 5: API + OpenAPI spec additions

- GET /aml_studio/repositories/:id/serialized_cache added to routes
- H.projects in index.d.ts now includes project_repository_id
- OpenAPI spec: GetSerializedCache.yml (new), current.yml updated

---
Litmus Tests

Coverage — All five threads are captured:
- AmlDatabase + worker (main optimization)
- Serialized cache (backend + frontend)
- Tag perf fix (file-path mapping)
- FT-gated frontend code paths
- API additions + spec

Specificity — Reviewers can predict which areas changed:
- New files by name: amlDatabase.ts, amlDatabase.worker.ts, serializedCache.ts, serialized_cache.rb, level_db/client.rb, useDevAmlDatabaseWorker.ts,
GetSerializedCache.yml
- Modified areas: Tag system (TaggedObjectWrapper, tagStore, tagging services), Context resources, Dataset fetching, Dashboard/drillthrough/template operations
- Mechanism: Database worker as an in-memory indexed store; serialized cache as a LevelDB-backed parser initialization shortcut

