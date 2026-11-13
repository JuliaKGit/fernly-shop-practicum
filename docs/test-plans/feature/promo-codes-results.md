# Results: feature/promo-codes

| Row | Test | Result | Possible finding |
| --- | --- | --- | --- |
| P01 | `tests/api/promo.spec.ts` — P01: LEAFY10 takes 10% off plant subtotal only, never shipping | **fail** | **F-04:** discount for Snake Plant `$22` was `$2.90` (10% of subtotal+shipping), expected `$2.20` |
| P02 | `tests/api/promo.spec.ts` — P02: FREESHIP makes shipping $0 with no plant discount | **pass** | — |
| P03 | `tests/api/promo.spec.ts` — P03: free shipping from $50 uses subtotal before the percent discount | **fail** | Over-$50 cart kept free shipping after LEAFY10 (ok); under-$50 case hit **F-04** (`$5.60` vs `$4.90`) |
| P04 | `tests/api/promo.spec.ts` — P04: apply and remove promo require a signed-in customer | **pass** | — |
| P05 | `tests/api/promo.spec.ts` — P05: unknown, expired, empty cart, and empty code are refused | **fail** | **F-05:** `SPRING5` returned `200` instead of `400` / `promo_invalid` (unknown / empty-cart / empty-code path reached before this) |
| P06 | `tests/api/promo.spec.ts` — P06: codes are case-insensitive; replace and DELETE clear correctly | **fail** | Blocked by **F-04** on `leafy10` discount (`$2.90` vs `$2.20`); case / replace / DELETE not fully proven |
| P07 | `tests/api/promo.spec.ts` — P07: placing an order keeps promo on the order and clears the cart | **fail** | Blocked by **F-04** before place-order assertions |
| P08 | `web/cypress/component/OrderSummary.cy.tsx` — P08 | **fail** | **F-06:** expected `−$4.00`, rendered `−$4` (screenshot under `web/cypress/screenshots/OrderSummary.cy.tsx/`) |
| P09 | `web/cypress/component/PromoCodeInput.cy.tsx` — P09 | **fail** | **F-07:** no accessible name on the promo field; Apply/Remove/busy/error text exercised before a11y asserts (screenshot under `web/cypress/screenshots/PromoCodeInput.cy.tsx/`). Alert announcement still a suspicion |
| P10 | `web/cypress/ui/cart-promo.cy.ts` — P10 | **fail** | Apply updated summary to `Discount (LEAFY10)` / `$26.75`; failed on **F-06** (`−$2.20` vs `−$2.2`). Screenshot: `web/cypress/screenshots/cart-promo.cy.ts/` |
| P11 | `web/cypress/ui/checkout-order-promo.cy.ts` — P11 | **fail** | Checkout showed `Discount (LEAFY10)` / `$26.75`; failed on **F-06** (`−$2.20`). Screenshot: `web/cypress/screenshots/checkout-order-promo.cy.ts/` |
| P12 | `tests/e2e/promo-checkout.spec.ts` — P12 | **fail** | Unknown-code refusal OK; **F-05:** `SPRING5` produced no expired message (code accepted) |
| P13 | `tests/a11y/promo.spec.ts` — P13 | **fail** | **F-07:** axe `label` (critical) on cart promo `input` (executed) |
| P14 | — | **skipped** | assumed — ask: exact expired `detail` string for `SPRING5` vs unknown |

## Spec runs (each new file once; failing tests fixed ≤2× then recorded)

| Spec | Command | Outcome |
| --- | --- | --- |
| `tests/api/promo.spec.ts` | `npx playwright test tests/api/promo.spec.ts --project=api` | 3 pass (P02, P04, + setup), 5 fail |
| `web/cypress/component/OrderSummary.cy.tsx` | `npm run cy:component -- --spec 'web/cypress/component/OrderSummary.cy.tsx'` | 1 fail |
| `web/cypress/component/PromoCodeInput.cy.tsx` | `npm run cy:component -- --spec 'web/cypress/component/PromoCodeInput.cy.tsx'` | 1 fail |
| `web/cypress/ui/cart-promo.cy.ts` | `npm run cy:ui -- --spec 'web/cypress/ui/cart-promo.cy.ts'` | 1 fail |
| `web/cypress/ui/checkout-order-promo.cy.ts` | `npm run cy:ui -- --spec 'web/cypress/ui/checkout-order-promo.cy.ts'` | 1 fail |
| `tests/e2e/promo-checkout.spec.ts` | `npx playwright test tests/e2e/promo-checkout.spec.ts --project=e2e` | 1 fail |
| `tests/a11y/promo.spec.ts` | `npx playwright test tests/a11y/promo.spec.ts --project=a11y` | 1 fail |

## Summary

- Rows tested: 13 (P14 skipped — assumed ask)
- Passed: P02, P04
- Failed: P01, P03, P05–P13
- New findings: F-04, F-05, F-06, F-07 (see `FINDINGS.md`)
- App code: not changed
