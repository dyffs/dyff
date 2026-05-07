Intent

This PR optimizes AML object listing performance in AML Studio's frontend by introducing two major mechanisms behind feature toggles:

1. A dedicated "database" web worker (aml_studio:fe_use_database_web_worker) that pre-indexes all AML bindings, diagnostics, and decorators once, then serves queries from
 an in-memory index — replacing the current pattern of calling the "holistics" worker's getAllFQNs action on every file change
(setSource/removeSource/batchSetSource/batchRemoveSource).
2. A serialized cache layer (aml_studio:fe_use_serialize_cache) backed by a new LevelDB-based backend service, allowing web workers to bootstrap from a pre-compiled AML
parse cache fetched via a new streaming API endpoint, rather than parsing all files from scratch on page load.

Together, these eliminate repeated full-project scans for FQN lookups, tag resolution, template listing, object duplication, dashboard drillthroughs, and diagnostics —
all of which previously went through the single "holistics" worker.

The PR also improves tag check performance in the development file tree by resolving tags via file path instead of FQN (avoiding an FQN lookup per tree node), and
refactors integration test specs into shared examples to run the same tests with and without the database worker.

---
Change Threads

Thread 1: AmlDatabase class and "database" web worker

- Origin: packages/aml-studio/aml/aml-2.0/amlDatabase/amlDatabase.ts — New AmlDatabase class that indexes all bindings, diagnostics, and decorators per file, then serves
filtered queries from the index.
- Propagation:
  - amlDatabase.worker.ts — New web worker module wrapping AmlDatabase with actions: bindings, objects, diagnostics, getObjectTagsWithFilePath, getTemplates, setSource,
removeSource.
  - amlDatabase.test.ts — Unit tests for AmlDatabase.
  - workerController.ts — Plugs the new database worker alongside holistics, restructures worker creation into createAMLWorkerControllerWithLanguageFeatures /
WithoutLanguageFeatures helpers.
  - useDevAmlDatabaseWorker.ts — New composable providing bindings(), objects(), getObjectTagsWithFilePath(), getTemplates() that call the database worker with proper
initialization awaits.
- Nature: New capability.

Thread 2: Feature-toggled call-site migration from "holistics" worker to "database" worker

- Origin: The aml_studio:fe_use_database_web_worker feature toggle checked at ~15 call sites.
- Propagation (all check the FT and branch between database and holistics worker calls):
  - holisticsWorkerUtil/object.ts — getFQNames, getAllFQNamesByTypes, getTemplates
  - holisticsWorkerUtil/dashboard.ts — listCanvasDashboards
  - fetchDevDatasetService.ts — getAllDatasetFQNs
  - useObjectTreeSelect.ts — fetchObjectsInfo
  - useAmlObjectDuplication.ts — duplicateObject
  - generateUnameObject.ts — unique FQN generation
  - useDashboardHelperFunctions.ts — fetchTemplates
  - useDashboardProjectSettings.ts — loadDashboardTemplates
  - useDevDashboardDrillthroughs.ts — loadAllDashboards
  - AmlNodeActions.ts — createDashboardThroughModal
  - useContextResources.ts — AI dev context resource fetching
  - editor/actions.ts — getAllDiagnostics (routes to database worker), removes getAllFQNs action entirely
- Nature: Interface change / migration — same data, different worker source.

Thread 3: Serialized cache backend (Rails + LevelDB)

- Origin: app/lib/level_db/client.rb — New LevelDB HTTP client, app/lib/serialized_cache.rb — Cache key abstractions (CacheKeyByCommit, CacheKeyByBranchName) wrapping
LevelDB.
- Propagation:
  - repositories_controller.rb — New get_serialized_cache action that streams cached data in 32KB chunks.
  - config/routes.rb — Adds GET /aml_studio/repositories/:id/serialized_cache.
  - openapi/ — API spec for the new endpoint.
  - serialized_cache_spec.rb, level_db/client_spec.rb, serialized_cache_spec.rb (controller) — Backend tests.
- Nature: New capability.

Thread 4: Frontend serialized cache loading

- Origin: packages/aml-studio/aml/aml-2.0/serializedCache.ts — Functions to fetch serialized cache from the API, store in CacheStorage, load into workers via
setParserBackendWithSerializedCache.
- Propagation:
  - ajax.ts — New axios instance for worker-side HTTP calls using session auth.
  - workerController.ts — loadSerializedCacheToWorkers() orchestrates: fetch → CacheStorage → broadcast to all workers → cleanup.
  - All worker files (amlHolistics.worker.ts, amlDiagnostics.worker.ts, amlLanguageService.worker.ts, project.worker.ts) — Register setParserBackendWithSerializedCache
action.
  - editor/actions.ts — New bootstrapSerializeCache action called after file bootstrap completes.
  - editor/state.ts, mutations.ts, getters.ts, constants.ts — New amlDatabaseWorkerState tracking.
  - files/actions.ts — bootstrap calls bootstrapSerializeCache after worker init; refreshFiles respects database worker state for lazy loading.
  - BottomBar.vue — Shows "Preparing development" indicator while database worker initializes.
- Nature: New capability.

Thread 5: Tag resolution by file path instead of FQN

- Origin: TaggedObjectWrapper.vue — Adds currentObjectPath prop, resolves FQN from tagStore.objectFilePathToFqn map (avoids per-node FQN lookup).
- Propagation:
  - tagStore.ts — New objectFilePathToFqn reactive Map.
  - useTag.ts — Populates objectFilePathToFqn from the new filePathFqnMap returned by tag services.
  - devTaggingService.ts, reportingTaggingService.ts, taggingService.ts (interface) — fetchObjectTags → fetchObjectTagsWithFilePath, fetchAll returns a 3-tuple including
filePathFqnMap.
  - object.ts (getObjectTagsWithFilePath) — Replaces getObjectTags, returns { tags, filePathFqnMap }.
  - aml/types.ts — New GetObjectTagsWithFilePathResult type.
  - NavigationNode.vue — Passes node.path instead of FQN to TaggedObjectWrapper.
- Nature: Interface change for performance — tree nodes no longer need FQN resolution to check tags.

Thread 6: Removal of getAllFQNs action and filePathFqnMap/fqnFilePathMap from files store

- Origin: editor/actions.ts — Removes getAllFQNs action and its calls from setSource, removeSource, batchSetSource, batchRemoveSource.
- Propagation:
  - editor/constants.ts — Removes getAllFQNs from ActionTypes.
  - files/getters.ts — Removes fqnFromFilePath and filePathFromFqn getters.
  - NavigationNode.vue — Removes mapGetters('aml/files', ['fqnFromFilePath']).
  - useDashboardTemplates.ts — No longer uses fqn from store, instead uses interpret() to get the dashboard object's uname directly.
  - generateDefaultDashboardContent.ts, useDashboardProjectSettings.ts — Replace filePathFromFqn getter with getObjectMetadataByFqn worker call.
- Nature: Cleanup — the per-change FQN sync was the main performance bottleneck being eliminated.

Thread 7: Git store additions (workingRepoId, fetchWorkingRepo)

- Origin: git/state.ts — New workingRepoId state field.
- Propagation:
  - git/actions.ts — New fetchWorkingRepo action (calls /repositories/current_repo), called in openRepo. Also changes branch switch to shouldBootstrap: true.
  - git/constants.ts, mutations.ts, getters.ts — Supporting plumbing.
  - _js_head.html.erb — Adds project_repository_id to the projects array exposed to JS.
  - index.d.ts — Types for project_repository_id.
- Nature: New capability needed by serialized cache (requires repo ID to build cache key).

Thread 8: Feature toggles and backend config

- Origin: feature_toggles/LIST.rb — Three new FTs: submit_generate:fetch_binding_from_aml_server, aml_studio:fe_use_serialize_cache,
aml_studio:fe_use_database_web_worker.
- Propagation:
  - aml_studio/project.rb — Constants FT_FE_USE_SERIALIZE_CACHE, FT_FE_USE_DATABASE_WEB_WORKER.
  - viz_data_operations/base.rb — submit_generate:fetch_binding_from_aml_server FT gates the dataset_struct_from_aml_server path.
  - rails_helper.rb — Enables FT_UTILIZE_FE_PROCESSING and submit_generate:fetch_binding_from_aml_server globally in tests.
- Nature: Configuration / gating.

Thread 9: Test refactoring into shared examples

- Origin: Multiple spec files refactored to extract shared examples.
- Propagation:
  - dashboard_duplicate_shared_examples.rb ← extracted from dashboard_duplicate_spec.rb
  - dashboard_templates_shared_examples.rb ← extracted from dashboard_templates_spec.rb
  - drillthrough_tabs_shared_examples.rb ← extracted from drillthrough_tabs_spec.rb
  - drillthroughs_shared_examples.rb ← extracted from drillthroughs_spec.rb
  - tag/shared_examples.rb ← extracted from tag_spec.rb
  - spec/integration/aml/database_worker/ — New spec directory with shared_context.rb and 5 spec files re-running the shared examples with the database worker FTs
enabled.
- Nature: Mechanical propagation / test infrastructure.