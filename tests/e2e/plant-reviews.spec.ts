import { expect, test } from '@playwright/test';
import { PlantPage } from '../pages/PlantPage';
import { SignInPage } from '../pages/SignInPage';

test('R8 Plant page reviews live read/write and one-per-plant', { tag: '@e2e' }, async ({
  page,
}) => {
  const plantId = 'pl-peace-lily';
  const reviewText = `Peace Lily review ${Date.now()} looks great after a week.`;

  // − signed-out → sign-in prompt, not the form
  const guest = await new PlantPage(page).goto(plantId);
  await expect(guest.reviewsHeading).toBeVisible();
  await expect(guest.signInPrompt()).toBeVisible();
  await expect(guest.signInToReviewLink).toHaveAttribute(
    'href',
    `/login?next=/plants/${plantId}`,
  );
  await expect(guest.writeReviewHeading).toHaveCount(0);

  // + open seeded plant with reviews → average/count (use pl-monstera for seeded list)
  const seeded = await new PlantPage(page).goto('pl-monstera');
  await expect(seeded.reviewsHeading).toBeVisible();
  await expect(seeded.averageSummary()).toBeVisible();
  await expect(seeded.averageSummary()).toContainText('out of 5');

  // + sign in as a customer who has not reviewed that plant → post → toast; appears without reload
  const plant = await new SignInPage(page).signInAndOpenPlant(
    process.env.FERNLY_USER_EMAIL!,
    process.env.FERNLY_USER_PASSWORD!,
    plantId,
  );
  await expect(plant.writeReviewHeading).toBeVisible();
  await plant.ratingStar(5).click();
  await plant.reviewText.fill(reviewText);
  await plant.postReviewButton.click();
  await expect(plant.thanksToast).toBeVisible();
  await expect(plant.reviewByText(reviewText)).toBeVisible();

  // − same customer posts again → blocked / error (one per plant)
  await plant.ratingStar(4).click();
  await plant.reviewText.fill('A second review should be rejected by the API.');
  await plant.postReviewButton.click();
  await expect(plant.formAlert()).toBeVisible();
  await expect(plant.formAlert()).toContainText(/already reviewed/i);
});
