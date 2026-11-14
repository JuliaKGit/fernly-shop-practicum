import { ReviewForm } from '../../src/components/ReviewForm';

describe('ReviewForm', () => {
  it('R5 ReviewForm submit, validation, busy, error, and labels', { tags: '@component' }, () => {
    const onSubmit = cy.spy().as('onSubmit');

    // accessibility: textarea labelled "Your review"
    cy.mount(<ReviewForm onSubmit={onSubmit} />);
    cy.findByLabelText('Your review');

    // − rating 0 → alert; no onSubmit
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.findByRole('alert').should('have.text', 'Choose a rating from 1 to 5 stars.');
    cy.get('@onSubmit').should('not.have.been.called');

    // − text <10 → alert
    cy.findByRole('radio', { name: '3 stars' }).click();
    cy.findByLabelText('Your review').clear().type('too short');
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.findByRole('alert').should('have.text', 'Write at least 10 characters.');
    cy.get('@onSubmit').should('not.have.been.called');

    // + rating + ≥10 chars → onSubmit({ rating, text: trimmed }); fields reset
    cy.findByLabelText('Your review').clear().type('  Looks healthy after two weeks.  ');
    cy.findByRole('button', { name: 'Post review' }).click();
    cy.get('@onSubmit').should('have.been.calledOnceWithExactly', {
      rating: 3,
      text: 'Looks healthy after two weeks.',
    });
    cy.findByLabelText('Your review').should('have.value', '');
    cy.findAllByRole('radio').each(($el) => {
      expect($el, 'rating reset').not.to.have.attr('aria-checked', 'true');
    });

    // edge busy → button disabled, label "Posting…"
    cy.mount(<ReviewForm onSubmit={onSubmit} busy />);
    cy.findByRole('button', { name: 'Posting…' }).then(($el) => {
      expect($el, 'busy disables submit').to.be.disabled;
    });

    // edge error prop shown as alert
    cy.mount(<ReviewForm onSubmit={onSubmit} error="You already reviewed this plant." />);
    cy.findByRole('alert').should('have.text', 'You already reviewed this plant.');
  });
});
