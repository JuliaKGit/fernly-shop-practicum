# Fernly app map

A map of the shop before testing: what each page shows, which components it is built from, and which API endpoints it calls.

Sources: `CHALLENGE.md`, `docs/PRODUCT.md`, the OpenAPI document at `http://localhost:8100/openapi.json`, the code in `web/src/pages`, `web/src/components`, `web/src/api`, and a walk-through of every page at `http://localhost:5173`, signed out and signed in as Ava (`ava@fernly.test`). The walk-through placed one order. Afterwards the data was reset with `POST /api/admin/reset`.

All API paths start with `/api`. The web app calls them through the Vite dev-server proxy (`web/src/api/client.ts`) and sends `Authorization: Bearer <token>` whenever `localStorage.fernly_token` is set. Server data is cached with TanStack Query (`web/src/api/queries.ts`).

## 1. Pages

Every page renders inside `Layout`, so the layout's calls (`GET /auth/me`, `GET /cart`) happen on every page.

| Path | What it shows | API calls it makes | Its states (loading, empty, error, signed out) |
| --- | --- | --- | --- |
| *(all pages)* `Layout` — `pages/Layout.tsx` | "Skip to content" link; header with the Fernly logo; Shop; Orders (only when signed in); Cart with a badge showing `cart.itemCount` (hidden at 0); "Hi, {first name}" + Sign out, or Sign in; the footer. | `GET /auth/me` once on load if a token is saved (`AuthContext`); `GET /cart` while signed in (`useCart`, key `['cart']`). Sign out makes no call: it removes the token and drops the cached `['cart']` and `['orders']` queries. | Loading: the badge is hidden until the cart arrives. Error: if `/auth/me` fails, the token is removed and you are signed out. Signed out: no Orders link, no badge, Sign in link. |
| `/` — `BrowsePage` | Hero heading; filters sidebar (`SearchBox`, `LightFilter`, "Pet-safe plants only" checkbox, `SortSelect`); "N plants" heading; a grid of `PlantCard`s (12 per page); Previous / "Page X of Y" / Next. Filters live in the URL (`search`, `light`, `petSafe`, `sort`, `page`); changing a filter resets to page 1. Saved hearts are stored in `localStorage.fernly_saved` only. Walk-through: 21 plants, 2 pages. | `GET /plants?[search=][&light=low,bright][&petSafe=true]&sort=<sort>&page=<n>` (key `['plants', filters]`). | Loading: heading "Loading plants…" + 6 skeleton tiles. Empty: `EmptyState` "No plants match your filters / Try another search or clear a filter." Error: **the same "No plants match your filters" empty state, with no Try again** (`plants.isError \|\| !data?.items.length`). Signed out: same page for everyone. |
| `/plants/:plantId` — `PlantPage` | Hero image; breadcrumb "Shop / {light}"; name (h1); Latin name; `CareLevelBadge`, `PetSafeTag`, light tag, rating "★ 4.8"; description; `PriceTag` (base price + size delta); `SizePicker`; `QuantityStepper` (max = stock); Add to cart; "N in stock" / "Out of stock right now."; `PlantPageSlot`; "Likes the same light" links (up to 3). | `GET /plants/:plantId` (key **`['plant']`**, without the id); `GET /plants?pageSize=48` (key `['plants','all']`, used only to show the similar plants' names); `POST /cart/lines` `{plantId, size, quantity}` on Add to cart. | Loading: "Loading plant…". Not found (404): `EmptyState` "We couldn't find that plant" + "Back to the shop". Other error: `ErrorBanner` "The plant couldn't be loaded." + Try again. Out of stock: stepper and button disabled, button reads "Out of stock". Add success: `Toast` "Added N × {name} to your cart."; add error: error `Toast` with the API message. Signed out: page is visible; Add to cart navigates to `/login?next=/plants/:plantId`. |
| `/login` — `LoginPage` | "Sign in" form: Email, Password, Sign in button, "Create an account" link (keeps `next`). | `POST /auth/login` `{email, password}`; on success the token is saved and `['cart']` is refetched (`GET /cart`). | Busy: button "Signing in…" (disabled). Error: `ErrorBanner` with the API message (e.g. "Email or password is incorrect."). Success: navigates to `next` if it starts with `/`, else `/`. Signed in: the form still shows (no redirect). |
| `/register` — `RegisterPage` | "Create an account" form: Name, Email, Password (hint "At least 8 characters."), Create account, "Sign in" link (keeps `next`). | `POST /auth/register` `{name, email, password}`; then `GET /cart`. | Busy: "Creating…". Error: `ErrorBanner` with the API message (validation or "An account with this email already exists."). Success: navigates to `next`. Signed in: the form still shows. |
| `/cart` — `CartPage` | "Your cart" (h1); a list of `CartLine`s (image, name, size, price each, `QuantityStepper`, line total, Remove); `OrderSummary` (subtotal, shipping or "Free", total, "Add $X more for free shipping."); `CartSummarySlot`; "Go to checkout" link. | `GET /cart`; `PATCH /cart/lines/:lineId` `{quantity}` from the stepper; `DELETE /cart/lines/:lineId` from Remove. Both write the returned cart into `['cart']`. | Auth not ready: "Loading…". Signed out: redirect to `/login?next=/cart`. Loading: "Loading your cart…". Error: `ErrorBanner` "Your cart couldn't be loaded." + Try again. Empty: `EmptyState` "Your cart is empty / Plants you add will show up here." + "Browse plants". Busy: all steppers and Remove buttons disabled while a change is pending. Update/remove error: error `Toast` with the API message. |
| `/checkout` — `CheckoutPage` | "Checkout" (h1); "Shipping address" form (Full name, Street address, City, Postal code — browser validation off, `noValidate`); Place order; `OrderSummary`. | `GET /cart`; `POST /orders` `{shippingAddress}`. On success it refetches `['cart']`, `['orders']`, `['plants']` and navigates to `/orders/:id?placed=1`. | Auth not ready: "Loading…". Signed out: redirect to `/login?next=/checkout`. Loading: "Loading your cart…". Cart error: `ErrorBanner` + Try again. Empty: `EmptyState` "Your cart is empty / Add a plant before you check out." (no link). Pending: "Placing order…". Order error: `ErrorBanner` with the raw API message (walk-through, empty form: "shippingAddress.fullName: fullName must not be empty; …"), no Try again. |
| `/orders` — `OrdersPage` | "Your orders" (h1); one row per order: "Order {id}" link, date (en-CA), "N line(s)", total `PriceTag`. | `GET /orders` (key `['orders']`). The query is not gated on sign-in: a signed-out visit still sends it (walk-through: `401`) before redirecting. | Auth not ready: "Loading…". Signed out: redirect to `/login?next=/orders`. Loading: "Loading your orders…". Error: `ErrorBanner` "Your orders couldn't be loaded." + Try again. Empty: `EmptyState` "No orders yet / Your orders will show up here." |
| `/orders/:orderId` — `OrderPage` | Optional "Thank you! Your order is placed." (`role="status"`, when `?placed=1`); "Order {id}" (h1); "Placed {date} · Ships to {fullName}, {city}"; lines "Q × name (size S)" with line totals; `OrderSummary` titled "Paid" (item count summed from the lines). | `GET /orders/:orderId` (key `['order', orderId]`; not gated on sign-in). | Auth not ready: "Loading…". Signed out: redirect to `/login?next=/orders/:orderId`. Loading: "Loading order…". 404: `EmptyState` "Order not found" + "Back to your orders". Other error: `ErrorBanner` "The order couldn't be loaded." + Try again. |
| `*` (any other path) — `App.tsx` | `EmptyState` "Page not found" + "Back to the shop". | Only the layout's calls. | One state. Same for signed in and signed out. |

## 2. Components

Props are taken from each component's TypeScript props type. `CareLevelBadge` and `PetSafeTag` declare an inline type rather than a named interface. "Pages that use it" counts both direct use and use through another component.

| Name | File | Props (from its TypeScript interface) | What it shows | Pages that use it |
| --- | --- | --- | --- | --- |
| `PlantCard` | `web/src/components/PlantCard.tsx` | `plant: PlantSummary`; `saved?: boolean` (default `false`); `onToggleSave?: (plantId: string) => void` | Image linking to the plant (alt = plant name) with an "Out of stock" label at stock 0; a heart save toggle (`aria-pressed`, only if `onToggleSave` is given, icon only); name link (h3); Latin name; `CareLevelBadge`; `PetSafeTag`; `PlantCardSlot`; `PriceTag` for the base price; rating "★ 4.7" + hidden "out of 5". | Browse |
| `PriceTag` | `web/src/components/PriceTag.tsx` | `amount: number`; `size?: 'sm' \| 'md' \| 'lg'` (default `'md'`); `label?: string` (read by screen readers before the price, not shown) | The amount formatted by `formatPrice` (`web/src/money.ts`), in green `#8dbb8a`. | Browse (via `PlantCard`), Plant, Cart (via `CartLine`, `OrderSummary`), Checkout (via `OrderSummary`), Orders, Order |
| `CareLevelBadge` | `web/src/components/CareLevelBadge.tsx` | `{ level: 1 \| 2 \| 3 }` | One to three dots (hidden from screen readers) + "{Easy \| Moderate \| Expert} care"; tooltip "How much care this plant needs". | Browse (via `PlantCard`), Plant |
| `PetSafeTag` | `web/src/components/PetSafeTag.tsx` | `{ petSafe: boolean }` | "🐾 Pet safe" or "⚠ Not pet safe" (icon hidden from screen readers). | Browse (via `PlantCard`), Plant |
| `SearchBox` | `web/src/components/SearchBox.tsx` | `value: string`; `onSearch: (value: string) => void` | A `role="search"` form: search input with a visual "Search plants" hint (a `<span>`, not a label or placeholder); "Clear search" × button when there is text; Search button. Submits the trimmed text. | Browse |
| `LightFilter` | `web/src/components/LightFilter.tsx` | `value: Light[]`; `onChange: (value: Light[]) => void` | Fieldset "Light" with checkboxes Low light, Medium light, Bright light; toggling adds or removes that value. | Browse |
| `SortSelect` | `web/src/components/SortSelect.tsx` | `value: Sort`; `onChange: (value: Sort) => void` | "Sort by" select: Featured, Price: low to high, Price: high to low, Name: A to Z, Best rated. | Browse |
| `SizePicker` | `web/src/components/SizePicker.tsx` | `sizes: { label: SizeLabel; priceDelta: number }[]`; `value: SizeLabel`; `onChange: (size: SizeLabel) => void`; `name?: string` (default `'size'`) | Fieldset "Size" with radios Small / Medium / Large, each showing "Base price" or "+{formatPrice(delta)}". | Plant |
| `QuantityStepper` | `web/src/components/QuantityStepper.tsx` | `value: number`; `onChange: (value: number) => void`; `min?: number` (default `1`); `max: number` (the stock left); `disabled?: boolean` (default `false`); `label?: string` (default `'Quantity'`) | A `role="group"` with "Decrease quantity" −, the value in an `aria-live` `<output>`, and "Increase quantity" +. − is disabled at `value <= min`; + is disabled at **`value > max`**. | Plant, Cart (via `CartLine`) |
| `CartLine` | `web/src/components/CartLine.tsx` | `line: CartLine`; `onQuantityChange: (lineId: string, quantity: number) => void`; `onRemove: (lineId: string) => void`; `busy?: boolean` (default `false`) | A cart row: image (`alt=""`), name, "Size S · $X each", `QuantityStepper` labelled "Quantity of {name}" with `max = line.stock`, line total `PriceTag`, "Remove" button labelled "Remove {name}". | Cart |
| `OrderSummary` | `web/src/components/OrderSummary.tsx` | `itemCount: number`; `subtotal: number`; `shipping: number`; `total: number`; `title?: string` (default `'Order summary'`). Also exports `FREE_SHIPPING_FROM = 50`. | Section with a heading; rows "Subtotal (N items)", "Shipping" ("Free" when shipping is 0 and there are items, else the amount), "Total"; "Add $X more for free shipping." when there are items and the subtotal is under $50. It shows the amounts the API sends; it does not compute shipping. | Cart, Checkout, Order |
| `EmptyState` | `web/src/components/Feedback.tsx` | `title: string`; `message?: string`; `action?: ReactNode` | 🌱 icon, the title as an **h2**, optional message and action (usually a link). | Browse, Plant, Cart, Checkout, Orders, Order, Not found |
| `ErrorBanner` | `web/src/components/Feedback.tsx` | `message: string`; `onRetry?: () => void` | A `role="alert"` box with the message and, if `onRetry` is given, a "Try again" button. | Plant, Cart, Checkout, Orders, Order, Sign in, Create an account |
| `Toast` | `web/src/components/Feedback.tsx` | `message: string`; `tone?: 'success' \| 'error'` (default `'success'`); `onClose: () => void`; `duration?: number` (ms, default `4000`; `0` keeps it open) | A `role="status"` message with a "Dismiss" × button; closes itself after `duration`. | Plant, Cart |

The slot components in `web/src/slots/Slot.tsx` (`PlantPageSlot`, `PlantCardSlot`, `CartSummarySlot`) render whatever feature files are dropped into `src/slots/*/`. They render nothing today.

## 3. API

Sign-in requirements come from the OpenAPI `security` entries and match the code (`requireUser` in `api/src/app.ts`). A missing or bad token returns `401` with `rule: auth_required`.

| Method and path | Used by which page | Needs sign-in? |
| --- | --- | --- |
| `GET /api/health` | No page (tools and tests only) | No |
| `POST /api/admin/reset` | No page (tools and tests only) | No |
| `GET /api/plants` | Browse (one page of results, with filters); Plant (`pageSize=48`, for the similar plants' names) | No |
| `GET /api/plants/{plantId}` | Plant | No |
| `POST /api/auth/register` | Create an account | No |
| `POST /api/auth/login` | Sign in | No |
| `GET /api/auth/me` | Every page, through `Layout`/`AuthProvider`, once on load when a token is saved | Yes |
| `GET /api/cart` | Every page while signed in (header badge); Cart; Checkout | Yes |
| `POST /api/cart/lines` | Plant (Add to cart) | Yes |
| `PATCH /api/cart/lines/{lineId}` | Cart (quantity stepper) | Yes |
| `DELETE /api/cart/lines/{lineId}` | Cart (Remove) | Yes |
| `POST /api/orders` | Checkout (Place order) | Yes |
| `GET /api/orders` | Orders | Yes |
| `GET /api/orders/{orderId}` | Order | Yes |

Contract notes that matter for testing:

- Rejected requests return `{ detail, rule? }`. `404` responses have no `rule`.
- `GET /plants`: `pageSize` is 1–48 (default 12). `sort` is one of `featured`, `price-asc`, `price-desc`, `name`, `rating`.
- Cart quantities must be whole numbers from 1 to 20 (`CartLineCreate`, `CartLineUpdate`), and a line can never exceed the stock (`stock_limit`).
- `ShippingAddress`: every field is non-empty after trimming, and `postalCode` has at least 3 characters.
- Money fields are documented as "Dollars, two decimals." `Plant.rating` and `PlantSummary.rating` are numbers from 0 to 5.
