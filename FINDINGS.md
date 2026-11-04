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

### F-01. A plant priced at 0 is shown as $0, not $0.00

- **Where:** Browse plant card (`PriceTag` / `formatPrice` in `web/src/money.ts`)
- **Category:** Components
- **Impact:** A free plant looks unpriced, and the same formatter drops the second decimal on every other price.
- **Evidence:** `web/cypress/ui/browse.cy.ts`, test "shows $0.00 for a plant priced at 0", fails under `npm run cy:ui` (executed). The stubbed card (`price: 0` in `web/cypress/fixtures/plants/browse-zero-price.json`) renders `$0`. Screenshot: `web/cypress/screenshots/browse.cy.ts/Browse page -- shows $0.00 for a plant priced at 0 (failed).png`.
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
- **Evidence:** `web/cypress/component/QuantityStepper.cy.tsx`, test "disables + at the stock limit", fails under `npm run cy:component`. It mounts the stepper with `value={3}` and `max={3}`, and the "Increase quantity" button is not disabled. Screenshot: `web/cypress/screenshots/QuantityStepper.cy.tsx/QuantityStepper -- disables + at the stock limit (failed).png`. The other three stepper tests pass (+ and − call `onChange` with the new value, − is disabled at the minimum).
- **Contradicts:** `docs/PRODUCT.md`: "**Quantity** starts at 1 and can never go above the stock left: at the stock limit, the **+** button is disabled."
- **Suggested fix:** Disable + when `value >= max` instead of `value > max`.

## Suspicions — not yet tested

Things that look different from `docs/PRODUCT.md` (or the API contract), from reading the code and walking the app once. Each one needs a test before it becomes a finding. "Seen" means it showed up once on the walk; "code" means it comes from reading the source only.

- **Plant page after a "Likes the same light" link** (Caching) — seen: the address bar said `/plants/pl-fiddle` while the page still showed Bird of Paradise at $50; code: `usePlant` caches every plant under the same key `['plant']`, so Add to cart may add the wrong plant. *May contradict:* "The plant page always shows the plant in the address bar, including after following a "Likes the same light" link."
- **`formatPrice` on other surfaces** (Components) — F-01 proves a Browse card priced at 0 renders `$0`. Still not tested: plant page, size deltas, cart, and checkout, where the same formatter was seen as `$22`, `$27.5`, `$12.5`, `$50`, `+$6`. *May contradict:* the same two-decimals line as F-01.
- **Cart line stepper** (Components / Business rules in the API) — code: the same stepper as F-03 lets a cart line ask for stock + 1, so only the API's `stock_limit` stands in the way. *May contradict:* "A line can never hold more than the plant's stock."
- **Order page after signing out and in as another customer** (Caching / Authorization) — code: sign-out drops the cached cart and order list but not single orders (`['order', id]`), so the second customer may briefly see the first customer's order from the cache. *May contradict:* "An order is private: only the customer who placed it can see it. Anyone else gets "Order not found"" and "Signing out forgets the session on this device."
- **`CareLevelBadge` for level 3** (Components) — seen: three-dot plants (Fiddle Leaf Fig, Calathea Orbifolia, String of Pearls) say "Moderate care"; code: `LABELS[Math.min(level, 2) - 1]`. *May contradict:* "Care level has three steps: 1 **Easy**, 2 **Moderate**, 3 **Expert**." and the contract's `careLevel` "1 Easy, 2 Moderate, 3 Expert."
- **Plant page quantity after a "Likes the same light" link** (Pages) — code: quantity and size are page state that isn't reset when the plant id changes. *May contradict:* "**Quantity** starts at 1 …"
- **Search box input** (Accessibility) — seen: the accessibility tree lists a `searchbox` with no name; code: "Search plants" is a visual hint, not a label. *May contradict:* "every button and form field has a name a screen reader can announce."
- **`PlantCard` heart (save) button** (Accessibility) — seen: every save button has no accessible name; code: icon-only, the SVG is `aria-hidden` and there is no `aria-label`. *May contradict:* "every button and form field has a name a screen reader can announce."
- **Plant page hero image** (Accessibility) — seen and code: the `<img>` has no `alt` attribute. *May contradict:* "every meaningful image has alternative text."
- **`PriceTag` colour** (Accessibility) — seen: `#8dbb8a` on the page background `#f6faf3` measures 2.07:1, below 4.5:1 (and below the 3:1 allowed for large text). *May contradict:* "text has enough contrast against its background (4.5:1 for normal text)."
- **Search box focus** (Accessibility) — code: `.input { outline: none; }` in `SearchBox.module.css`, with no other focus style on the input or form. *May contradict:* "everything works with the keyboard alone, and focus is always visible."
- **Page titles** (Accessibility) — seen: every page, including Cart, Checkout and "Page not found", has the title "Fernly — plants for every windowsill". *May contradict:* "Fernly aims for **WCAG 2.1 level AA** on every page" (WCAG 2.4.2 Page Titled).

### Rules to prove next (no sign of a problem yet, but `docs/PRODUCT.md` stresses them)

- Sorting, especially "**Price: high to low (most expensive first)**" — test every sort through `GET /api/plants` and the UI.
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
