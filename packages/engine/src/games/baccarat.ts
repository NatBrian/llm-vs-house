// Baccarat (Punto Banco, 8-deck). Fixed drawing rules — no player choices, only a bet.
// Drawing-rule tables verified against docs/PAYOUTS.md (Wizard of Odds).

import type { Rng } from '../rng.js';
import { type Card, Shoe } from './cards.js';

/** Baccarat point value of a card: A=1, 2..9 pip, 10/J/Q/K=0. */
export function baccaratValue(card: Card): number {
  return card.rank >= 10 ? 0 : card.rank;
}

function handTotal(cards: Card[]): number {
  return cards.reduce((s, c) => (s + baccaratValue(c)) % 10, 0);
}

export type BaccaratResult = 'player' | 'banker' | 'tie';

export interface BaccaratCoup {
  player: Card[];
  banker: Card[];
  playerTotal: number;
  bankerTotal: number;
  result: BaccaratResult;
  playerPair: boolean;
  bankerPair: boolean;
}

/**
 * Deal one coup from a shoe following the fixed drawing rules.
 * Deal order P,B,P,B; naturals stop play; then Player rule, then Banker rule.
 */
export function playBaccaratCoup(shoe: Shoe): BaccaratCoup {
  const player: Card[] = [shoe.draw()];
  const banker: Card[] = [shoe.draw()];
  player.push(shoe.draw());
  banker.push(shoe.draw());

  // "Pair" = same point value OR same face card — but two DIFFERENT face cards (e.g.
  // K+Q) do NOT count, even though both are worth 0 (GRA MBS Baccarat Game Rules v8,
  // rule 1.1.6). Comparing raw rank (J=11/Q=12/K=13 stay distinct) rather than
  // baccaratValue() gets this right without special-casing face cards.
  const playerPair = player[0]!.rank === player[1]!.rank;
  const bankerPair = banker[0]!.rank === banker[1]!.rank;

  let pt = handTotal(player);
  let bt = handTotal(banker);

  // Naturals: either hand 8 or 9 => both stand, no draws.
  if (pt < 8 && bt < 8) {
    let playerThird: number | null = null;
    // Player rule: draw on 0-5, stand on 6-7.
    if (pt <= 5) {
      const c = shoe.draw();
      player.push(c);
      playerThird = baccaratValue(c);
      pt = handTotal(player);
    }
    // Banker rule.
    let bankerDraws: boolean;
    if (playerThird === null) {
      // Player stood: banker draws on 0-5, stands on 6-7.
      bankerDraws = bt <= 5;
    } else {
      switch (bt) {
        case 0: case 1: case 2: bankerDraws = true; break;
        case 3: bankerDraws = playerThird !== 8; break;
        case 4: bankerDraws = playerThird >= 2 && playerThird <= 7; break;
        case 5: bankerDraws = playerThird >= 4 && playerThird <= 7; break;
        case 6: bankerDraws = playerThird >= 6 && playerThird <= 7; break;
        default: bankerDraws = false; break; // 7 stands
      }
    }
    if (bankerDraws) {
      banker.push(shoe.draw());
      bt = handTotal(banker);
    }
  }

  const result: BaccaratResult = pt === bt ? 'tie' : pt > bt ? 'player' : 'banker';
  return { player, banker, playerTotal: pt, bankerTotal: bt, result, playerPair, bankerPair };
}

export type BaccaratBetType = 'player' | 'banker' | 'tie' | 'playerPair' | 'bankerPair';

export interface BaccaratBet {
  type: BaccaratBetType;
  amount: number;
}

export const BACCARAT_BANKER_COMMISSION = 0.05;

/**
 * Table minimum stake per bet family, in points — mirrors ROULETTE_MIN_BET /
 * SICBO_MIN_BET. Neither GRA (MBS/RWS) rule sheet publishes a dollar minimum
 * (floor discretion, posted table-side), so this reuses the project-wide
 * convention: the two even-money-ish main bets (Player/Banker) carry the
 * higher minimum, the high-payout proposition bets (Tie/Pair) the lower one —
 * same split as Sic Bo/Roulette's outside-vs-inside distinction. Real Vegas
 * mini-baccarat pits commonly run a $25 table min as a reference point.
 */
export const BACCARAT_MIN_BET: Record<BaccaratBetType, number> = {
  player: 50, banker: 50, tie: 10, playerPair: 10, bankerPair: 10,
};

/** Net points for a bet given a resolved coup. Player/Banker push on a tie. */
export function resolveBaccaratBet(bet: BaccaratBet, coup: BaccaratCoup): number {
  const { amount } = bet;
  switch (bet.type) {
    case 'player':
      return coup.result === 'player' ? amount : coup.result === 'tie' ? 0 : -amount;
    case 'banker':
      if (coup.result === 'banker') return amount * (1 - BACCARAT_BANKER_COMMISSION); // 0.95:1
      return coup.result === 'tie' ? 0 : -amount;
    case 'tie':
      return coup.result === 'tie' ? amount * 8 : -amount;
    case 'playerPair':
      return coup.playerPair ? amount * 11 : -amount;
    case 'bankerPair':
      return coup.bankerPair ? amount * 11 : -amount;
  }
}

export function dealBaccarat(rng: Rng, decks = 8): BaccaratCoup {
  return playBaccaratCoup(Shoe.shuffled(decks, rng));
}
