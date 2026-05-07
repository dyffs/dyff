Overview

Intent

This PR optimizes AML Studio frontend performance by introducing a database web worker that maintains an indexed cache of AML objects, replacing the previous approach of
repeatedly calling worker actions for object listing. It also adds serialized cache infrastructure to accelerate parser initialization via pre-computed cache from a
LevelDB service. Additionally, it improves tag/endorsement check performance in the development tree by switching from FQN-based to file-path-based lookups.

---
Change Threads

Thread 1: AmlDatabase Worker (Core Optimization)

Origin: New AmlDatabase class in packages/aml-studio/aml/aml-2.0/amlDatabase/amlDatabase.ts that indexes bindings from all AML files and provides filtered queries.

Propagation:
- amlDatabase.worker.ts - Web worker exposing bindings, objects, diagnostics, getObjectTagsWithFilePath, getTemplates actions
- workerController.ts - Plugs the new database worker alongside existing workers
- useDevAmlDatabaseWorker.ts - New Vue composable providing typed access to database worker
- holisticsWorkerUtil/object.ts, dashboard.ts - Object listing functions now delegate to database worker when aml_studio:fe_use_database_web_worker FT is enabled
- Multiple consumers updated: useObjectTreeSelect.ts, useDashboardDrillthroughs.ts, AmlNodeActions.ts, generateUnameObject.ts, etc.

Nature: New capability - A centralized in-memory indexed database in a dedicated web worker, enabling O(1) filtered object queries instead of re-interpreting files.

---
Thread 2: Serialized Cache Infrastructure

Origin:
- Backend: app/lib/serialized_cache.rb and app/lib/level_db/client.rb - Ruby services for cache key generation and LevelDB access
- Frontend: packages/aml-studio/aml/aml-2.0/serializedCache.ts - Cache loading utilities

Propagation:
- repositories_controller.rb - New streaming endpoint get_serialized_cache that returns cached parser state
- Routes and OpenAPI specs added for the new endpoint
- All worker files (amlHolistics.worker.ts, amlDiagnostics.worker.ts, amlLanguageService.worker.ts, amlDatabase.worker.ts) updated to support
setParserBackendWithSerializedCache action
- editor/actions.ts - New bootstrapSerializeCache action that loads cache into workers
- files/actions.ts - Triggers cache bootstrap after file loading

Nature: New capability - Pre-computed serialized cache served from LevelDB to bypass expensive parser initialization on frontend.

---
Thread 3: Tag System File-Path-Based Lookup

Origin: packages/aml-studio/aml/aml-2.0/object.ts - getObjectTagsWithFilePath now returns filePathFqnMap alongside tags

Propagation:
- tagStore.ts - New objectFilePathToFqn map added to store
- TaggedObjectWrapper.vue - Now accepts currentObjectPath prop and resolves FQN via tag store
- useTag.ts - Populates objectFilePathToFqn map from tagging service
- devTaggingService.ts / reportingTaggingService.ts - fetchAll() return type updated to include filePathFqnMap
- NavigationNode.vue - Uses currentObject-path instead of current-object-fqn

Nature: Interface change - Tag checking now uses file path as primary identifier, resolving FQN through a pre-built map for faster tree node checks.

---
Thread 4: State Management Updates

Origin: Editor and Git store modules

Propagation:
- editor/state.ts, getters.ts, mutations.ts, actions.ts:
  - Added amlDatabaseWorkerState tracking database worker initialization
  - Added waitForDatabaseWorkerInitialization action
  - Removed getAllFQNs action (deprecated - replaced by database worker)
- git/state.ts, getters.ts, mutations.ts, actions.ts:
  - Added workingRepoId state for serialized cache requests
- files/getters.ts - Removed fqnFromFilePath getter (replaced by tag store approach)

Nature: Contract change - State management adapted for new database worker lifecycle and cache requirements.

---
Thread 5: Feature Toggles

Origin: app/lib/feature_toggles/LIST.rb

Propagation: Guard conditions throughout the codebase

Nature: Three new toggles added:
- aml_studio:fe_use_database_web_worker - Enable database worker for object listing
- aml_studio:fe_use_serialize_cache - Enable loading serialized cache into workers
- submit_generate:fetch_binding_from_aml_server - Control binding fetch source

---
Thread 6: Minor Supporting Changes

- Dashboard Templates: CreateDashboardTemplate.vue and useDashboardTemplates.ts updated to pass dashboardFilePath during template creation
- Project Data: window.H.projects now includes project_repository_id for cache metadata
- Tests: New specs for serialized cache endpoint and extracted shared examples for object duplication tests

