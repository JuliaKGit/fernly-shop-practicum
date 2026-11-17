function stubPlantPage(reviewsFixture: string, reviewsStatus = 200): void {
  cy.intercept('GET', '/api/plants/pl-snake', { fixture: 'plant-snake.json' }).as('plant');
  cy.intercept('GET', '/api/plants?pageSize=48', { fixture: 'plants-all.json' }).as('allPlants');
  cy.intercept('GET', '/api/plants/pl-snake/reviews', {
    fixture: reviewsFixture,
    statusCode: reviewsStatus,
  }).as('reviews');
}

function visitSignedOut(reviewsFixture = 'reviews-snake.json', reviewsStatus = 200): void {
  stubPlantPage(reviewsFixture, reviewsStatus);
  cy.visit('/plants/pl-snake');
  cy.wait('@plant');
  cy.wait('@reviews');
}

function visitSignedIn(reviewsFixture = 'reviews-snake.json'): void {
  stubPlantPage(reviewsFixture);
  cy.intercept('GET', '/api/auth/me', { fixture: 'auth-ava.json' }).as('me');
  cy.intercept('GET', '/api/cart', { fixture: 'cart-empty.json' }).as('cart');
  cy.visit('/plants/pl-snake', {
    onBeforeLoad(win) {
      win.localStorage.setItem('fernly_token', 'test-token-ava');
    },
  });
  cy.wait('@me');
  cy.wait('@plant');
  cy.wait('@reviews');
}

describe('Plant page Reviews', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('R7 Reviews section list, auth gate, post toast, errors', { tags: '@ui' }, () => {
    // + mocked GET with reviews → Reviews section, average, items
    visitSignedOut('reviews-snake.json');
    cy.findByRole('heading', { name: 'Reviews' });
    cy.findByText(/4\.7 out of 5 · 3 reviews/);
    cy.findByText('Ben Moss');
    cy.findByText('My third one. Impossible to kill.');

    // − signed-out → Sign in to write a review; no form
    cy.findAllByRole('link', { name: 'Sign in' })
      .filter('[href="/login?next=/plants/pl-snake"]')
      .should('have.length', 1);
    cy.findByText(/to write a review/);
    cy.findByRole('heading', { name: 'Write a review' }).should('not.exist');

    // − GET failure → ErrorBanner + retry
    visitSignedOut('reviews-snake.json', 500);
    cy.findByRole('alert').within(() => {
      cy.findByText("Reviews couldn't be loaded.");
      cy.findByRole('button', { name: 'Try again' });
    });

    // edge empty list → empty copy + form if signed in
    visitSignedIn('reviews-empty.json');
    cy.findByText("No reviews yet. Be the first to share how it's growing.");
    cy.findByRole('heading', { name: 'Write a review' });

    // + signed-in → Write a review; successful POST → toast; list shows new review
    visitSignedIn('reviews-snake.json');
    cy.findByRole('heading', { name: 'Write a review' });

    cy.intercept('POST', '/api/plants/pl-snake/reviews', {
      statusCode: 201,
      fixture: 'review-created.json',
    }).as('postReview');
    cy.intercept('GET', '/api/plants/pl-snake/reviews', { fixture: 'reviews-after-post.json' }).as(
      'reviewsRefresh',
    );

    cy.findByRole('radio', { name: '5 stars' }).click();
    cy.findByLabelText('Your review').type('Posted from the plant page review form.');
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.wait('@postReview');
    cy.findByText('Thanks for your review!');
    cy.findByText('Posted from the plant page review form.');

    // edge POST already_reviewed → form shows API error message
    cy.intercept('POST', '/api/plants/pl-snake/reviews', {
      statusCode: 409,
      body: { detail: 'You already reviewed this plant.', rule: 'already_reviewed' },
    }).as('postDup');
    cy.findByRole('radio', { name: '4 stars' }).click();
    cy.findByLabelText('Your review').type('Trying to leave a second review here.');
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.wait('@postDup');
    cy.findByRole('alert').should('contain.text', 'You already reviewed this plant.');
  });
});
