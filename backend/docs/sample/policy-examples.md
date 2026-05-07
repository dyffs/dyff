## Suppress (the "stop telling me about X" category — likely the most common)

1. "We know our test coverage is low" — Instruction: "Don't flag missing tests for files under app/admin/." File scope: app/admin/**. This is the classic noise case — the team is aware, doesn't need reminding on every PR.
2. "We intentionally use raw SQL here" — Instruction: "Don't flag raw SQL queries in reporting modules. We use raw SQL for performance and this is expected." File scope: app/services/reporting/**.
3. "N+1 warnings in background jobs are noise" — Instruction: "Suppress N+1 query warnings in background job classes. These run off-peak and we optimize for code clarity over query count." File scope: app/jobs/**.
4. "Stop flagging our legacy serializers" — Instruction: "Don't comment on the use of ActiveModel::Serializers in v1 API endpoints. We know it's deprecated but migration is tracked separately." File scope: app/serializers/v1/**.
5. "We use delete_all intentionally in bulk operations" — Instruction: "Suppress warnings about delete_all skipping callbacks in bulk service objects. Callbacks are handled upstream." File scope: app/services/bulk/**.

## Nit (nice-to-have, low-priority style/convention stuff)

1. "Prefer freeze on constants" — Instruction: "Flag string constants that aren't frozen. We prefer CONSTANT = 'value'.freeze for memory efficiency." File scope: none (global).
2. "Use named scopes over class methods for queries" — Instruction: "If a model class method just wraps a query, suggest using a named scope instead." File scope: app/models/**.
3. "Prefer Time.current over Time.now" — Instruction: "Flag uses of Time.now — we use Time.current for timezone-aware timestamps." File scope: none.

## Improvement (should fix — real code quality concerns)

1. "Services must be single-purpose" — Instruction: "Flag service objects that appear to handle more than one domain action. Each service should do one thing." File scope: app/services/**.
2. "Background jobs must be idempotent" — Instruction: "Check that job perform methods can be safely retried. Flag any side effects that aren't guarded by idempotency checks." File scope: app/jobs/**.
3. "API responses must use our standard envelope" — Instruction: "Flag controller actions that render JSON without wrapping in our standard response envelope ({ data:, meta:, errors: })." File scope: app/controllers/api/**.
4. "Migrations must be reversible" — Instruction: "Flag migrations that use execute or change blocks that aren't clearly reversible. We require rollback capability for all migrations." File scope: db/migrate/**.

## Critical (blocks merge — rare but genuinely important)

1. "Any change to billing logic must include corresponding test updates" — Instruction: "Any change to billing logic must include corresponding test updates. Flag if tests are missing or don't cover the changed code paths." File scope: app/billing/**. (This is the example from the mockup — good baseline test.)
2. "Never store PII in plain text columns" — Instruction: "Flag any new database column or attribute that stores email addresses, phone numbers, or government IDs without using our EncryptedAttribute concern." File scope: db/migrate/**,app/models/**.
3. "Auth changes require security review tag" — Instruction: "Any modification to authentication or authorization logic must be flagged for manual security review." File scope: app/controllers/concerns/auth**,app/models/user.rb,app/services/auth/**.
4. "Don't expose internal IDs in public API responses" — Instruction: "Flag any API serializer or controller that exposes raw database IDs in public-facing endpoints. We use UUIDs for external references." File scope: app/controllers/api/v2/**,app/serializers/v2/**.