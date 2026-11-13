function signInAndOpenCart(cartFixture: string): void {
  cy.intercept('GET', '/api/auth/me', { fixture: 'auth/me.json' }).as('me');
  cy.intercept('GET', '/api/cart', { fixture: cartFixture }).as('cart');
  cy.visit('/cart', {
    onBeforeLoad(win) {
      win.localStorage.setItem('fernly_token', 'test-token');
    },
  });
  cy.wait('@me');
  cy.wait('@cart');
  cy.findByRole('heading', { name: 'Your cart' });
}

describe('Cart page promo', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it(
    'P10: promo field apply/remove updates summary; invalid leaves totals; replace via UI',
    { tags: '@ui' },
    () => {
      // Positive: promo field + Apply; successful apply updates summary and applied state
      signInAndOpenCart('cart/with-snake.json');
      cy.findByRole('button', { name: 'Apply' }).should('exist');
      cy.findByRole('textbox').should('exist');

      cy.intercept('POST', '/api/cart/promo', { fixture: 'cart/with-snake-leafy10.json' }).as('applyLeafy');
      cy.findByRole('textbox').type('LEAFY10');
      cy.findByRole('button', { name: 'Apply' }).click();
      cy.wait('@applyLeafy');

      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText('Discount (LEAFY10)').should('exist');
          cy.findByText('−$2.20').should('exist');
          cy.findByText('$26.75').should('exist');
        });
      cy.findByText(/Code/).should('contain', 'LEAFY10');
      cy.findByRole('button', { name: 'Remove' }).should('exist');

      // Positive: Remove restores
      cy.intercept('DELETE', '/api/cart/promo', { fixture: 'cart/with-snake.json' }).as('removePromo');
      cy.findByRole('button', { name: 'Remove' }).click();
      cy.wait('@removePromo');
      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText(/Discount/).should('not.exist');
          cy.findByText('$28.95').should('exist');
        });
      cy.findByRole('button', { name: 'Apply' }).should('exist');

      // Negative: promo_invalid / expired → error shown, totals unchanged
      cy.intercept('POST', '/api/cart/promo', {
        statusCode: 400,
        fixture: 'cart/promo-invalid.json',
      }).as('applyInvalid');
      cy.findByRole('textbox').clear().type('NOPE');
      cy.findByRole('button', { name: 'Apply' }).click();
      cy.wait('@applyInvalid');
      cy.findByText("We don't recognize this code.").should('exist');
      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText(/Discount/).should('not.exist');
          cy.findByText('$28.95').should('exist');
        });

      cy.intercept('POST', '/api/cart/promo', {
        statusCode: 400,
        fixture: 'cart/promo-expired.json',
      }).as('applyExpired');
      cy.findByRole('textbox').clear().type('SPRING5');
      cy.findByRole('button', { name: 'Apply' }).click();
      cy.wait('@applyExpired');
      cy.findByText(/expired/i).should('exist');
      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText('$28.95').should('exist');
        });

      // Edge: replace one applied code with another via the UI (Remove → Apply new)
      cy.intercept('POST', '/api/cart/promo', { fixture: 'cart/with-snake-leafy10.json' }).as('applyLeafy2');
      cy.findByRole('textbox').clear().type('LEAFY10');
      cy.findByRole('button', { name: 'Apply' }).click();
      cy.wait('@applyLeafy2');
      cy.findByText(/Code/).should('contain', 'LEAFY10');

      cy.intercept('DELETE', '/api/cart/promo', { fixture: 'cart/with-snake.json' }).as('removeForReplace');
      cy.findByRole('button', { name: 'Remove' }).click();
      cy.wait('@removeForReplace');

      cy.intercept('POST', '/api/cart/promo', { fixture: 'cart/with-snake-freeship.json' }).as('applyFreeship');
      cy.findByRole('textbox').type('FREESHIP');
      cy.findByRole('button', { name: 'Apply' }).click();
      cy.wait('@applyFreeship');
      cy.findByText(/Code/).should('contain', 'FREESHIP');
      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText(/Discount/).should('not.exist');
          cy.findByText('$22').should('exist');
          cy.findByText('Free').should('exist');
        });
    },
  );
});
