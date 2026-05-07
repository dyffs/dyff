# PR Review: Incremental Deployment for AML Studio

Intent: Introduces incremental deployment for AML Studio by leveraging commit-based caching in the AML compiler. Instead of recompiling all files on every deploy, the system now fetches only changed files between commits and uses a CompileManifest to track all objects (including unmodified ones) for accurate changeset generation.

---  Reading Workflow ---

## 1. Feature Entry & Toggle

How is incremental deployment activated and how does it branch?

- app/lib/feature_toggles/LIST.rb
- engines/aml_studio/app/models/aml_studio/project.rb
- engines/aml_studio/app/services/aml_studio/publish/publish_public_workspace.rb

- The toggle FT_INCREMENTAL_DEPLOYMENT is enabled by default
- Both publish_public_workspace.rb and publish_personal_workspace.rb check the toggle to decide between full compile vs incremental path
- Note the backward compatibility path: build_compile_manifest fallback when feature is off

## 2. Core Incremental Compilation API

How does the AML compiler integration change?

- engines/aml_studio/app/models/aml_studio/repositories/compiler.rb
- engines/aml_studio/app/models/aml_studio/repositories/compiler/endpoint.rb
- app/services/aml_studio/fetch_incremental_changes.rb

- compile_incremental method sends :compileIncremental to AML server with base/new cache entries
- New cache mode: Aml::Client::CacheMode::Commit (instead of Branch)
- FetchIncrementalChanges service orchestrates: takes source/target repos + commit OIDs, returns IncrementalResult

## 3. Data Shape Changes

  What new structures carry compilation metadata?

- engines/aml_studio/app/models/aml_studio/repositories/compiler/incremental_result.rb
- engines/aml_studio/app/models/aml_studio/repositories/compiler/compile_manifest.rb
- engines/aml_studio/app/models/aml_studio/repositories/compiler/cache_settings/cache_key_commit.rb
- engines/aml_studio/app/services/aml_studio/publish.rb (ObjectChangeset)
- engines/aml_studio/app/models/aml_studio/repositories/compiler/compiled_object_result.rb (CompiledObjectShell)


Key semantic shift: ObjectChangeset now has:
- added → new objects
- modified → changed objects (was existing)
- unmodified → tracked but unchanged (new CompiledObjectShell lightweight wrapper)
- deleted → fqns not in manifest

The CompileManifest is critical: it contains all FQNs from the full compilation, enabling detection of deleted objects.

## 4. Changeset Generation Logic

How does the changeset algorithm change with manifest data?

- engines/aml_studio/app/services/aml_studio/publish/utils/generate_publish_changeset.rb
- engines/aml_studio/app/services/aml_studio/publish/base.rb

- GeneratePublishChangeset now receives aml_compile_manifest instead of just changed objects
- Deletion detection: objects in DB but not in manifest are deleted (previously relied on absence from compiled objects)
- find_fqns_removed_from_manifest is the key method
- build_compile_manifest in base.rb provides backward compatibility when feature is off

## 5. Downstream Adaptations

  Which publish utilities had to adapt to the new changeset structure?

- engines/aml_studio/app/services/aml_studio/publish/utils/objects/publish_dashboard.rb
- engines/aml_studio/app/services/aml_studio/publish/utils/objects/publish_dataset.rb
- engines/aml_studio/app/services/aml_studio/publish/utils/objects/publish_embed_portal.rb

- Renamed existing_changeset → modified_changeset, existing_dashboards → modified_dashboards (and similar)
- publish_dataset.rb now includes unmodified fqnames in all_deploying_dataset_fqnames for dataset mapping validation
- Logic largely unchanged, terminology aligned with new semantics

  engines/aml_studio/app/services/aml_studio/publish/utils/expand_dashboard_block_metadata.rb

- Same renaming (existing → modified)
- Adds new logic: build_unmodified_viz_block_shells constructs CompiledObjectShell objects for unmodified VizBlocks
- Note: file_path is empty for these shells (not stored in aml_compiled_caches table yet)

## 6. Proof (Specs)

  What scenarios are validated?

  spec/services/engines/aml_studio/publish/utils/generate_publish_changeset_spec.rb
  spec/services/engines/aml_studio/publish/publish_public_workspace_spec.rb

- deploying_new_objects and updating_deleting_objects snapshot tests
- Tests construct CompileManifest fixtures to match compilation behavior

## Supporting Changes (skimmable)

- Gemfile / pnpm-lock.yaml: aml gem upgraded to 5.3.0 (adds compileIncremental API)
- sorbet/rbi/gems/aml@5.3.0.rbi: type definitions for new AML client methods
- spec/fixtures/aml_repos/multiple_sources/public_workspace/dashboards/pepsi_dashboard.page.aml: new test fixture
