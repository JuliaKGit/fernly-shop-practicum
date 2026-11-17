import type { Locator, Page } from '@playwright/test';

export class PlantPage {
  readonly reviewsHeading: Locator;
  readonly writeReviewHeading: Locator;
  readonly reviewText: Locator;
  readonly postReviewButton: Locator;
  readonly signInToReviewLink: Locator;
  readonly thanksToast: Locator;

  constructor(private readonly page: Page) {
    this.reviewsHeading = page.getByRole('heading', { level: 2, name: 'Reviews' });
    this.writeReviewHeading = page.getByRole('heading', { name: 'Write a review' });
    this.reviewText = page.getByLabel('Your review');
    this.postReviewButton = page.getByRole('button', { name: 'Post review' });
    this.signInToReviewLink = page
      .getByRole('link', { name: 'Sign in' })
      .and(page.locator('[href*="next=/plants/"]'));
    this.thanksToast = page.getByRole('status').filter({ hasText: 'Thanks for your review!' });
  }

  /**
   * Opens a plant detail page by id.
   * @param plantId Catalog plant id (for example `pl-monstera`).
   */
  async goto(plantId: string): Promise<PlantPage> {
    await this.page.goto(`/plants/${plantId}`);
    return this;
  }

  /**
   * Average / count summary line in the Reviews section.
   */
  averageSummary(): Locator {
    return this.page.getByText(/out of 5 · \d+ reviews?/);
  }

  /**
   * Star radio for a given rating value.
   * @param stars Rating from 1 to 5.
   */
  ratingStar(stars: number): Locator {
    const name = stars === 1 ? '1 star' : `${stars} stars`;
    return this.page.getByRole('radio', { name });
  }

  /**
   * Visible review body text in the list.
   * @param text Review text content.
   */
  reviewByText(text: string): Locator {
    return this.page.getByText(text);
  }

  /**
   * Form validation or API error alert under Write a review.
   */
  formAlert(): Locator {
    return this.page.getByRole('alert');
  }

  /**
   * Sign-in prompt copy for guests in the Reviews section.
   */
  signInPrompt(): Locator {
    return this.page.getByText(/to write a review/);
  }
}
