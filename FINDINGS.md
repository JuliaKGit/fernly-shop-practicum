# Fernly findings

One entry per proven issue, ordered by severity: money and privacy first, then broken flows, then everything else. A finding needs evidence: a failing test, or exact steps and requests. Anything not yet proven stays under "Suspicions" below.

## Entry format

```markdown
### F-NN: <one-line title: what is wrong>

- **Where:** <page, component, or endpoint>
- **Category:** <Components | Pages | Business rules in the API | The contract | Caching | Authorization | Accessibility>
- **Impact:** <the impact on a customer, in one sentence>
- **Evidence:** <the test that fails (file and test name), or the exact steps and requests>
- **Contradicts:** <the line in docs/PRODUCT.md or the API contract>
- **Suggested fix (optional):** <one line>
```

## Findings

### F-02: A plant priced 0 is shown as $0, not $0.00

- **Where:** Browse plant cards, via `PriceTag` and `formatPrice` (`web/src/money.ts`)
- **Category:** Components
- **Impact:** A free plant looks unpriced, and the shop does not keep the two-decimal prices it promises.
- **Evidence:** `web/cypress/ui/browse.cy.ts`, "shows $0.00 for a plant priced 0": the Gift Fern card renders `$0` (`npm run cy:ui`, 3 passing, 2 failing; screenshot in `web/cypress/screenshots/browse.cy.ts/`). `formatPrice` returns `` `$${Math.round(amount * 100) / 100}` ``, so a whole number never gains `.00` (inspected).
- **Contradicts:** PRODUCT.md: "Every price is shown in dollars with two decimals, everywhere: `$12.50`, never `$12.5`."
- **Suggested fix (optional):** Format with two fraction digits, for example `amount.toFixed(2)`.

### F-01: The + button stays enabled at the stock limit

- **Where:** `QuantityStepper` (`web/src/components/QuantityStepper.tsx`), used on the plant page and in the cart
- **Category:** Components
- **Impact:** A customer can raise the quantity one above the stock left before + is disabled.
- **Evidence:** `web/cypress/component/QuantityStepper.cy.tsx`, "disables + at the stock limit": mounted with value 3 and max 3, + is still enabled (`npm run cy:component`, 3 passing, 1 failing; screenshot in `web/cypress/screenshots/`)
- **Contradicts:** PRODUCT.md: "Quantity starts at 1 and can never go above the stock left: at the stock limit, the + button is disabled."
- **Suggested fix (optional):** Disable + at `value >= max` instead of `value > max`.

### F-03: A catalog load failure looks like an empty shop, with no Try again

- **Where:** Browse page (`web/src/pages/BrowsePage.tsx`)
- **Category:** Pages
- **Impact:** When the catalog cannot be loaded, a customer is told that no plants match their filters and is given no way to retry.
- **Evidence:** `web/cypress/ui/browse.cy.ts`, "shows an error and Try again when the catalog cannot be loaded": `GET /api/plants?*` stubbed with 500. The page has no `role="alert"` and no Try again button; it shows the headings "0 plants" and "No plants match your filters" (`npm run cy:ui`, 3 passing, 2 failing; screenshot in `web/cypress/screenshots/browse.cy.ts/`).
- **Contradicts:** PRODUCT.md: "If the catalog can't be loaded, the page says so and offers **Try again**. It never pretends there are no plants."
- **Suggested fix (optional):** Render `ErrorBanner` with Try again when `plants.isError`, and use the empty state only for an empty list.

## Suspicions — not yet tested

These come from reading the code and from the first walk-through of the shop. "Seen" means it showed up in the browser during mapping, which is still not a test. Each one should become a finding with a test, or be dropped.

### Money

- **Shipping is charged at exactly $50.00** (`api/src/store.ts` `cart()` uses `subtotal > FREE_SHIPPING_FROM`; seen: one Bird of Paradise, $50 subtotal, $6.95 shipping, $56.95 total) — may contradict PRODUCT.md: "Shipping costs $6.95, and is free when the subtotal is $50.00 or more."
- **"Price: high to low" lists the cheapest plant first** (`store.ts` `listPlants` uses the same ascending comparator for `price-asc` and `price-desc`; seen: `?sort=price-desc` starts with Succulent Cutting $0.99) — may contradict PRODUCT.md: "Price: high to low (most expensive first)" and OpenAPI `GET /plants`: "price-desc (highest first)".

### Privacy

- **Any signed-in customer may read any order by id** (`store.ts` `getOrder(_userId, id)` never compares the order's owner; needs Ben's token against Ava's order id) — may contradict PRODUCT.md: "An order is private: only the customer who placed it can see it. Anyone else gets 'Order not found'." and OpenAPI `GET /orders/{orderId}`: "anyone else gets 404".
- **Sign out keeps a viewed order in the cache** (`AuthContext` `signOut` removes `['cart']` and `['orders']` but not `['order', id]`, so the next customer on the same tab may briefly see the previous customer's order) — may contradict PRODUCT.md: "Signing out forgets the session on this device."
- **Any signed-in customer can delete any review** (`DELETE /api/reviews/{reviewId}` does not check authorship; executed: `tests/api/R1-delete-review.spec.ts` — Ava deletes Ben's review → 204 instead of 404) — may contradict docs/features/plant-reviews.md: "Only the author can delete a review. Anyone else gets 'Review not found'." and OpenAPI delete: "Only the author can delete a review; anyone else gets 404."

### Broken flows

- **The plant page shows the previous plant after a "Likes the same light" link** (`web/src/api/queries.ts` `usePlant` caches under `['plant']` with no id; seen: from Snake Plant, clicking ZZ Plant gives the URL `/plants/pl-zz` but still shows Snake Plant, $22, 20 in stock; Add to cart there would add Snake Plant) — may contradict PRODUCT.md: "The plant page always shows the plant in the address bar, including after following a 'Likes the same light' link."
- **A new review does not appear in the list after posting** (Reviews slot invalidates `['review', plant.id]` but the query key is `['reviews', plant.id]`; toast still shows; executed: `web/cypress/ui/plant-reviews.cy.ts` R7 and `tests/e2e/plant-reviews.spec.ts` R8) — may contradict docs/features/plant-reviews.md: "After posting, the review appears in the list right away."
- **Review average floors instead of rounding halves up** (seed Snake Plant ratings 5, 4, 5 → API average **4.6**; executed: `tests/api/R3-get-reviews.spec.ts`) — may contradict docs/features/plant-reviews.md: "The average is rounded to one decimal, halves up… show as **4.7**."

### Components and the contract

- **Care level 3 is labelled "Moderate"** (`CareLevelBadge` indexes `LABELS[Math.min(level, LABELS.length - 1) - 1]`; seen: Fiddle Leaf Fig, Calathea, String of Pearls and the Thai Monstera show "●●● Moderate care") — may contradict PRODUCT.md: "Care level has three steps: 1 Easy, 2 Moderate, 3 Expert."
- **`GET /plants/{plantId}` returns `rating` as a string** (`store.ts` `getPlant` sets `rating: plant.rating.toFixed(1)`; the page hides it with `Number(...)`) — may contradict the OpenAPI `Plant` schema: `rating` is a `number` from 0 to 5.

### Accessibility

- **Star rating radios lack `aria-checked` (and keyboard radio behavior)** (`StarRatingInput` uses `role="radio"` without `aria-checked` or arrow-key handling; executed: `web/cypress/component/StarRatingInput.cy.tsx` R4; axe `aria-required-attr` on signed-in Reviews in `tests/a11y/plant-reviews.spec.ts` R9) — may contradict docs/features/plant-reviews.md: "The star rating works with the keyboard like any group of radio buttons… a screen reader announces which star is selected."
- **The search field has no accessible name** (`SearchBox` input has no label or `aria-label`; the "Search plants" text is a decorative `<span>`; seen: the accessibility tree lists an unnamed `searchbox`) — may contradict PRODUCT.md: "every button and form field has a name a screen reader can announce".
- **The heart (save) buttons have no accessible name** (`PlantCard` button holds only an `aria-hidden` SVG; seen: all 12 heart buttons on page 1 are unnamed) — may contradict PRODUCT.md: "every button and form field has a name a screen reader can announce".
- **The plant page's main image has no alt text** (`PlantPage` `<img src={data.imageUrl} …>` has no `alt`; seen: `alt` is missing) — may contradict PRODUCT.md: "every meaningful image has alternative text".
- **Prices are low-contrast** (`PriceTag.module.css` `color: #8dbb8a` on white is about 2.2:1) — may contradict PRODUCT.md: "text has enough contrast against its background (4.5:1 for normal text)".
- **Keyboard focus in the search field is invisible** (`SearchBox.module.css` `.input { outline: none; }` overrides the global `:focus-visible` outline, and the form has no `:focus-within` style) — may contradict PRODUCT.md: "everything works with the keyboard alone, and focus is always visible."
- **Every page has the same document title** (seen: "Fernly — plants for every windowsill" on browse, plant, cart, checkout, orders and sign-in; WCAG 2.4.2 Page Titled) — may contradict PRODUCT.md: "Fernly aims for WCAG 2.1 level AA on every page".

## Questions — neither document answers

Not defects. These are open questions to settle before testing.

- The Reviews slot has no delete control even though OpenAPI and the feature doc describe author-only delete. Is delete API-only for this PR?
- The Reviews slot shows "Loading reviews…" while fetching — not specified in docs/features/plant-reviews.md. Is that the expected copy?
- The API caps a cart quantity at 20 (`quantity must be 20 or less`), but PRODUCT.md only mentions the stock limit. Should a customer be able to add 25 of Pothos (stock 30)?
- The checkout error shows the raw API text ("shippingAddress.fullName: fullName must not be empty; …") in one banner, and no field is marked invalid. Is that acceptable?
- `postalCode` needs at least 3 characters in the contract. PRODUCT.md only says a postal code is required.
- The Orders and Order pages request `/api/orders…` before the sign-in redirect (seen: `GET /api/orders` → 401 when signed out). Is that intended?
- Sign in and Create an account still show their forms to a signed-in customer. Should they redirect?
- The empty, not-found and "Page not found" screens have an h2 but no h1.
- The plant page keeps the chosen quantity and size when you move to another plant through a similar link. Should they reset?
