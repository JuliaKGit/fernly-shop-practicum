import { StarRatingInput } from '../../src/components/StarRatingInput';

describe('StarRatingInput', () => {
  it('R4 click, value 0, radiogroup names, and keyboard like radios', { tags: '@component' }, () => {
    const onChange = cy.spy().as('onChange');

    // edge value 0 → none selected
    cy.mount(<StarRatingInput value={0} onChange={onChange} />);
    cy.findByRole('radiogroup', { name: 'Your rating' });
    cy.findAllByRole('radio').should('have.length', 5);
    for (const n of [1, 2, 3, 4, 5]) {
      cy.findByRole('radio', { name: n === 1 ? '1 star' : `${n} stars` }).then(($el) => {
        expect($el, `${n} not selected when value is 0`).not.to.have.attr('aria-checked', 'true');
      });
    }

    // + click star N → onChange(N); stars 1…N appear selected
    cy.mount(<StarRatingInput value={3} onChange={onChange} />);
    cy.findByRole('radio', { name: '4 stars' }).click();
    cy.get('@onChange').should('have.been.calledWith', 4);

    cy.mount(<StarRatingInput value={4} onChange={onChange} />);
    for (const n of [1, 2, 3, 4]) {
      cy.findByRole('radio', { name: n === 1 ? '1 star' : `${n} stars` }).then(($el) => {
        expect($el, `star ${n} selected`).to.have.attr('aria-checked', 'true');
      });
    }
    cy.findByRole('radio', { name: '5 stars' }).then(($el) => {
      expect($el, 'star 5 not selected').not.to.have.attr('aria-checked', 'true');
    });

    // accessibility: Tab into group; arrow keys change rating; selected announced
    cy.mount(<StarRatingInput value={2} onChange={onChange} />);
    cy.findByRole('radiogroup', { name: 'Your rating' }).focus();
    cy.findByRole('radio', { name: '2 stars' }).focus().type('{rightarrow}');
    cy.get('@onChange').should('have.been.calledWith', 3);
  });
});
