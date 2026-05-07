## Findings

### CRITICAL

**1. Missing foreign key relationship between scim_identities and scim_providers**

`db/migrate/20260224072650_create_scim_identities.rb` — The `scim_identities` table stores `identity_provider_name` as a string without a foreign key reference to `scim_providers`. If a SCIM provider record is deleted directly (bypassing the `DisableService`), the corresponding `scim_identities` records become orphaned, creating data inconsistency.

**Fix:** Add a `scim_provider_id` foreign key column with `on_delete: :cascade` or `on_delete: :nullify`, or ensure all code paths that delete providers also clean up identities through the `DisableService`.

---

**2. `generate_scim_token` bypasses SAML validation and creates inconsistent provider state**

`app/controllers/tenants_controller.rb:109-112` — The `generate_scim_token` method calls `create_scim_provider!` which creates a new SCIM provider even when SAML SSO is not enabled (bypassing the validation in `update_scim_settings`). Additionally, if a provider already exists and is enabled, calling this method would raise a unique constraint error rather than rotating the existing token.

**Fix:** Use `find_or_initialize_by(tenant: current_tenant)` pattern consistently. Consider whether token generation should require SAML SSO to be enabled first (matching the enable flow), or document that providers can exist in a disabled state awaiting SAML configuration.

---

**3. Missing transaction wrapping in `update_scim_settings`**

`app/controllers/tenants_controller.rb:76-101` — The provider update and `DisableService` call are not wrapped in a single transaction. If `DisableService` fails after the provider is saved, the provider state becomes inconsistent.

**Fix:**
```ruby
ActiveRecord::Base.transaction do
  provider.save!
  if was_enabled && !provider.enabled
    Scim::Providers::DisableService.new(tenant: current_tenant).call
    provider.reload
  end
end
```

### IMPROVEMENT

**4. Missing tenant status check in SCIM authentication**

`app/models/scim_provider.rb:41` — The `authenticate` method loads and returns the provider without verifying the tenant is active. A suspended or soft-deleted tenant's SCIM API would still authenticate.

**Suggestion:** Add a status check: `provider.tenant&.active?` before returning the provider.

---

**5. Missing model-level uniqueness validation**

`app/models/scim_identity.rb:8` — While the database has a unique index on `external_uid` scoped to `tenant_id`, the model lacks a corresponding validation. This would result in database errors rather than meaningful validation messages.

**Suggestion:** Add `validates :external_uid, uniqueness: { scope: [:tenant_id, :identityable_type], allow_nil: true }`

---

**6. Potential nil error in serializer**

`app/serializers/scim_provider_serializer.rb:14` — `object.tenant.base_url` could raise an error if the tenant is nil or not loaded.

**Suggestion:** Use safe navigation: `object.tenant&.base_url` with a fallback or error handling.

### NIT

**7. Hardcoded identityable types**

`app/services/scim/providers/disable_service.rb:28` — The hardcoded `%w[User Group]` array could become stale. Consider extracting to a constant or deriving from the polymorphic association configuration.

## Verdict

**REQUEST_CHANGES** — The missing foreign key relationship and inconsistent state management in `generate_scim_token` are critical issues that could lead to data integrity problems. The transaction wrapping issue should also be addressed for robustness.