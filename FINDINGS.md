# Fernly findings

One entry per issue, ordered by severity: money and privacy first, then broken flows, then everything else. A finding needs evidence: a failing test, or exact steps and requests. The map of the app is in [docs/APP-MAP.md](docs/APP-MAP.md).

## Entry format

```markdown
### F-NN. <One-line title: what is wrong>

- **Where:** <page, component, or endpoint>
- **Category:** <Components | Pages | Business rules in the API | The contract | Caching | Authorization | Accessibility>
- **Impact:** <the impact on a customer, in one sentence>
- **Evidence:** <the test that fails (file and test name), or the exact steps and requests>
- **Contradicts:** <the line in docs/PRODUCT.md or the API contract>
- **Suggested fix:** <optional, one line>
```

## Findings

### F-01. Prices drop trailing zeros (and zero shows as $0)

- **Where:** `formatPrice` in `web/src/money.ts`, used by `PriceTag` and `OrderSummary` (Browse, Cart, Checkout, Orders)
- **Category:** Components
- **Impact:** Money looks inconsistent and sometimes unpriced; free-shipping hints and totals do not always show two decimals.
- **Evidence:** `web/cypress/ui/browse.cy.ts`, test "shows $0.00 for a plant priced at 0" (executed). `web/cypress/ui/cart.cy.ts`: **CP-02** expects `$50.00` but subtotal/total render `$50`; **CP-03** expects `Add $10.00 more…` but the hint uses `$10`; **CP-05** expects `$0.00` on a zero line but renders `$0`. Screenshots under `web/cypress/screenshots/cart.cy.ts/` for those tests.
- **Contradicts:** `docs/PRODUCT.md`: "Every price is shown in dollars with **two decimals**, everywhere: `$12.50`, never `$12.5`."
- **Suggested fix:** Format with two fraction digits (`amount.toFixed(2)`) so 0 is `$0.00`.

### F-02. A catalog load failure looks like an empty filter result

- **Where:** Browse page (`web/src/pages/BrowsePage.tsx`)
- **Category:** Pages
- **Impact:** When the catalog cannot be loaded, a customer is told nothing matches and has no way to try again.
- **Evidence:** `web/cypress/ui/browse.cy.ts`, test "shows an error with Try again when the catalog cannot be loaded", fails under `npm run cy:ui` (executed). `GET /api/plants?*` is stubbed with 500 (`web/cypress/fixtures/plants/browse-server-error.json`). The page has no `role="alert"` and no "Try again" button; it shows the heading "0 plants" and "No plants match your filters". Screenshot: `web/cypress/screenshots/browse.cy.ts/Browse page -- shows an error with Try again when the catalog cannot be loaded (failed).png`.
- **Contradicts:** `docs/PRODUCT.md`: "If the catalog can't be loaded, the page says so and offers **Try again**. It never pretends there are no plants."
- **Suggested fix:** On `plants.isError`, render an alert with Try again, and reserve the empty state for a successful response with no items.

### F-03. Quantity stepper's + button stays enabled at the stock limit

- **Where:** `QuantityStepper` component (`web/src/components/QuantityStepper.tsx`), used on the plant page and in cart lines
- **Category:** Components
- **Impact:** A customer can raise the quantity one above the stock left, asking for a plant the shop doesn't have.
- **Evidence:** `web/cypress/component/QuantityStepper.cy.tsx`, test "disables + at the stock limit", fails under `npm run cy:component`. `web/cypress/ui/cart.cy.ts`, **CP-10** (executed): cart line at quantity 3 with stock 3 leaves **Increase quantity** enabled. Screenshots: `web/cypress/screenshots/QuantityStepper.cy.tsx/…` and `web/cypress/screenshots/cart.cy.ts/Cart page -- CP-10 … (failed).png`.
- **Contradicts:** `docs/PRODUCT.md`: "**Quantity** starts at 1 and can never go above the stock left: at the stock limit, the **+** button is disabled."
- **Suggested fix:** Disable + when `value >= max` instead of `value > max`.

### F-04. A rejected cart quantity change shows no error toast

- **Where:** Cart page (`web/src/pages/CartPage.tsx`) when `PATCH /api/cart/lines/{lineId}` fails
- **Category:** Pages
- **Impact:** When the shop rejects a quantity change (for example not enough stock), the customer gets no feedback; the quantity stays the same with no explanation.
- **Evidence:** `web/cypress/ui/cart.cy.ts`, **CP-13** (executed): stubbed PATCH returns 400 `{ detail: "Not enough stock left." }`; quantity stays 1 but no `role="status"` toast with that message. Screenshot: `web/cypress/screenshots/cart.cy.ts/Cart page -- CP-13 … (failed).png`.
- **Contradicts:** `docs/APP-MAP.md` `/cart`: "**Change rejected:** error toast with the API's `detail`."
- **Suggested fix:** Ensure failed `updateLine` / `removeLine` mutations surface `error.message` in the cart `Toast` (same pattern as the plant page add-to-cart error).

### F-05. Price: high to low sorts cheapest first

- **Where:** `listPlants` in `api/src/store.ts` (`sort=price-desc` uses the same ascending comparator as `price-asc`); Browse follows the API via `GET /api/plants`
- **Category:** Business rules in the API
- **Impact:** Choosing **Price: high to low** shows the cheapest plants first (for example Succulent Cutting at $0.99), not the most expensive.
- **Evidence:** `tests/api/plants.spec.ts`, test "GET /api/plants?sort=price-desc lists the most expensive plant first" (executed): first item price `0.99`, max in page `189`. `tests/e2e/browse.spec.ts`, test "Price: high to low shows the most expensive plant first" (executed): first card heading is "Succulent Cutting", not the Thai Constellation collector plant. Code: `case 'price-desc':` falls through with `results.sort((a, b) => a.price - b.price)`.
- **Contradicts:** `docs/PRODUCT.md`: "**Price: high to low (most expensive first)**." OpenAPI on `GET /api/plants`: `price-desc (highest first)`.
- **Suggested fix:** Sort `price-desc` with `(a, b) => b.price - a.price`.

### F-06. Plant detail JSON sends rating as a string

- **Where:** `getPlant` in `api/src/store.ts` (`rating: plant.rating.toFixed(1)`); `GET /api/plants/{plantId}`
- **Category:** The contract
- **Impact:** Clients and schema validators that expect a number (per OpenAPI) reject or mis-parse plant detail responses; list responses still use a numeric rating.
- **Evidence:** `tests/api/plants.spec.ts`, test "GET /api/plants/{plantId} returns a plant that matches Plant" (executed): Ajv error `/rating must be number`. Example body: `"rating":"4.7"` from `GET /api/plants/pl-monstera` (executed).
- **Contradicts:** OpenAPI `Plant` / `PlantSummary`: `rating` is a number (0–5). `listPlants` via `summary()` returns a number; only the detail endpoint stringifies.
- **Suggested fix:** Return `plant.rating` (or a numeric rounded value), not `toFixed(1)`.

### F-07. Plant card save buttons have no accessible name

- **Where:** `PlantCard` save (heart) control on Browse (`web/src/components/PlantCard.tsx`); same pattern on every catalog card
- **Category:** Accessibility
- **Impact:** Screen-reader users hear an unnamed button on every plant card and cannot tell what it does (save / unsave).
- **Evidence:** `tests/a11y/pages.spec.ts`, test "Browse" (executed under `npx playwright test --project=a11y`): axe `button-name`, **critical**, one failure per visible card (12 on the default page). Example target: `li:nth-child(1) > article > .PlantCard-module__save[type="button"]`; HTML is an icon-only `<button>` with `aria-pressed` and no `aria-label`. Attachments: `axe-results`, `axe-shot:Browse:button-name:*` on that run.
- **Contradicts:** `docs/PRODUCT.md`: "every button and form field has a name a screen reader can announce."
- **Suggested fix:** Add an `aria-label` that reflects saved state (for example "Save Monstera Deliciosa" / "Remove Monstera Deliciosa from saved").

### F-08. Plant detail hero image has no alternative text

- **Where:** Plant page hero `<img>` (`web/src/pages/PlantPage.tsx`)
- **Category:** Accessibility
- **Impact:** Screen-reader users get no description of the main product image on the plant page.
- **Evidence:** `tests/a11y/pages.spec.ts`, test "Plant" (executed under `npx playwright test --project=a11y`): axe `image-alt`, **critical**, target `img` — `<img class="Pages-module__heroImage" src="/plants/monstera.svg">` with no `alt`. Attachment: `axe-shot:Plant:image-alt:0`.
- **Contradicts:** `docs/PRODUCT.md`: "every meaningful image has alternative text."
- **Suggested fix:** Set `alt` to the plant name (or a short descriptive phrase including the plant name).

### F-09. Price text fails WCAG colour contrast

- **Where:** `PriceTag` (`web/src/components/PriceTag.module.css` — foreground `#8dbb8a`) on Browse cards, plant detail, cart lines, order summary, checkout
- **Category:** Accessibility
- **Impact:** Prices are hard to read for customers with low vision or on bright screens; the shop fails WCAG contrast requirements on money labels across the purchase flow.
- **Evidence:** `tests/a11y/pages.spec.ts` (executed under `npx playwright test --project=a11y`): axe `color-contrast`, **serious** — **Browse** (price on each card, ~2.18:1 on `#ffffff`); **Plant** (large price ~2.06:1 on `#f6faf3`); **Cart** (five price spans, ~2.18:1 on `#ffffff`); **Checkout** (subtotal/total, ~2.18:1). Same component: `web/cypress/component/PriceTag.cy.tsx`, test "PT-16 meets contrast on page background for each size" (executed under `npm run cy:component`). Screenshot: `web/cypress/screenshots/PriceTag.cy.tsx/PriceTag -- PT-16 meets contrast on page background for each size (failed).png`.
- **Contradicts:** `docs/PRODUCT.md`: "text has enough contrast against its background (4.5:1 for normal text)." Fernly aims for **WCAG 2.1 level AA** on every page.
- **Suggested fix:** Darken price colour (or change background) so normal and large text meet 4.5:1 / 3:1 as required.

## Suspicions — not yet tested

Things that look different from `docs/PRODUCT.md` (or the API contract), from reading the code and walking the app once. Each one needs a test before it becomes a finding. "Seen" means it showed up once on the walk; "code" means it comes from reading the source only.

- **Plant page after a "Likes the same light" link** (Caching) — seen: the address bar said `/plants/pl-fiddle` while the page still showed Bird of Paradise at $50; code: `usePlant` caches every plant under the same key `['plant']`, so Add to cart may add the wrong plant. *May contradict:* "The plant page always shows the plant in the address bar, including after following a "Likes the same light" link."
- **`PriceTag` / `formatPrice` two-decimal display** (Components) — **Evidence:** `web/cypress/component/PriceTag.cy.tsx`, rows PT-01, PT-02, PT-04, PT-07, PT-11, PT-12, PT-13 fail under `npm run cy:component` (executed). Examples: `amount={12.5}` renders `$12.5` not `$12.50`; `amount={50}` → `$50`; `amount={0}` → `$0`; `0.1 + 0.2` → `$0.3`; labelled mount renders `Subtotal: $12.5`. Same root as F-01 (`web/src/money.ts`). Screenshots under `web/cypress/screenshots/PriceTag.cy.tsx/`. *May contradict:* the same two-decimals line as F-01.
- **`formatPrice` on other surfaces** (Components) — F-01 covers Browse (zero price); Cart (CP-02, CP-03, CP-05); PriceTag component rows above. Still not tested: plant page, size deltas, checkout, orders. *May contradict:* the same two-decimals line as F-01.
- **Order page after signing out and in as another customer** (Caching / Authorization) — code: sign-out drops the cached cart and order list but not single orders (`['order', id]`), so the second customer may briefly see the first customer's order from the cache. *May contradict:* "An order is private: only the customer who placed it can see it. Anyone else gets "Order not found"" and "Signing out forgets the session on this device."
- **`CareLevelBadge` for level 3** (Components) — seen: three-dot plants (Fiddle Leaf Fig, Calathea Orbifolia, String of Pearls) say "Moderate care"; code: `LABELS[Math.min(level, 2) - 1]`. *May contradict:* "Care level has three steps: 1 **Easy**, 2 **Moderate**, 3 **Expert**." and the contract's `careLevel` "1 Easy, 2 Moderate, 3 Expert."
- **Plant page quantity after a "Likes the same light" link** (Pages) — code: quantity and size are page state that isn't reset when the plant id changes. *May contradict:* "**Quantity** starts at 1 …"
- **Search box input** (Accessibility) — seen: the accessibility tree lists a `searchbox` with no name; code: "Search plants" is a visual hint, not a label. Browse axe scan (`tests/a11y/pages.spec.ts`, test "Browse") did not report a separate rule failure for it (not yet tested with a dedicated assertion). *May contradict:* "every button and form field has a name a screen reader can announce."
- **Search box focus** (Accessibility) — code: `.input { outline: none; }` in `SearchBox.module.css`, with no other focus style on the input or form. *May contradict:* "everything works with the keyboard alone, and focus is always visible."
- **Page titles** (Accessibility) — seen: every page, including Cart, Checkout and "Page not found", has the title "Fernly — plants for every windowsill". *May contradict:* "Fernly aims for **WCAG 2.1 level AA** on every page" (WCAG 2.4.2 Page Titled).

### Rules to prove next (no sign of a problem yet, but `docs/PRODUCT.md` stresses them)

- Remaining sort modes (featured, price-asc, name, best rated) through `GET /api/plants` and the UI — **price-desc** covered by F-05 (executed).
- Shipping at the boundary — "**Shipping costs $6.95, and is free when the subtotal is $50.00 or more.**": Bird of Paradise at exactly $50, and a subtotal just below.
- Order privacy at the API — Ben requests Ava's order with `GET /api/orders/{orderId}` and must get 404 "Order not found"; the same for Ava's cart lines with `PATCH` and `DELETE /api/cart/lines/{lineId}`.
- "Placing an order charges the cart as it is, lowers the stock, and empties the cart." and "Orders are listed newest first."
- Search ignores case and matches Latin names; Low + Bright shows either; Pet-safe shows only pet-safe plants.
- "Passwords have at least 8 characters; an email can have only one account."
- Contract shape: every response field against the OpenAPI schemas, including two-decimal money values.

### Questions — neither document answers

- Should a placed order's "Paid" summary say "Add $28 more for free shipping."? It does today.
- Should `/orders` and `/orders/:orderId` call the API while signed out? Both did, and got 401, before redirecting to sign in.
- Should `POST /api/admin/reset` work without signing in? The contract declares no security for it.
- Should `/login?next=//other-site.example` be allowed? `next` is only checked for a leading `/`.
- Should the checkout accept fields that are only spaces? The form has `noValidate`, and the contract only asks for `minLength`.
- Should a signed-in customer who opens `/login` or `/register` be redirected? The form shows again.
