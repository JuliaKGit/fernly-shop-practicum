import type { Locator, Page } from '@playwright/test';

export class CartPage {
  readonly heading: Locator;
  readonly promoInput: Locator;
  readonly applyButton: Locator;
  readonly removePromoButton: Locator;
  readonly orderSummary: Locator;
  readonly checkoutLink: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Your cart' });
    /** Promo code field — PRODUCT requires a visible accessible name; queried by textbox role until labelled. */
    this.promoInput = page.getByRole('textbox');
    this.applyButton = page.getByRole('button', { name: 'Apply' });
    this.removePromoButton = page.getByRole('button', { name: 'Remove' });
    this.orderSummary = page.getByRole('region', { name: 'Order summary' }).or(
      page.locator('section').filter({ has: page.getByRole('heading', { name: 'Order summary' }) }),
    );
    this.checkoutLink = page.getByRole('link', { name: 'Go to checkout' });
  }

  async goto(): Promise<CartPage> {
    await this.page.goto('/cart');
    return this;
  }

  async applyPromo(code: string): Promise<CartPage> {
    await this.promoInput.fill(code);
    await this.applyButton.click();
    return this;
  }

  async removePromo(): Promise<CartPage> {
    await this.removePromoButton.click();
    return this;
  }

  discountRow(): Locator {
    return this.page.getByText(/^Discount/);
  }

  totalRow(): Locator {
    return this.page.getByText('Total', { exact: true });
  }
}
