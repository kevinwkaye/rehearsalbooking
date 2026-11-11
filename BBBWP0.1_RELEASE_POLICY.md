# Bunkface Booking Boutique: work-package release policy

Each release is numbered, for example **BBBWP0.1**. We use **one Supabase project and one Cloudflare Pages site**, with no separate UAT environment. Until client go-live, we test on the shared project. Afterwards, tests must not alter genuine member or booking data.

## Every work package must contain

1. Change scope, acceptance tests and a linked GitHub pull request.
2. Exact Git commit, Cloudflare deployment ID, migration identifiers and deployed Edge Function versions.
3. A tested pre-release migration and a documented deployment sequence.
4. A verified *restorable* data backup/export when data or schema could be affected. SQL migration history alone is not a backup.
5. A **functional rollback script** and a procedure to return Cloudflare to the previous known-good deployment.
6. A smoke test after deployment and an agreed go/no-go decision.

## Rollback policy

**Rolling back only the frontend is insufficient** when a work package changes the database API. Always restore compatible server RPC permissions first, then roll Cloudflare back to the recorded previous deployment.

Prefer additive schema changes. Preserve confirmed bookings, accounts, audit logs, pending proposal records and push subscriptions during an emergency rollback instead of dropping tables. A rollback restores the **previous functionality**, not necessarily the exact previous physical schema.

Destructive user actions (for example deleting a member's authentication account) cannot be magically reversed by a code rollback. Take an appropriate backup before go-live and recover those events separately as needed. Before restoring or resetting a client-live database, assess lost writes and get approval.

## BBBWP0.1

- Pre-release branch: `BBBWP0.1-pre-release`. Production branch: `main`.
- Database changes: 005 member-confirmed proposals; 006 Web Push queue.
- Functional rollback: [ops/BBBWP0.1_rollback.sql](ops/BBBWP0.1_rollback.sql).
- Re-enable after rollback: [ops/BBBWP0.1_reenable.sql](ops/BBBWP0.1_reenable.sql).
- **Critical:** migration 005 revokes the old `create_booking` API, so rollback must grant it back before Cloudflare serves the old frontend.
- Push rollback disables the webhook trigger but retains encrypted Vault settings, subscriptions and in-app notifications.
- Keep pending requests and their votes for reconciliation if the feature is later re-enabled. They are hidden from the previous frontend, not deleted.
- To redeploy a work package after a functional rollback, run the re-enable script. Do not rerun the already-applied migrations without inspecting migration history.

Production release and live phone push testing still require explicit sign-off. Pre-client integration tests can use transactions that are rolled back, without a new UAT project.
