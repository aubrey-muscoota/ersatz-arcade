import type { Puzzle } from './logic.ts';

// One puzzle per day, in order. Day #1 is Nov 4, 2026; the list repeats after the end.
// `key` names the image folder in assets/puzzles.
export const PUZZLES: Puzzle[] = [
  { key: 'palm-jumeirah', answer: 'dubai', note: 'The Palm Jumeirah, an artificial island off Dubai, UAE.' },
  { key: 'paris', answer: 'paris', note: 'The Arc de Triomphe, where 12 avenues meet in Paris, France.' },
  { key: 'uluru', answer: 'uluru', note: 'Uluru, a 348 m sandstone monolith in central Australia.' },
  { key: 'venice', answer: 'venice', note: 'Venice and its Grand Canal, in a lagoon on the Adriatic, Italy.' },
  { key: 'golden-gate', answer: 'san-francisco', note: 'The Golden Gate Bridge, San Francisco, USA.' },
  { key: 'giza', answer: 'giza', note: 'The Pyramids of Giza, on the edge of Cairo, Egypt.' },
  { key: 'richat', answer: 'richat', note: 'The Richat Structure, a 40 km eroded dome in the Sahara, Mauritania.' },
  { key: 'sydney', answer: 'sydney', note: 'Sydney Harbour, the Opera House and the Harbour Bridge, Australia.' },
  { key: 'amsterdam', answer: 'amsterdam', note: 'The ring of canals around central Amsterdam, Netherlands.' },
  { key: 'mount-fuji', answer: 'fuji', note: 'Mount Fuji, 3,776 m, Japan’s highest peak.' },
  { key: 'rio', answer: 'rio', note: 'Corcovado and the lagoon of Rio de Janeiro, Brazil.' },
  { key: 'gibraltar', answer: 'gibraltar', note: 'The Rock of Gibraltar, where the Mediterranean meets the Atlantic.' },
  { key: 'grand-canyon', answer: 'grand-canyon', note: 'The Grand Canyon, cut by the Colorado River, Arizona, USA.' },
  { key: 'washington', answer: 'washington', note: 'The National Mall, from the Capitol to the Lincoln Memorial, Washington, D.C.' },
  { key: 'vesuvius', answer: 'vesuvius', note: 'Mount Vesuvius, the volcano that buried Pompeii, above Naples, Italy.' },
  { key: 'cape-town', answer: 'cape-town', note: 'Table Mountain and the Cape Peninsula, Cape Town, South Africa.' },
  { key: 'manhattan', answer: 'new-york', note: 'Central Park, in the middle of Manhattan, New York City.' },
  { key: 'dead-sea', answer: 'dead-sea', note: 'The Dead Sea and its evaporation ponds, the lowest land on Earth.' },
];
