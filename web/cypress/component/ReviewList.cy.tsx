import { ReviewList } from '../../src/components/ReviewList';

describe('ReviewList', () => {
  it('R6 average summary, empty and singular copy, decorative stars', { tags: '@component' }, () => {
    // edge count 0 → empty invitation
    cy.mount(<ReviewList reviews={[]} average={0} count={0} />);
    cy.findByText("No reviews yet. Be the first to share how it's growing.");

    // edge count 1 → singular "review"
    cy.mount(
      <ReviewList
        reviews={[
          {
            id: 'rv-1',
            author: 'Ava Green',
            rating: 4,
            text: 'Happy on a bright shelf.',
            createdAt: '2026-10-01T12:00:00.000Z',
          },
        ]}
        average={4}
        count={1}
      />,
    );
    cy.findByText(/1 review(?:\s|$)/);
    cy.findByText('Ava Green');
    cy.findByText('Happy on a bright shelf.');
    cy.findByText('Oct 1, 2026');
    cy.findByText('4 out of 5').then(($el) => {
      expect($el, 'visually hidden rating').to.have.class('visually-hidden');
    });

    // + count > 0 → average line, author, stars, en-CA date, text
    cy.mount(
      <ReviewList
        reviews={[
          {
            id: 'rv-2',
            author: 'Ben Moss',
            rating: 5,
            text: 'My third one. Impossible to kill.',
            createdAt: '2026-10-05T08:10:00.000Z',
          },
          {
            id: 'rv-3',
            author: 'Omar K.',
            rating: 4,
            text: 'Arrived healthy, a little smaller than expected.',
            createdAt: '2026-09-18T15:30:00.000Z',
          },
        ]}
        average={4.7}
        count={2}
      />,
    );
    cy.findByText(/4\.7 out of 5 · 2 reviews/);
    cy.findByText('Ben Moss');
    cy.findByText('My third one. Impossible to kill.');
    cy.findByText('Oct 5, 2026');

    // accessibility: decorative ★ aria-hidden
    cy.get('[aria-hidden="true"]').contains('★');
  });
});
