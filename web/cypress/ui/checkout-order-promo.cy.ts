function stubSignedIn(): void {
  cy.intercept('GET', '/api/auth/me', { fixture: 'auth/me.json' }).as('me');
  cy.visit('/', {
    onBeforeLoad(win) {
      win.localStorage.setItem('fernly_token', 'test-token');
    },
  });
}

describe('Checkout and order promo summary', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it(
    'P11: checkout and order detail show Discount line with promo; discount 0 hides it',
    { tags: '@ui' },
    () => {
      // Positive: checkout cart with promo
      stubSignedIn();
      cy.intercept('GET', '/api/cart', { fixture: 'cart/with-snake-leafy10.json' }).as('cartPromo');
      cy.visit('/checkout', {
        onBeforeLoad(win) {
          win.localStorage.setItem('fernly_token', 'test-token');
        },
      });
      cy.wait('@me');
      cy.wait('@cartPromo');
      cy.findByRole('heading', { name: 'Checkout' });
      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText('Discount (LEAFY10)').should('exist');
          cy.findByText('−$2.20').should('exist');
          cy.findByText('$26.75').should('exist');
        });

      // Edge: checkout with discount 0 → no discount line
      cy.intercept('GET', '/api/cart', { fixture: 'cart/with-snake.json' }).as('cartPlain');
      cy.visit('/checkout', {
        onBeforeLoad(win) {
          win.localStorage.setItem('fernly_token', 'test-token');
        },
      });
      cy.wait('@cartPlain');
      cy.findByRole('heading', { name: 'Checkout' });
      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText(/Discount/).should('not.exist');
          cy.findByText('$28.95').should('exist');
        });

      // Positive: order detail with promo
      cy.intercept('GET', '/api/orders/ord-promo-1', { fixture: 'orders/with-leafy10.json' }).as('orderPromo');
      cy.visit('/orders/ord-promo-1', {
        onBeforeLoad(win) {
          win.localStorage.setItem('fernly_token', 'test-token');
        },
      });
      cy.wait('@orderPromo');
      cy.findByRole('heading', { name: /Order ord-promo-1/ });
      cy.findByRole('heading', { name: 'Paid' })
        .parent()
        .within(() => {
          cy.findByText('Discount (LEAFY10)').should('exist');
          cy.findByText('−$2.20').should('exist');
          cy.findByText('$26.75').should('exist');
        });

      // Edge: order detail with discount 0
      cy.intercept('GET', '/api/orders/ord-plain-1', { fixture: 'orders/no-discount.json' }).as('orderPlain');
      cy.visit('/orders/ord-plain-1', {
        onBeforeLoad(win) {
          win.localStorage.setItem('fernly_token', 'test-token');
        },
      });
      cy.wait('@orderPlain');
      cy.findByRole('heading', { name: /Order ord-plain-1/ });
      cy.findByText(/Discount/).should('not.exist');
    },
  );
});
