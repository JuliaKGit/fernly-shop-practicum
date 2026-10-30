# The Fernly challenge: find, prove, report

## The situation

A small team built Fernly in a hurry with an AI coding assistant. It worked at the demo. Since then a series of changes went in without review, and customers have started to complain: wrong prices, odd totals, pages that show the wrong thing, and a screen-reader user who can't use the shop at all.

You're the QA engineer brought in to find out what's wrong. Nobody has written a single test.

This is also the format of a common second-round interview for QA and SDET roles: a working app with defects planted across the stack, a time box, and any tools you like. You're judged on **how you find problems, how you prove them, and how you report them** — not on how many lines of code you write.

## What you have

- The shop at `http://localhost:5173` and its API at `http://localhost:8100/api` (`npm start`).
- [docs/PRODUCT.md](docs/PRODUCT.md): how the shop should behave. When the app disagrees with it, the app is wrong.
- The API contract: Swagger UI at `http://localhost:8100/docs`, the file at `/openapi.json`.
- Two customer accounts (see `.env.example`).
- The source code. You may read it. Don't change it — report.
- Any AI tool you like. In this course: Cursor, with your own rules, skills, subagents and hooks.

## Where defects hide

Defects can be anywhere a customer or another system depends on the shop:

- **Components** — what one piece of the screen shows for a given input: a price, a badge, a button's state.
- **Pages** — what happens when data is missing, empty, slow or broken.
- **Business rules in the API** — sorting, totals, shipping, stock.
- **The contract** — when a response doesn't match the documented schema.
- **Caching** — when the screen shows something other than what you asked for.
- **Authorization** — when one customer can see or change another customer's data.
- **Accessibility** — when someone using a keyboard or a screen reader can't do what everyone else can.

Some are obvious. Some only appear at a boundary. Some need a second account. Some only appear when the server misbehaves.

## What to deliver

1. **`FINDINGS.md`** — one entry per issue:
   - a one-line title (what is wrong);
   - where: the page, component, or endpoint;
   - the category (from the list above);
   - the impact on a customer, in one sentence;
   - the evidence: the test that fails, or the exact steps and requests;
   - the line in `docs/PRODUCT.md` or the API contract it contradicts;
   - optionally, a one-line suggested fix.
2. **The tests that prove each finding.** A finding without evidence is a guess.

Order the findings by severity: money and privacy first, then broken flows, then everything else.

## How to approach it with AI agents

1. **Map the app** before you test it: pages, components, API calls, and what each should do.
2. **Compare** what you see with the product description and the contract. Write down what neither document answers — those are questions, not bugs.
3. **Test at the right level.** A component test reaches states a full browser flow rarely does. A mocked API reaches errors the real server never returns. An end-to-end test proves the real flow. An API test proves the rule. An accessibility scan proves what a screen reader meets.
4. **Prove before you claim.** Re-run anything surprising. Reproduce it by hand once.
5. **Report** in plain words, with the evidence attached.

## What a strong answer shows

- **A plan, not a crawl.** You know what you're trying to prove before you run anything.
- **Coverage across layers.** Findings from components, pages, the API, and accessibility — not only what's visible on the home page.
- **Evidence for every claim,** and no false positives: if no document says it's wrong, it's a question.
- **Severity sense.** You spot first what costs money or leaks data.
- **AI used for reasoning,** not only for typing: the agent explains why a result is a defect.
