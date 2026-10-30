# API features

Every `.ts` file in this folder that exports `register(ctx)` is loaded when the API starts. A new feature adds its own file here — its routes on `ctx.router` (under `/api`), its OpenAPI paths on `ctx.registry`, and `ctx.onReset(...)` to restore its own data on `POST /api/admin/reset` — instead of editing the shared files. That keeps new features from colliding with each other.
