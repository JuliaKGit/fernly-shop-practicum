import type { ComponentType } from 'react';
import type { Cart, Plant, PlantSummary } from '../types';

type SlotModule<P> = { default: ComponentType<P> };

const plantPage = import.meta.glob<SlotModule<{ plant: Plant }>>('./plant-page/*.tsx', { eager: true });
const plantCard = import.meta.glob<SlotModule<{ plant: PlantSummary }>>('./plant-card/*.tsx', { eager: true });
const cartSummary = import.meta.glob<SlotModule<{ cart: Cart }>>('./cart-summary/*.tsx', { eager: true });

function components<P>(modules: Record<string, SlotModule<P>>): [string, ComponentType<P>][] {
  return Object.entries(modules)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([path, mod]) => [path, mod.default]);
}

/** Renders every feature component dropped into src/slots/plant-page/. */
export function PlantPageSlot({ plant }: { plant: Plant }) {
  return (
    <>
      {components(plantPage).map(([path, Component]) => (
        <Component key={path} plant={plant} />
      ))}
    </>
  );
}

/** Renders every feature component dropped into src/slots/plant-card/. */
export function PlantCardSlot({ plant }: { plant: PlantSummary }) {
  return (
    <>
      {components(plantCard).map(([path, Component]) => (
        <Component key={path} plant={plant} />
      ))}
    </>
  );
}

/** Renders every feature component dropped into src/slots/cart-summary/. */
export function CartSummarySlot({ cart }: { cart: Cart }) {
  return (
    <>
      {components(cartSummary).map(([path, Component]) => (
        <Component key={path} cart={cart} />
      ))}
    </>
  );
}
