# Fernly — a practice plant shop

A small houseplant shop for learning to test a real web app with AI agents: React components, a browser UI, a REST API, and accessibility. It was built for the Agentic QA Practicum course (Module 3).

> The shop has defects on purpose. Finding them is the job — see [CHALLENGE.md](CHALLENGE.md). You may read the code, but don't fix the app: report what you find, and let your tests prove it.

## Get your own copy

You need Node.js 20 or newer and the GitHub CLI (`gh`) signed in.

```bash
gh repo fork vskadorva/fernly-shop-practicum --clone --default-branch-only
cd fernly-shop-practicum
npm install
npm start
```

| What | Where |
| --- | --- |
| The shop | `http://localhost:5173` |
| The API | `http://localhost:8100/api` |
| API docs (Swagger UI) | `http://localhost:8100/docs` |
| OpenAPI file | `http://localhost:8100/openapi.json` |
| How the shop should behave | [docs/PRODUCT.md](docs/PRODUCT.md) |

Stop both with Ctrl+C. Data lives in memory: a restart, or `curl -X POST localhost:8100/api/admin/reset`, puts everything back. The two seed customers are in `.env.example`.

## Branches

| Branch | What it is |
| --- | --- |
| `init` | The shop as it starts: no tests, no CI. Your fork works on this branch. |
| `main` (upstream only) | The instructor's class work. Catch up from it if you get stuck. |

New features arrive later as pull requests into your fork.

## Project layout

| Path | Contents |
| --- | --- |
| `web/src/components/` | React components — the targets for component tests |
| `web/src/pages/` | Pages and the app layout |
| `web/src/api/` | How the web app calls the API, and its data cache |
| `web/src/slots/` | Places where new features plug in their components |
| `api/src/` | The API: routes (`app.ts`), rules (`store.ts`), schemas, OpenAPI |
| `api/src/features/` | New API features, one file each |
| `scripts/smoke.mjs` | `npm run smoke`: the happy path once, through the API |
| `CHALLENGE.md` | The challenge: find, prove and report the shop's defects |

## Useful commands

| Command | What it does |
| --- | --- |
| `npm start` | API and shop together |
| `npm run start:api`, `npm run start:web` | One of them |
| `npm run smoke` | The happy path once (the API must be running) |
| `npm run typecheck` | Check the TypeScript code |

## Troubleshooting

- **Port 5173 or 8100 is busy:** another copy is running. Stop it first.
- **The shop shows old data:** reset with `POST /api/admin/reset`, or restart.
- **`npm run smoke` fails on the first line:** the API isn't running.
