## 1. Intent Summary

Adds SCIM 2.0 provisioning support for user and group lifecycle management. Creates a `ScimProvider` model for tenant-level SCIM configuration (auth token, role mappings) and a `ScimIdentity` model for linking external identities to local users/groups. The admin UI can enable SCIM (requires SAML SSO first), rotate auth tokens, and configure role mappings. SCIM API authentication uses token digest lookup with SHA256 hashing.

## 2. Scope & Risk

### Must-inspect

| File | Magnitude | Role |
|---|---|---|
| db/migrate/20260224072632_create_scim_providers.rb | new file | creates providers table with token_digest |
| db/migrate/20260224072650_create_scim_identities.rb | new file | creates polymorphic identities table |
| app/models/scim_provider.rb | new file | token generation, auth, role mapping validation |
| app/controllers/tenants_controller.rb | significant change | admin actions for SCIM settings |
| app/services/scim/providers/disable_service.rb | new file | bulk identity removal on disable |

**Watch for:**
- `scim_provider.rb` — token_digest uses SHA256; authenticate() looks up by digest via unique partial index — confirm the index's `WHERE token_digest IS NOT NULL` clause matches all query patterns
- `disable_service.rb` — uses `delete_all` (skips callbacks) inside transaction; verify no `dependent: :destroy` on User/Group → scim_identity associations that would be bypassed

### Should-inspect

| File | Magnitude | Role |
|---|---|---|
| app/models/scim_identity.rb | new file | polymorphic identity linking |
| app/models/tenant.rb | minor edit | adds scim_enabled? check and associations |

### Likely-safe

| File | Magnitude | Role |
|---|---|---|
| app/models/user.rb | minor edit | adds scim_identity association |
| app/models/group.rb | minor edit | adds scim_identity association |
| app/serializers/scim_provider_serializer.rb | new file | JSON serialization for admin UI |
| config/routes.rb | config/wiring | adds 3 SCIM admin routes |
| app/lib/feature_toggles/LIST.rb | config/wiring | registers feature flag |
| spec/controllers/tenants_controller_spec.rb | minor edit | controller action tests |
| spec/models/scim_provider_spec.rb | new file | model validation/auth tests |
| spec/models/scim_identity_spec.rb | new file | association tests |
| spec/models/tenant_spec.rb | minor edit | scim_enabled? tests |
| spec/services/scim/providers/disable_service_spec.rb | new file | disable flow tests |
| spec/factories/scim_providers.rb | new file | test factory |
| spec/factories/scim_identities.rb | new file | test factory |

Also changed: db/schema.rb, docs/schema.dbml, 4 sorbet/rbi/dsl/*.rbi files (generated), 2 docs/plans/*.md files (design docs), changelog/feat-scim-schema.txt