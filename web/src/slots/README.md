# UI slots

New features add components here instead of editing the shared pages. Every `.tsx` file in a slot folder is rendered in that place, in file-name order, with the props shown.

| Folder | Rendered | Props |
| --- | --- | --- |
| `plant-page/` | On the plant page, under the description | `{ plant }` |
| `plant-card/` | On each plant card, under the tags | `{ plant }` |
| `cart-summary/` | In the cart, under the order summary | `{ cart }` |
