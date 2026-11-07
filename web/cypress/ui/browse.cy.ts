interface PlantCatalog {
  items: Array<{ name: string }>;
}

function openBrowse(fixture: string, statusCode?: number): void {
  cy.intercept('GET', '/api/plants?*', {
    fixture,
    ...(statusCode === undefined ? {} : { statusCode }),
  }).as('plants');
  cy.visit('/');
  cy.wait('@plants');
}

describe('Browse page', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('shows two cards and the heading "2 plants"', { tags: '@ui' }, () => {
    openBrowse('browse-two-plants.json');

    cy.findAllByRole('article').should('have.length', 2);
    cy.findByRole('heading', { name: '2 plants' });
    cy.findByRole('heading', { level: 3, name: 'Snake Plant' });
    cy.findByRole('heading', { level: 3, name: 'ZZ Plant' });
  });

  it('shows an empty state when the catalog has no plants', { tags: '@ui' }, () => {
    openBrowse('browse-empty.json');

    cy.findByRole('heading', { name: 'No plants match your filters' });
    cy.findByText('Try another search or clear a filter.');
  });

  it('keeps a very long plant name inside its card', { tags: '@ui' }, () => {
    cy.fixture('browse-long-name.json').then((catalog: PlantCatalog) => {
      const name = catalog.items[0]?.name ?? '';
      expect(name.length, 'scenario uses a very long name').to.be.greaterThan(80);

      cy.intercept('GET', '/api/plants?*', { fixture: 'browse-long-name.json' }).as('plants');
      cy.visit('/');
      cy.wait('@plants');

      cy.findByRole('heading', { level: 3, name }).then(($name) => {
        cy.findByRole('article').then(($card) => {
          const nameEl = $name[0];
          const cardEl = $card[0];
          const nameBox = nameEl.getBoundingClientRect();
          const cardBox = cardEl.getBoundingClientRect();

          expect(cardEl.contains(nameEl), 'name stays inside its card').to.equal(true);
          expect(nameBox.left, 'name stays inside its card').to.be.at.least(cardBox.left - 1);
          expect(nameBox.right, 'name stays inside its card').to.be.at.most(cardBox.right + 1);
          expect(nameBox.top, 'name stays inside its card').to.be.at.least(cardBox.top - 1);
          expect(nameBox.bottom, 'name stays inside its card').to.be.at.most(cardBox.bottom + 1);
          expect(nameEl.scrollWidth, 'name is fully inside its card').to.be.at.most(nameEl.clientWidth + 1);
        });
      });
    });
  });

  it('shows $0.00 for a plant priced 0', { tags: '@ui' }, () => {
    openBrowse('browse-zero-price.json');

    cy.findByRole('heading', { level: 3, name: 'Gift Fern' });
    cy.findByRole('article').within(() => {
      cy.findByText('$0.00');
    });
  });

  it('shows an error and Try again when the catalog cannot be loaded', { tags: '@ui' }, () => {
    openBrowse('browse-server-error.json', 500);

    cy.findByRole('alert').within(() => {
      cy.findByRole('button', { name: 'Try again' });
    });
  });
});
