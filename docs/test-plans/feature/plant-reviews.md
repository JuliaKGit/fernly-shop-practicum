# Test plan: feature/plant-reviews

## Summary

Adds plant reviews end-to-end: API `GET`/`POST /api/plants/{plantId}/reviews` and `DELETE /api/reviews/{reviewId}` with seeded data; UI on the plant page via a Reviews slot (`ReviewList`, `ReviewForm`, `StarRatingInput`). Signed-in customers can post one review per plant (rating 1–5, text 10–500); everyone can read; only the author may delete.

## Plan

| ID | area | what changed | risk to a customer | level | specialist | cases (positive / negative / edge / accessibility) | source |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | `DELETE /api/reviews/{reviewId}` | Author-only delete of a review | **Privacy** — another customer could remove a review that is not theirs | api | change-triage | **+** author deletes own review → 204; subsequent GET no longer lists it. **−** signed-out → 401 `auth_required`. **−** other signed-in customer → 404 ("Review not found" / not their review). **edge** unknown `reviewId` → 404. Assert status/body against OpenAPI. | docs/features/plant-reviews.md L14; OpenAPI delete path description |
| R2 | `POST /api/plants/{plantId}/reviews` | Create review (auth, validation, one per plant) | **Sign-in / integrity** — guests post, duplicates accepted, bad input stored | api | change-triage | **+** signed-in user posts valid `{ rating, text }` → 201 `Review` schema; `author` = user name. **−** no auth → 401 `auth_required`. **−** second review same user+plant → 409 `already_reviewed` (seed: Ben / `pl-snake`). **−** rating outside 1–5 or non-int → 400. **−** text &lt;10 or &gt;500 (after trim) → 400. **edge** unknown `plantId` → 404. | docs/features/plant-reviews.md L10–L13; OpenAPI POST |
| R3 | `GET /api/plants/{plantId}/reviews` | List, average, count; newest first | Wrong average or order misleads purchase decisions | api | change-triage | **+** seeded plant → 200 `ReviewList` schema; `count` matches `reviews.length`; newest-first by `createdAt`. **+** average for 5, 4, 5 → **4.7** (one decimal, halves up). **edge** plant with no reviews → `average` 0, `count` 0, `reviews` []. **−** unknown plant → 404. | docs/features/plant-reviews.md L7–L9; OpenAPI GET |
| R4 | `StarRatingInput` | New radiogroup star control | Keyboard / screen-reader users cannot set a rating | component | cypress-test-writer | **+** click star N → `onChange(N)`; stars 1…N appear selected. **edge** `value` 0 → none selected. **accessibility** `role="radiogroup"` named "Your rating"; each control `role="radio"` with name "N star(s)". **accessibility** Tab into group; arrow keys change rating; selected star announced (`aria-checked` / roving tabindex) like radio buttons. | docs/features/plant-reviews.md L11; docs/PRODUCT.md Accessibility |
| R5 | `ReviewForm` | Write-a-review form (stars + text + submit) | Empty/invalid reviews submitted; errors unclear | component | cypress-test-writer | **+** rating + ≥10 chars → `onSubmit({ rating, text: trimmed })`; fields reset. **−** rating 0 → `role="alert"` "Choose a rating from 1 to 5 stars."; no `onSubmit`. **−** text &lt;10 → alert "Write at least 10 characters." **edge** `busy` → button disabled, label "Posting…". **edge** `error` prop shown as alert. **accessibility** textarea labelled "Your review"; errors `role="alert"`. | docs/features/plant-reviews.md L10 |
| R6 | `ReviewList` | Average summary + items / empty state | Empty or wrong summary confuses shoppers | component | cypress-test-writer | **+** `count` &gt; 0 → "★ X.X out of 5 · N review(s)", author, stars, en-CA date, text. **edge** `count` 0 → "No reviews yet. Be the first to share how it's growing." **edge** `count` 1 → singular "review". **accessibility** decorative ★ `aria-hidden`; visually-hidden "N out of 5". | docs/features/plant-reviews.md L7, L9 |
| R7 | Plant page Reviews slot (`web/src/slots/plant-page/reviews.tsx`) | Wired list + form + auth gate + toast | Guests see write UI; new review missing from list; no thanks | ui | cypress-test-writer | **+** mocked GET with reviews → "Reviews" section, average, items. **+** signed-in → "Write a review"; successful POST → toast "Thanks for your review!" and list shows the new review without full reload. **−** signed-out → "Sign in to write a review" linking `/login?next=/plants/{id}`; no form. **−** GET failure → ErrorBanner "Reviews couldn't be loaded." + retry. **edge** empty list → empty copy + form if signed in. **edge** POST `already_reviewed` / validation → form shows API error message. | docs/features/plant-reviews.md L7–L13 |
| R8 | Plant page reviews (live API) | End-to-end read/write on `/plants/:plantId` | Feature broken in the real stack despite mocked UI | e2e | change-triage | **+** open seeded plant → Reviews with average/count. **+** sign in as a customer who has not reviewed that plant → post stars+text → thanks toast; review appears in list without reload. **−** same customer posts again → blocked / error (one per plant). **−** signed-out → sign-in prompt, not the form. | docs/features/plant-reviews.md; docs/PRODUCT.md "A plant" |
| R9 | Plant page + Reviews | Axe scan of plant page with Reviews (signed out and signed in) | WCAG regressions on new section, stars, or form | a11y | change-triage | Scan `/plants/{id}` with Reviews loaded (seeded plant). Scan signed-in state with Write a review form visible. Assert no new blocking axe violations; do not edit `a11y-baseline.json`. | docs/PRODUCT.md Accessibility; docs/features/plant-reviews.md L11 |

## Assumed — ask

| Topic | Why |
| --- | --- |
| UI delete control | Feature doc and OpenAPI describe author-only delete, but the Reviews slot has no delete button. Confirm API-only for this PR, or missing UI. |
| Loading copy | Slot shows "Loading reviews…" — not specified in docs/features/plant-reviews.md. Confirm expected copy. |
| Average rounding vs implementation | Doc requires halves-up to one decimal (5,4,5 → **4.7**). Confirm tests should fail if the API truncates (e.g. floor → 4.6). |
| List refresh after POST | Slot invalidates `['review', plant.id]` while the query key is `['reviews', plant.id]`. Confirm expected immediate list update path (invalidate vs optimistic). |

## Stop

Plan written for approval. Do not hand rows to specialists until approved.
