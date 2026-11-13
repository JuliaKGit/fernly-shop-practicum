import type { Locator, Page } from '@playwright/test';

export class CheckoutPage {
  readonly heading: Locator;
  readonly fullName: Locator;
  readonly address: Locator;
  readonly city: Locator;
  readonly postalCode: Locator;
  readonly placeOrderButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1, name: 'Checkout' });
    this.fullName = page.getByLabel('Full name');
    this.address = page.getByLabel('Street address');
    this.city = page.getByLabel('City');
    this.postalCode = page.getByLabel('Postal code');
    this.placeOrderButton = page.getByRole('button', { name: 'Place order' });
  }

  async goto(): Promise<CheckoutPage> {
    await this.page.goto('/checkout');
    return this;
  }

  async fillShipping(address: {
    fullName: string;
    address: string;
    city: string;
    postalCode: string;
  }): Promise<CheckoutPage> {
    await this.fullName.fill(address.fullName);
    await this.address.fill(address.address);
    await this.city.fill(address.city);
    await this.postalCode.fill(address.postalCode);
    return this;
  }

  async placeOrder(): Promise<void> {
    await this.placeOrderButton.click();
  }

  discountRow(): Locator {
    return this.page.getByText(/^Discount/);
  }
}
