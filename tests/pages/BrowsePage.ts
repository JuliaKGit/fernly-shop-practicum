import type { Locator, Page } from '@playwright/test';

export class BrowsePage {
  readonly plantsCountHeading: Locator;
  readonly sortBy: Locator;
  readonly plantCards: Locator;
  readonly nextPageButton: Locator;

  constructor(private readonly page: Page) {
    this.plantsCountHeading = page.getByRole('heading', { level: 2, name: /\d+ plants/ });
    this.sortBy = page.getByLabel('Sort by');
    this.plantCards = page.getByRole('article');
    this.nextPageButton = page.getByRole('button', { name: 'Next' });
  }

  /**
   * Opens the shop home (browse catalog).
   * @returns This browse page.
   */
  async goto(): Promise<BrowsePage> {
    await this.page.goto('/');
    return this;
  }

  /**
   * Chooses a sort option in the catalog sidebar.
   * @param value Option value (for example `price-desc`).
   * @returns This browse page.
   */
  async selectSort(value: string): Promise<BrowsePage> {
    await this.sortBy.selectOption(value);
    return this;
  }

  /**
   * First plant card in the current grid order.
   * @returns Locator for the card article.
   */
  firstPlantCard(): Locator {
    return this.plantCards.first();
  }

  /**
   * Plant card whose title matches the given name.
   * @param name Visible plant name on the card.
   * @returns Locator for the card article.
   */
  plantCardByName(name: string): Locator {
    return this.page.getByRole('article').filter({
      has: this.page.getByRole('heading', { level: 3, name }),
    });
  }

  /**
   * Opens the next page of catalog results.
   * @returns This browse page.
   */
  async goToNextPage(): Promise<BrowsePage> {
    await this.nextPageButton.click();
    return this;
  }

  /**
   * Plant name heading inside a card.
   * @param card Card article locator.
   * @returns Locator for the level-3 title.
   */
  plantCardTitle(card: Locator): Locator {
    return card.getByRole('heading', { level: 3 });
  }

  /**
   * Save (heart) toggle on a plant card — icon-only button with no accessible name; scoped by card + `button` role.
   * @param card Card article locator.
   * @returns Locator for the save control.
   */
  saveButtonInCard(card: Locator): Locator {
    return card.getByRole('button');
  }
}
