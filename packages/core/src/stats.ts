// Aggregate stats for a session + comparison helpers for the dashboard.

import type { Session } from './types.js';

export interface SessionStats {
  rounds: number;
  startingBankroll: number;
  finalBankroll: number;
  net: number;
  roi: number;              // net / total staked
  wins: number;
  losses: number;
  pushes: number;
  winRate: number;          // wins / decided rounds
  evPerRound: number;       // net / rounds
  /** Bankroll after each round, prefixed with the starting bankroll (length = rounds+1). */
  bankrollSeries: number[];
  maxBankroll: number;
  minBankroll: number;
  bustedOut: boolean;
  /** Count of each bet type placed across the session. */
  betTypeDistribution: Record<string, number>;
  totalStaked: number;
}

function extractStake(game: string, decision: any): { types: string[]; staked: number } {
  if (game === 'slot') return { types: ['slot'], staked: decision.amount ?? 0 };
  if (game === 'blackjack') {
    if (decision.amount !== undefined) return { types: ['blackjack'], staked: decision.amount };
    return { types: [], staked: 0 }; // action steps stake nothing new
  }
  const bets = (decision.bets ?? []) as Array<{ type: string; amount: number }>;
  return { types: bets.map((b) => b.type), staked: bets.reduce((s, b) => s + b.amount, 0) };
}

export function computeStats(session: Session): SessionStats {
  const { config, rounds } = session;
  const bankrollSeries = [config.startingBankroll];
  let wins = 0, losses = 0, pushes = 0, totalStaked = 0;
  const betTypeDistribution: Record<string, number> = {};

  for (const round of rounds) {
    bankrollSeries.push(round.bankrollAfter);
    if (round.net > 0) wins++;
    else if (round.net < 0) losses++;
    else pushes++;
    for (const step of round.steps) {
      const { types, staked } = extractStake(round.game, step.decision);
      totalStaked += staked;
      for (const t of types) betTypeDistribution[t] = (betTypeDistribution[t] ?? 0) + 1;
    }
  }

  const net = session.finalBankroll - config.startingBankroll;
  const decided = wins + losses + pushes;
  return {
    rounds: rounds.length,
    startingBankroll: config.startingBankroll,
    finalBankroll: session.finalBankroll,
    net,
    roi: totalStaked > 0 ? net / totalStaked : 0,
    wins, losses, pushes,
    winRate: decided > 0 ? wins / decided : 0,
    evPerRound: rounds.length > 0 ? net / rounds.length : 0,
    bankrollSeries,
    maxBankroll: Math.max(...bankrollSeries),
    minBankroll: Math.min(...bankrollSeries),
    bustedOut: session.bustedOut,
    betTypeDistribution,
    totalStaked,
  };
}
