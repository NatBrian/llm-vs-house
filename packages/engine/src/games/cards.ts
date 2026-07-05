// Shared card + shoe primitives for Blackjack and Baccarat.
// rank: 1=Ace, 2..10 pip, 11=J, 12=Q, 13=K. suit: 0..3 (clubs, diamonds, hearts, spades).

import type { Rng } from '../rng.js';

export interface Card {
  rank: number; // 1..13
  suit: number; // 0..3
}

export const SUITS = ['C', 'D', 'H', 'S'] as const;
export const RANK_LABELS = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

export function cardLabel(c: Card): string {
  return `${RANK_LABELS[c.rank]}${SUITS[c.suit]}`;
}

/** A fresh, ordered shoe of `decks` standard 52-card decks. */
export function buildShoe(decks: number): Card[] {
  const shoe: Card[] = [];
  for (let d = 0; d < decks; d++) {
    for (let suit = 0; suit < 4; suit++) {
      for (let rank = 1; rank <= 13; rank++) shoe.push({ rank, suit });
    }
  }
  return shoe;
}

/** Fisher–Yates shuffle driven by the seeded Rng (deterministic). Returns a new array. */
export function shuffle(cards: readonly Card[], rng: Rng): Card[] {
  const out = cards.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = out[i]!;
    out[i] = out[j]!;
    out[j] = tmp;
  }
  return out;
}

/** A cursor that draws cards off the top of a shoe in order. */
export class Shoe {
  private idx = 0;
  constructor(private readonly cards: Card[]) {}
  static shuffled(decks: number, rng: Rng): Shoe {
    return new Shoe(shuffle(buildShoe(decks), rng));
  }
  /** For tests: build directly from a fixed list (top of shoe = index 0). */
  static fromCards(cards: Card[]): Shoe {
    return new Shoe(cards.slice());
  }
  draw(): Card {
    if (this.idx >= this.cards.length) throw new Error('shoe exhausted');
    return this.cards[this.idx++]!;
  }
  get remaining(): number {
    return this.cards.length - this.idx;
  }
}
