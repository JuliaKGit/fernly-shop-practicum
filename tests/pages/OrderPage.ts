import type { Locator, Page } from '@playwright/test';

export class OrderPage {
  readonly paidHeading: Locator;

  constructor(private readonly page: Page) {
    this.paidHeading = page.getByRole('heading', { name: 'Paid' });
  }

  discountRow(): Locator {
    return this.page.getByText(/^Discount/);
  }

  emptyCartHeading(): Locator {
    return this.page.getByRole('heading', { name: 'Your cart is empty' });
  }
}
