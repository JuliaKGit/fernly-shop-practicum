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

None yet. Nothing below has been proven by a test.

## Suspicions — not yet tested

These come from reading the code and from the first walk-through of the shop. "Seen" means it showed up in the browser during mapping, which is still not a test. Each one should become a finding with a test, or be dropped.

### Money

- **Shipping is charged at exactly $50.00** (`api/src/store.ts` `cart()` uses `subtotal > FREE_SHIPPING_FROM`; seen: one Bird of Paradise, $50 subtotal, $6.95 shipping, $56.95 total) — may contradict PRODUCT.md: "Shipping costs $6.95, and is free when the subtotal is $50.00 or more."
- **Prices drop trailing zeros** (`web/src/money.ts` `formatPrice` returns `$22`, `$27.5`, `+$6`; seen on cards, the plant page, the cart and the order) — may contradict PRODUCT.md: "Every price is shown in dollars with two decimals, everywhere: `$12.50`, never `$12.5`."
- **"Price: high to low" lists the cheapest plant first** (`store.ts` `listPlants` uses the same ascending comparator for `price-asc` and `price-desc`; seen: `?sort=price-desc` starts with Succulent Cutting $0.99) — may contradict PRODUCT.md: "Price: high to low (most expensive first)" and OpenAPI `GET /plants`: "price-desc (highest first)".

### Privacy

- **Any signed-in customer may read any order by id** (`store.ts` `getOrder(_userId, id)` never compares the order's owner; needs Ben's token against Ava's order id) — may contradict PRODUCT.md: "An order is private: only the customer who placed it can see it. Anyone else gets 'Order not found'." and OpenAPI `GET /orders/{orderId}`: "anyone else gets 404".
- **Sign out keeps a viewed order in the cache** (`AuthContext` `signOut` removes `['cart']` and `['orders']` but not `['order', id]`, so the next customer on the same tab may briefly see the previous customer's order) — may contradict PRODUCT.md: "Signing out forgets the session on this device."

### Broken flows

- **The plant page shows the previous plant after a "Likes the same light" link** (`web/src/api/queries.ts` `usePlant` caches under `['plant']` with no id; seen: from Snake Plant, clicking ZZ Plant gives the URL `/plants/pl-zz` but still shows Snake Plant, $22, 20 in stock; Add to cart there would add Snake Plant) — may contradict PRODUCT.md: "The plant page always shows the plant in the address bar, including after following a 'Likes the same light' link."
- **The + button stays enabled at the stock limit** (`QuantityStepper` disables + at `value > max`, not `value >= max`; seen: String of Pearls has 1 in stock, and + went to 2 before disabling; the same stepper is used in the cart) — may contradict PRODUCT.md: "Quantity … can never go above the stock left: at the stock limit, the + button is disabled."
- **A catalog load failure looks like "no matching plants", with no Try again** (`BrowsePage` renders the same `EmptyState` for `plants.isError` and for an empty list) — may contradict PRODUCT.md: "If the catalog can't be loaded, the page says so and offers Try again. It never pretends there are no plants."

### Components and the contract

- **Care level 3 is labelled "Moderate"** (`CareLevelBadge` indexes `LABELS[Math.min(level, LABELS.length - 1) - 1]`; seen: Fiddle Leaf Fig, Calathea, String of Pearls and the Thai Monstera show "●●● Moderate care") — may contradict PRODUCT.md: "Care level has three steps: 1 Easy, 2 Moderate, 3 Expert."
- **`GET /plants/{plantId}` returns `rating` as a string** (`store.ts` `getPlant` sets `rating: plant.rating.toFixed(1)`; the page hides it with `Number(...)`) — may contradict the OpenAPI `Plant` schema: `rating` is a `number` from 0 to 5.

### Accessibility

- **The search field has no accessible name** (`SearchBox` input has no label or `aria-label`; the "Search plants" text is a decorative `<span>`; seen: the accessibility tree lists an unnamed `searchbox`) — may contradict PRODUCT.md: "every button and form field has a name a screen reader can announce".
- **The heart (save) buttons have no accessible name** (`PlantCard` button holds only an `aria-hidden` SVG; seen: all 12 heart buttons on page 1 are unnamed) — may contradict PRODUCT.md: "every button and form field has a name a screen reader can announce".
- **The plant page's main image has no alt text** (`PlantPage` `<img src={data.imageUrl} …>` has no `alt`; seen: `alt` is missing) — may contradict PRODUCT.md: "every meaningful image has alternative text".
- **Prices are low-contrast** (`PriceTag.module.css` `color: #8dbb8a` on white is about 2.2:1) — may contradict PRODUCT.md: "text has enough contrast against its background (4.5:1 for normal text)".
- **Keyboard focus in the search field is invisible** (`SearchBox.module.css` `.input { outline: none; }` overrides the global `:focus-visible` outline, and the form has no `:focus-within` style) — may contradict PRODUCT.md: "everything works with the keyboard alone, and focus is always visible."
- **Every page has the same document title** (seen: "Fernly — plants for every windowsill" on browse, plant, cart, checkout, orders and sign-in; WCAG 2.4.2 Page Titled) — may contradict PRODUCT.md: "Fernly aims for WCAG 2.1 level AA on every page".

## Questions — neither document answers

Not defects. These are open questions to settle before testing.

- The API caps a cart quantity at 20 (`quantity must be 20 or less`), but PRODUCT.md only mentions the stock limit. Should a customer be able to add 25 of Pothos (stock 30)?
- The checkout error shows the raw API text ("shippingAddress.fullName: fullName must not be empty; …") in one banner, and no field is marked invalid. Is that acceptable?
- `postalCode` needs at least 3 characters in the contract. PRODUCT.md only says a postal code is required.
- The Orders and Order pages request `/api/orders…` before the sign-in redirect (seen: `GET /api/orders` → 401 when signed out). Is that intended?
- Sign in and Create an account still show their forms to a signed-in customer. Should they redirect?
- The empty, not-found and "Page not found" screens have an h2 but no h1.
- The plant page keeps the chosen quantity and size when you move to another plant through a similar link. Should they reset?
