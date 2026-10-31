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

None yet — nothing has been proven by a test.

## Suspicions — not yet tested

Things that look different from `docs/PRODUCT.md` (or the API contract), from reading the code and walking the app once. Each one needs a test before it becomes a finding. "Seen" means it showed up once on the walk; "code" means it comes from reading the source only.

- **Plant page after a "Likes the same light" link** (Caching) — seen: the address bar said `/plants/pl-fiddle` while the page still showed Bird of Paradise at $50; code: `usePlant` caches every plant under the same key `['plant']`, so Add to cart may add the wrong plant. *May contradict:* "The plant page always shows the plant in the address bar, including after following a "Likes the same light" link."
- **`formatPrice` / `PriceTag` / `SizePicker`** (Components) — seen: `$22`, `$27.5`, `$12.5`, `$50`, `+$6`; code: `Math.round(amount * 100) / 100` with no fixed two decimals. *May contradict:* "Every price is shown in dollars with two decimals, everywhere: `$12.50`, never `$12.5`."
- **`QuantityStepper` + button** (Components) — code: + is disabled only when `value > max`, so the quantity can go one above the stock. *May contradict:* "Quantity … can never go above the stock left: at the stock limit, the + button is disabled."
- **Cart line stepper** (Components / Business rules in the API) — code: the same stepper lets a cart line ask for stock + 1, so only the API's `stock_limit` stands in the way. *May contradict:* "A line can never hold more than the plant's stock."
- **Order page after signing out and in as another customer** (Caching / Authorization) — code: sign-out drops the cached cart and order list but not single orders (`['order', id]`), so the second customer may briefly see the first customer's order from the cache. *May contradict:* "An order is private: only the customer who placed it can see it. Anyone else gets "Order not found"" and "Signing out forgets the session on this device."
- **Browse page when the catalog fails to load** (Pages) — code: an API error renders "No plants match your filters" with no Try again button. *May contradict:* "If the catalog can't be loaded, the page says so and offers **Try again**. It never pretends there are no plants."
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
