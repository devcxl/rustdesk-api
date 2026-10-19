# Domain Docs

How the engineering skills should consume this repo's domain documentation when exploring the codebase.

This repo is **single-context**: one `CONTEXT.md` and one `docs/adr/` at the root.

## Before exploring, read these

- **`CONTEXT.md`** at the repo root, the domain glossary.
- **`docs/adr/`**: read ADRs that touch the area you're about to work in.

If any of these files don't exist, **proceed silently**. Don't flag their absence; don't suggest creating them upfront. The `/domain-modeling` skill (reached via `/grill-with-docs` and `/improve-codebase-architecture`) creates them lazily when terms or decisions actually get resolved.

## Use the glossary's vocabulary

When your output names a domain concept (in an issue title, a refactor proposal, a hypothesis, a test name), use the term as defined in `CONTEXT.md`. Don't drift to synonyms the glossary explicitly avoids. Notably: **Peer**, not "device"; **Address Book**, not "contacts"; **Audit Conn**, not "session log".

If the concept you need isn't in the glossary yet, that's a signal: either you're inventing language the project doesn't use (reconsider) or there's a real gap (note it for `/domain-modeling`).

## Flag ADR conflicts

If your output contradicts an existing ADR, surface it explicitly rather than silently overriding:

> _Contradicts ADR-0007 (event-sourced orders), but worth reopening because…_

## Architecture at a glance

Not domain documentation: this is orientation for finding your way around the code. Keep `CONTEXT.md` implementation-free.

Go 1.23, single module `github.com/lejianwen/rustdesk-api/v2`. Layering, top to bottom:

```
cmd/apimain.go        entrypoint, bootstraps config and DB seeding
  config/             typed config loading (app, gin, gorm, jwt, oauth, ldap, redis, oss, rustdesk, proxy)
  global/             process-wide singletons (Config), i18n, validators
  lib/                reusable infrastructure: cache, jwt, lock, logger, orm, upload
  model/              GORM persistence models, one file per aggregate
  service/            business logic; AllService holds the service instances
  http/
    router/           route tables, split into admin.go and api.go (router.go serves static assets)
    controller/
      admin/          web admin console endpoints (/api/admin/*), plus admin/my/ for self-service
      api/            RustDesk client endpoints (/api/*)
      web/            browser-facing pages
    middleware/       jwt, admin privilege, rustauth, cors, limiter, logger
    request/          inbound request payloads
    response/         outbound response payloads
```

Dependency direction is one-way: `http` → `service` → `model`, with `lib` and `global` as shared leaves. Controllers don't run queries themselves; they go through `service`. Filtering is expressed by passing a `func(tx *gorm.DB)` closure into a service list method, which is why controllers import `gorm` for the type but never hold or call a `*gorm.DB`. Request and response payload types live in `http/request` and `http/response` and are converted at that boundary, never passed into `service` as domain models.

Three distinct authentication paths, easy to confuse:

- `/api/*` — RustDesk clients, authenticated by `middleware.RustAuth` from the `Authorization` header.
- `/api/admin/*` — web admin console, authenticated by `middleware.BackendUserAuth` from the `api-token` header, with `middleware.AdminPrivilege` on admin-only route groups.
- `/api/login-options` and friends sit outside both, since they bootstrap authentication.

Swagger specs are generated, not hand-written: `docs/admin/` and `docs/api/` (run `generate_api.go` / `generate_run.go`). Check `.github/workflows/` for CI before assuming a change is verified.
