import { OrderSummary } from '../../src/components/OrderSummary';

describe('OrderSummary', () => {
  it(
    'P08: shows Discount (CODE) −$X.XX when discount > 0; hides the row when discount is 0 or omitted',
    { tags: '@component' },
    () => {
      // Positive: discount + promoCode
      cy.mount(
        <OrderSummary
          itemCount={1}
          subtotal={40}
          shipping={6.95}
          total={42.95}
          discount={4}
          promoCode="LEAFY10"
        />,
      );

      cy.findByText('Discount (LEAFY10)').should('exist');
      cy.findByText('−$4.00').should('exist');
      cy.findByRole('heading', { name: 'Order summary' })
        .parent()
        .within(() => {
          cy.findByText('$42.95').should('exist');
        });

      // Edge: discount 0 → no discount row
      cy.mount(
        <OrderSummary itemCount={1} subtotal={40} shipping={6.95} total={46.95} discount={0} promoCode={null} />,
      );
      cy.findByText(/Discount/).should('not.exist');

      // Edge: discount omitted → no discount row
      cy.mount(<OrderSummary itemCount={1} subtotal={40} shipping={6.95} total={46.95} />);
      cy.findByText(/Discount/).should('not.exist');

      // Edge: discount without code → "Discount" label only
      cy.mount(
        <OrderSummary itemCount={1} subtotal={40} shipping={6.95} total={42.95} discount={4} promoCode={null} />,
      );
      cy.findByText('Discount').should('exist');
      cy.findByText('Discount (LEAFY10)').should('not.exist');
      cy.findByText('−$4.00').should('exist');
    },
  );
});
