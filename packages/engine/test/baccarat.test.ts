import { describe, it, expect } from 'vitest';
import {
  playBaccaratCoup, resolveBaccaratBet, dealBaccarat, Shoe, createRng,
  type Card,
} from '../src/index.js';

const c = (rank: number, suit = 0): Card => ({ rank, suit });
// Deal order is P,B,P,B then P3,B3 — so the shoe list is [P1,B1,P2,B2,P3?,B3?].

describe('baccarat drawing rules', () => {
  it('player natural 9 stands, no third cards', () => {
    const coup = playBaccaratCoup(Shoe.fromCards([c(4), c(2), c(5), c(3)]));
    expect(coup.playerTotal).toBe(9);
    expect(coup.bankerTotal).toBe(5);
    expect(coup.player).toHaveLength(2);
    expect(coup.banker).toHaveLength(2);
    expect(coup.result).toBe('player');
  });

  it('banker 3 stands when player third card is 8', () => {
    // P: A+2=3 draws; B: A+2=3; player third = 8 => banker stands on 3
    const coup = playBaccaratCoup(Shoe.fromCards([c(1), c(1), c(2), c(2), c(8)]));
    expect(coup.player).toHaveLength(3);
    expect(coup.banker).toHaveLength(2); // banker did NOT draw
    expect(coup.bankerTotal).toBe(3);
    expect(coup.playerTotal).toBe((1 + 2 + 8) % 10); // 1
    expect(coup.result).toBe('banker');
  });

  it('banker 3 draws when player third card is not 8', () => {
    // player third = 5 => banker (3) draws
    const coup = playBaccaratCoup(Shoe.fromCards([c(1), c(1), c(2), c(2), c(5), c(4)]));
    expect(coup.player).toHaveLength(3);
    expect(coup.banker).toHaveLength(3);
  });

  it('player stands on 6-7; banker draws on 0-5', () => {
    // P: 6+1=7 stands; B: 2+2=4 draws (player stood)
    const coup = playBaccaratCoup(Shoe.fromCards([c(6), c(2), c(1), c(2), c(3)]));
    expect(coup.player).toHaveLength(2);
    expect(coup.playerTotal).toBe(7);
    expect(coup.banker).toHaveLength(3); // banker drew the c(3)
  });

  it('detects pairs on the first two cards', () => {
    // 7,7 vs 5,5 both need to draw; trailing cards feed those draws.
    const coup = playBaccaratCoup(Shoe.fromCards([c(7), c(5), c(7), c(5), c(2), c(2)]));
    expect(coup.playerPair).toBe(true);
    expect(coup.bankerPair).toBe(true);
  });
});

describe('baccarat payouts', () => {
  it('banker win pays 0.95 (5% commission); player/banker push on tie', () => {
    const bankerWin = playBaccaratCoup(Shoe.fromCards([c(1), c(1), c(2), c(2), c(8)])); // banker 3 vs player 1
    expect(bankerWin.result).toBe('banker');
    expect(resolveBaccaratBet({ type: 'banker', amount: 100 }, bankerWin)).toBeCloseTo(95, 9);
    expect(resolveBaccaratBet({ type: 'player', amount: 100 }, bankerWin)).toBe(-100);
  });

  it('tie pays 8:1 and pushes the line bets', () => {
    const tie = playBaccaratCoup(Shoe.fromCards([c(4), c(5), c(4), c(3)])); // both natural 8
    expect(tie.result).toBe('tie');
    expect(resolveBaccaratBet({ type: 'tie', amount: 10 }, tie)).toBe(80);
    expect(resolveBaccaratBet({ type: 'player', amount: 10 }, tie)).toBe(0);
    expect(resolveBaccaratBet({ type: 'banker', amount: 10 }, tie)).toBe(0);
  });

  it('pair bet pays 11:1', () => {
    const coup = playBaccaratCoup(Shoe.fromCards([c(7), c(1), c(7), c(9), c(3), c(4)]));
    expect(coup.playerPair).toBe(true);
    expect(resolveBaccaratBet({ type: 'playerPair', amount: 10 }, coup)).toBe(110);
  });
});

describe('baccarat statistics (Monte Carlo vs verified probabilities)', () => {
  it('outcome frequencies and house edges match docs/PAYOUTS.md', () => {
    const rng = createRng('baccarat-mc');
    const N = 200000;
    let banker = 0, player = 0, tie = 0;
    let bankerNet = 0, playerNet = 0, tieNet = 0;
    for (let i = 0; i < N; i++) {
      const coup = dealBaccarat(rng, 8);
      if (coup.result === 'banker') banker++;
      else if (coup.result === 'player') player++;
      else tie++;
      bankerNet += resolveBaccaratBet({ type: 'banker', amount: 1 }, coup);
      playerNet += resolveBaccaratBet({ type: 'player', amount: 1 }, coup);
      tieNet += resolveBaccaratBet({ type: 'tie', amount: 1 }, coup);
    }
    expect(banker / N).toBeCloseTo(0.4586, 2);
    expect(player / N).toBeCloseTo(0.4462, 2);
    expect(tie / N).toBeCloseTo(0.0952, 2);
    // House edge = -EV per unit staked.
    expect(-bankerNet / N).toBeCloseTo(0.0106, 2);
    expect(-playerNet / N).toBeCloseTo(0.0124, 2);
    expect(-tieNet / N).toBeCloseTo(0.1436, 2);
  });
});
