import type { Locator, Page } from '@playwright/test';
import { PlantPage } from './PlantPage';

export class SignInPage {
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(private readonly page: Page) {
    this.email = page.getByLabel('Email');
    this.password = page.getByLabel('Password');
    this.submit = page.getByRole('button', { name: 'Sign in' });
  }

  /**
   * Opens the sign-in page, optionally with a next path.
   * @param next Optional relative path for post-login redirect.
   */
  async goto(next?: string): Promise<SignInPage> {
    const url = next ? `/login?next=${encodeURIComponent(next)}` : '/login';
    await this.page.goto(url);
    return this;
  }

  /**
   * Signs in with email and password.
   * @param email Customer email.
   * @param password Customer password.
   */
  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }

  /**
   * Signs in and lands on a plant page via next param.
   * @param email Customer email.
   * @param password Customer password.
   * @param plantId Plant to open after sign-in.
   */
  async signInAndOpenPlant(email: string, password: string, plantId: string): Promise<PlantPage> {
    await this.goto(`/plants/${plantId}`);
    await this.signIn(email, password);
    return new PlantPage(this.page);
  }
}
