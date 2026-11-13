import type { Locator, Page } from '@playwright/test';

export class PlantPage {
  readonly heading: Locator;
  readonly addToCartButton: Locator;

  constructor(private readonly page: Page) {
    this.heading = page.getByRole('heading', { level: 1 });
    this.addToCartButton = page.getByRole('button', { name: 'Add to cart' });
  }

  async goto(plantId: string): Promise<PlantPage> {
    await this.page.goto(`/plants/${plantId}`);
    return this;
  }

  async addToCart(): Promise<PlantPage> {
    await this.addToCartButton.click();
    return this;
  }
}
