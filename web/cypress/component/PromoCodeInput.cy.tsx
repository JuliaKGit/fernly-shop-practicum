import { PromoCodeInput } from '../../src/components/PromoCodeInput';

describe('PromoCodeInput', () => {
  it(
    'P09: Apply/Remove, busy/error states, and accessible name / announced error',
    { tags: '@component' },
    () => {
      const onApply = cy.spy().as('onApply');
      const onRemove = cy.spy().as('onRemove');

      cy.mount(<PromoCodeInput appliedCode={null} onApply={onApply} onRemove={onRemove} />);

      // Negative: Apply disabled when empty
      cy.findByRole('button', { name: 'Apply' }).then(($el) =>
        expect($el, 'Apply when empty').to.be.disabled,
      );

      // Negative: Apply disabled for whitespace-only
      cy.findByRole('textbox').type('   ');
      cy.findByRole('button', { name: 'Apply' }).then(($el) =>
        expect($el, 'Apply when whitespace').to.be.disabled,
      );

      // Positive: type code → Apply calls onApply with trimmed value
      cy.findByRole('textbox').clear().type('  LEAFY10  ');
      cy.findByRole('button', { name: 'Apply' }).click();
      cy.get('@onApply').should('have.been.calledOnceWithExactly', 'LEAFY10');

      // Negative: Apply disabled when busy
      cy.mount(<PromoCodeInput appliedCode={null} onApply={onApply} onRemove={onRemove} busy />);
      cy.findByRole('textbox').type('LEAFY10');
      cy.findByRole('button', { name: 'Apply' }).then(($el) =>
        expect($el, 'Apply when busy').to.be.disabled,
      );

      // Negative: error string shown
      cy.mount(
        <PromoCodeInput
          appliedCode={null}
          onApply={onApply}
          onRemove={onRemove}
          error="We don't recognize this code."
        />,
      );
      cy.findByText("We don't recognize this code.").should('exist');

      // Positive: applied state shows code + Remove → onRemove
      cy.mount(<PromoCodeInput appliedCode="LEAFY10" onApply={onApply} onRemove={onRemove} />);
      cy.findByText(/Code/).should('contain', 'LEAFY10');
      cy.findByRole('button', { name: 'Remove' }).click();
      cy.get('@onRemove').should('have.been.calledOnce');

      // Accessibility: field has a visible accessible name; refused error is announced
      cy.mount(
        <PromoCodeInput
          appliedCode={null}
          onApply={onApply}
          onRemove={onRemove}
          error="We don't recognize this code."
        />,
      );
      cy.findByLabelText(/promo code/i).should('exist');
      cy.findByRole('alert').should('contain', "We don't recognize this code.");
    },
  );
});
