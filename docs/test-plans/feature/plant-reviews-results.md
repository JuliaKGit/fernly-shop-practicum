# Results: feature/plant-reviews

| Row | Test | Result | Possible finding |
| --- | --- | --- | --- |
| R1 | `tests/api/R1-delete-review.spec.ts` — R1 DELETE author-only | **failed** | Another signed-in customer can DELETE someone else's review (expected 404, got 204). |
| R2 | `tests/api/R2-post-review.spec.ts` — R2 POST create/validation | **passed** | |
| R3 | `tests/api/R3-get-reviews.spec.ts` — R3 GET list/average | **failed** | Seeded 5, 4, 5 averages to **4.6** (floor) instead of documented **4.7** (halves up). |
| R4 | `web/cypress/component/StarRatingInput.cy.tsx` — R4 | **failed** | Selected stars lack `aria-checked`; keyboard radio behavior not implemented. Screenshot: `web/cypress/screenshots/StarRatingInput.cy.tsx/`. |
| R5 | `web/cypress/component/ReviewForm.cy.tsx` — R5 | **passed** | |
| R6 | `web/cypress/component/ReviewList.cy.tsx` — R6 | **passed** | |
| R7 | `web/cypress/ui/plant-reviews.cy.ts` — R7 | **failed** | After successful POST, toast appears but the new review does not show in the list (invalidate key `['review', id]` vs query `['reviews', id]`). Screenshot: `web/cypress/screenshots/plant-reviews.cy.ts/`. |
| R8 | `tests/e2e/plant-reviews.spec.ts` — R8 | **failed** | Same as R7 on the live stack: thanks toast visible, posted review text never appears without reload. |
| R9 | `tests/a11y/plant-reviews.spec.ts` — R9 | **failed** | Signed-in Reviews section: axe `aria-required-attr` (critical) on each star `role="radio"` missing `aria-checked` (same root cause as R4). Signed-out Reviews section: no blocking violations. |

## Assumed — ask (no tests)

| Topic | Why |
| --- | --- |
| UI delete control | Feature doc and OpenAPI describe author-only delete, but the Reviews slot has no delete button. |
| Loading copy | Slot shows "Loading reviews…" — not specified in docs/features/plant-reviews.md. |
| Average rounding vs implementation | Confirmed by R3 failure: API floors to 4.6; doc requires 4.7. |
| List refresh after POST | Confirmed by R7/R8: wrong invalidate query key. |

## Summary

| Level | Rows | Passed | Failed | Possible findings |
| --- | --- | ---: | ---: | ---: |
| api | R1–R3 | 1 | 2 | 2 |
| component | R4–R6 | 2 | 1 | 1 |
| ui | R7 | 0 | 1 | 1 |
| e2e | R8 | 0 | 1 | 1 (same as R7) |
| a11y | R9 | 0 | 1 | 1 (same as R4) |
| **Total** | **R1–R9** | **3** | **6** | **4 distinct** |
