import { describe, it, expect } from 'vitest';
import {
  handValue, isBlackjack, startBlackjackFromShoe, applyAction, legalActions,
  startBlackjack, DEFAULT_BLACKJACK_RULES, Shoe, createRng,
  type Card, type BlackjackRules,
} from '../src/index.js';

const card = (rank: number, suit = 0): Card => ({ rank, suit });
const RULES = DEFAULT_BLACKJACK_RULES;
// Deal order: player1, dealerUp, player2, dealerHole, then subsequent draws.

describe('hand evaluation', () => {
  it('counts aces flexibly (soft/hard)', () => {
    expect(handValue([card(1), card(6)])).toEqual({ total: 17, soft: true });   // A,6
    expect(handValue([card(1), card(6), card(10)])).toEqual({ total: 17, soft: false }); // A,6,10
    expect(handValue([card(1), card(1), card(9)])).toEqual({ total: 21, soft: true });   // A,A,9
    expect(handValue([card(10), card(10)])).toEqual({ total: 20, soft: false });
  });
  it('identifies naturals only from two cards', () => {
    expect(isBlackjack([card(1), card(13)])).toBe(true);       // A,K
    expect(isBlackjack([card(1), card(5), card(5)])).toBe(false); // A,5,5 = 21 but not natural
  });
});

describe('blackjack scenarios (deterministic shoes)', () => {
  it('player natural pays 3:2', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(1), card(9), card(13), card(7)]), RULES, 100);
    expect(s.phase).toBe('settled');
    expect(s.settlement!.total).toBe(150);
  });

  it('both natural => push', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(1), card(12), card(13), card(1)]), RULES, 100);
    expect(s.phase).toBe('settled');
    expect(s.settlement!.total).toBe(0);
  });

  it('dealer natural on Ace upcard: decline insurance loses base bet', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(10), card(1), card(7), card(13)]), RULES, 100);
    expect(s.phase).toBe('insurance');
    applyAction(s, 'decline-insurance');
    expect(s.phase).toBe('settled');
    expect(s.settlement!.total).toBe(-100);
  });

  it('insurance exactly offsets a dealer natural', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(10), card(1), card(7), card(13)]), RULES, 100);
    applyAction(s, 'insurance');
    // -100 base + (2 * 50) insurance = 0
    expect(s.settlement!.total).toBe(0);
    expect(s.settlement!.insuranceNet).toBe(100);
  });

  it('straight win beats dealer 17', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(10), card(10), card(9), card(7)]), RULES, 100);
    expect(s.phase).toBe('player');
    applyAction(s, 'stand'); // player 19 vs dealer 17
    expect(s.settlement!.total).toBe(100);
  });

  it('double draws exactly one card and doubles the stake', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(6), card(10), card(5), card(7), card(10)]), RULES, 100);
    applyAction(s, 'double'); // 11 -> +10 = 21 vs dealer 17
    expect(s.phase).toBe('settled');
    expect(s.settlement!.total).toBe(200);
  });

  it('split creates two independently-settled hands', () => {
    const s = startBlackjackFromShoe(
      Shoe.fromCards([card(8), card(10), card(8), card(7), card(3), card(10)]),
      RULES, 100,
    );
    expect(legalActions(s)).toContain('split');
    applyAction(s, 'split');   // hand1 = 8+3 = 11, hand2 = 8+10 = 18
    applyAction(s, 'stand');   // hand1 stands 11 (loses to 17)
    applyAction(s, 'stand');   // hand2 stands 18 (beats 17)
    expect(s.phase).toBe('settled');
    expect(s.settlement!.handNets).toEqual([-100, 100]);
    expect(s.settlement!.total).toBe(0);
  });

  it('busting loses immediately', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(10), card(9), card(6), card(7), card(10)]), RULES, 100);
    applyAction(s, 'hit'); // 16 -> +10 = 26 bust
    expect(s.phase).toBe('settled');
    expect(s.settlement!.total).toBe(-100);
  });

  it('insurance only offered on an Ace upcard', () => {
    const noAce = startBlackjackFromShoe(Shoe.fromCards([card(10), card(9), card(9), card(7)]), RULES, 100);
    expect(noAce.phase).toBe('player');
    expect(legalActions(noAce)).not.toContain('insurance');
  });
});

describe('late surrender (rule variant)', () => {
  const LS: BlackjackRules = { ...RULES, surrender: 'late' };
  it('surrender forfeits half the bet', () => {
    const s = startBlackjackFromShoe(Shoe.fromCards([card(10), card(9), card(6), card(7)]), LS, 100);
    expect(legalActions(s)).toContain('surrender');
    applyAction(s, 'surrender');
    expect(s.phase).toBe('settled');
    expect(s.settlement!.total).toBe(-50);
  });
});

describe('determinism', () => {
  it('same seed => identical settlement under a fixed strategy', () => {
    const play = (seed: string) => {
      const s = startBlackjack(createRng(seed), RULES, 100);
      let guard = 0;
      while (s.phase !== 'settled') {
        const legal = legalActions(s);
        // simple strategy: decline insurance, hit under 17, else stand
        const action = legal.includes('decline-insurance')
          ? 'decline-insurance'
          : (s.hands[s.active] && handValue(s.hands[s.active]!.cards).total < 17 ? 'hit' : 'stand');
        applyAction(s, action);
        if (++guard > 200) throw new Error('guard');
      }
      return s.settlement!.total;
    };
    expect(play('bj-seed')).toBe(play('bj-seed'));
  });
});
