Intent

This PR adds AML Studio incremental deployment. Instead of recompiling and republishing the whole repo on every deploy, it asks the AML compiler for the delta between the
currently deployed commit and the target commit, then publishes only changed objects while still detecting deletions via a compile manifest. The rest of the diff is
mostly the plumbing needed to support commit-scoped serialized cache and the downstream changeset semantics (modified / unmodified / deleted instead of the old existing
bucket).

Suggested Reading Flow

1. Start from the feature entrypoints and gating.
   Read engines/aml_studio/app/models/aml_studio/project.rb, then app/lib/feature_toggles/LIST.rb, then engines/aml_studio/app/services/aml_studio/git_flows/deploy.rb,
   then engines/aml_studio/app/services/aml_studio/publish/publish_public_workspace.rb, then engines/aml_studio/app/services/aml_studio/publish/
   publish_personal_workspace.rb.
   This gives you the user-visible behavior: when incremental deploy is used, which commit is treated as the cache base, and how public/personal deploys switch cache
   mode.
2. Then read the compiler-side incremental API and cache model.
   Read app/services/aml_studio/fetch_incremental_changes.rb, then engines/aml_studio/app/models/aml_studio/repositories/compiler.rb, then engines/aml_studio/app/models/
   aml_studio/repositories/compiler/endpoint.rb, then engines/aml_studio/app/models/aml_studio/repositories/compiler/cache_settings/cache_key_commit.rb, engines/
   aml_studio/app/models/aml_studio/repositories/compiler/cache_settings/cache_settings_commit.rb, engines/aml_studio/app/models/aml_studio/repositories/compiler/
   compile_manifest.rb, engines/aml_studio/app/models/aml_studio/repositories/compiler/incremental_result.rb, engines/aml_studio/app/models/aml_studio/repositories/
   compiler/compile_file_result.rb, and engines/aml_studio/app/models/aml_studio/repositories/compiler/compiled_object_result.rb.
   This is the core mechanism: commit-based cache keys, compileIncremental, and the manifest used to distinguish deleted vs untouched objects.
3. Next read how publish semantics changed.
   Read engines/aml_studio/app/services/aml_studio/publish.rb, then engines/aml_studio/app/services/aml_studio/publish/base.rb, then engines/aml_studio/app/services/
   aml_studio/publish/utils/generate_publish_changeset.rb.
   After that, skim the object publishers that were adapted to the new changeset shape: engines/aml_studio/app/services/aml_studio/publish/utils/objects/
   publish_dataset.rb, engines/aml_studio/app/services/aml_studio/publish/utils/objects/publish_dashboard.rb, engines/aml_studio/app/services/aml_studio/publish/utils/
   objects/publish_embed_portal.rb, and engines/aml_studio/app/services/aml_studio/publish/utils/publish_aml_compiled_cache.rb.
   This is where the reviewer should check whether “publish only changed things” is implemented consistently.
4. End with the proof and supporting bumps.
   Read spec/services/engines/aml_studio/publish/publish_public_workspace_spec.rb, spec/services/engines/aml_studio/publish/publish_personal_workspace_spec.rb, then spec/
   services/engines/aml_studio/publish/utils/generate_publish_changeset_spec.rb.
   If needed, use the fixture/spec support files for context: spec/support/aml_studio_context.rb, spec/fixtures/aml_repos/multiple_sources/public_workspace/datasets/
   pepsi.dataset.aml, spec/fixtures/aml_repos/multiple_sources/public_workspace/dashboards/pepsi_dashboard.page.aml.
   Leave Gemfile, packages/aml-server/package.json, and pnpm-workspace.yaml for last; they are supporting dependency upgrades to expose the compiler/client API used
   above.