import type { SizeLabel } from './schemas.js';

export interface PlantRecord {
  id: string;
  name: string;
  latinName: string;
  price: number;
  light: 'low' | 'medium' | 'bright';
  careLevel: 1 | 2 | 3;
  petSafe: boolean;
  stock: number;
  rating: number;
  image: string;
  description: string;
  sizes: { label: SizeLabel; priceDelta: number }[];
}

const standard = [
  { label: 'S' as const, priceDelta: 0 },
  { label: 'M' as const, priceDelta: 6 },
  { label: 'L' as const, priceDelta: 14 },
];
const smallOnly = [
  { label: 'S' as const, priceDelta: 0 },
  { label: 'M' as const, priceDelta: 4 },
];

export const SEED_PLANTS: PlantRecord[] = [
  { id: 'pl-monstera', name: 'Monstera Deliciosa', latinName: 'Monstera deliciosa', price: 34.99, light: 'medium', careLevel: 1, petSafe: false, stock: 12, rating: 4.7, image: 'monstera', description: 'Big split leaves that make any corner feel like a jungle. Forgiving and fast-growing.', sizes: standard },
  { id: 'pl-snake', name: 'Snake Plant', latinName: 'Dracaena trifasciata', price: 22.0, light: 'low', careLevel: 1, petSafe: false, stock: 20, rating: 4.8, image: 'snake', description: 'Upright, sword-shaped leaves. Happy in dim rooms and with irregular watering.', sizes: standard },
  { id: 'pl-zz', name: 'ZZ Plant', latinName: 'Zamioculcas zamiifolia', price: 27.5, light: 'low', careLevel: 1, petSafe: false, stock: 9, rating: 4.6, image: 'snake', description: 'Glossy leaves that store water. Nearly impossible to overwater by forgetting.', sizes: standard },
  { id: 'pl-pothos', name: "Pothos 'Golden'", latinName: 'Epipremnum aureum', price: 12.5, light: 'low', careLevel: 1, petSafe: false, stock: 30, rating: 4.5, image: 'trailing', description: 'Trailing vines with gold-flecked leaves. Perfect for shelves and hanging pots.', sizes: smallOnly },
  { id: 'pl-fiddle', name: 'Fiddle Leaf Fig', latinName: 'Ficus lyrata', price: 49.0, light: 'bright', careLevel: 3, petSafe: false, stock: 4, rating: 4.1, image: 'monstera', description: 'A statement tree with violin-shaped leaves. Likes a bright spot and a steady routine.', sizes: standard },
  { id: 'pl-peace-lily', name: 'Peace Lily', latinName: 'Spathiphyllum wallisii', price: 19.99, light: 'low', careLevel: 2, petSafe: false, stock: 15, rating: 4.4, image: 'fern', description: 'White blooms and dark leaves. Droops dramatically when thirsty, then bounces back.', sizes: standard },
  { id: 'pl-calathea', name: 'Calathea Orbifolia', latinName: 'Goeppertia orbifolia', price: 31.0, light: 'medium', careLevel: 3, petSafe: true, stock: 6, rating: 4.2, image: 'fern', description: 'Round, silver-striped leaves. Wants humidity and filtered water.', sizes: standard },
  { id: 'pl-spider', name: 'Spider Plant', latinName: 'Chlorophytum comosum', price: 14.99, light: 'medium', careLevel: 1, petSafe: true, stock: 25, rating: 4.6, image: 'trailing', description: 'Arching striped leaves and baby plantlets you can pot up and share.', sizes: smallOnly },
  { id: 'pl-boston-fern', name: 'Boston Fern', latinName: 'Nephrolepis exaltata', price: 18.0, light: 'medium', careLevel: 2, petSafe: true, stock: 11, rating: 4.0, image: 'fern', description: 'Soft, feathery fronds. Loves a bathroom with a window.', sizes: standard },
  { id: 'pl-rubber', name: 'Rubber Plant', latinName: 'Ficus elastica', price: 29.99, light: 'bright', careLevel: 2, petSafe: false, stock: 8, rating: 4.5, image: 'monstera', description: 'Thick, glossy burgundy leaves on a sturdy stem.', sizes: standard },
  { id: 'pl-pearls', name: 'String of Pearls', latinName: 'Curio rowleyanus', price: 16.5, light: 'bright', careLevel: 3, petSafe: false, stock: 1, rating: 3.9, image: 'succulent', description: 'Bead-like leaves on trailing strands. Needs bright light and very little water.', sizes: smallOnly },
  { id: 'pl-aloe', name: 'Aloe Vera', latinName: 'Aloe barbadensis', price: 9.99, light: 'bright', careLevel: 1, petSafe: false, stock: 18, rating: 4.3, image: 'succulent', description: 'A sun-loving succulent with soothing gel inside its leaves.', sizes: smallOnly },
  { id: 'pl-bird', name: 'Bird of Paradise', latinName: 'Strelitzia reginae', price: 50.0, light: 'bright', careLevel: 2, petSafe: false, stock: 5, rating: 4.4, image: 'palm', description: 'Huge paddle leaves with a tropical feel. Give it your brightest window.', sizes: standard },
  { id: 'pl-parlor', name: 'Parlor Palm', latinName: 'Chamaedorea elegans', price: 24.0, light: 'low', careLevel: 1, petSafe: true, stock: 14, rating: 4.5, image: 'palm', description: 'A small, elegant palm that tolerates low light.', sizes: standard },
  { id: 'pl-pilea', name: 'Chinese Money Plant', latinName: 'Pilea peperomioides', price: 15.0, light: 'medium', careLevel: 1, petSafe: true, stock: 0, rating: 4.7, image: 'succulent', description: 'Coin-shaped leaves on thin stems. Currently out of stock.', sizes: smallOnly },
  { id: 'pl-hoya', name: 'Hoya Carnosa', latinName: 'Hoya carnosa', price: 21.0, light: 'bright', careLevel: 2, petSafe: true, stock: 3, rating: 4.6, image: 'trailing', description: 'Waxy leaves and star-shaped flower clusters on mature vines.', sizes: smallOnly },
  { id: 'pl-birkin', name: "Philodendron 'Birkin'", latinName: 'Philodendron Birkin', price: 38.0, light: 'medium', careLevel: 2, petSafe: false, stock: 7, rating: 4.3, image: 'monstera', description: 'Dark leaves with creamy pinstripes that change as the plant grows.', sizes: standard },
  { id: 'pl-ponytail', name: 'Ponytail Palm', latinName: 'Beaucarnea recurvata', price: 26.0, light: 'bright', careLevel: 1, petSafe: true, stock: 10, rating: 4.4, image: 'palm', description: 'A swollen trunk topped with a fountain of thin leaves.', sizes: standard },
  { id: 'pl-prayer', name: 'Prayer Plant', latinName: 'Maranta leuconeura', price: 17.0, light: 'low', careLevel: 2, petSafe: true, stock: 13, rating: 4.2, image: 'fern', description: 'Patterned leaves that fold up at night, like hands in prayer.', sizes: standard },
  { id: 'pl-cutting', name: 'Succulent Cutting', latinName: 'Echeveria elegans', price: 0.99, light: 'bright', careLevel: 1, petSafe: true, stock: 40, rating: 3.8, image: 'succulent', description: 'A single rooted cutting to start your collection.', sizes: [{ label: 'S', priceDelta: 0 }] },
  { id: 'pl-thai', name: "Variegated Thai Constellation Monstera (Collector's Edition, Limited Greenhouse Batch)", latinName: "Monstera deliciosa 'Thai Constellation'", price: 189.0, light: 'medium', careLevel: 3, petSafe: false, stock: 2, rating: 4.9, image: 'monstera', description: 'Cream-speckled leaves, grown slowly in small batches.', sizes: [{ label: 'S', priceDelta: 0 }, { label: 'M', priceDelta: 60 }] },
];

export const SEED_USERS = [
  { id: 'usr-ava', name: 'Ava Green', email: 'ava@fernly.test', password: 'Fernly-Ava-2026' },
  { id: 'usr-ben', name: 'Ben Moss', email: 'ben@fernly.test', password: 'Fernly-Ben-2026' },
];
