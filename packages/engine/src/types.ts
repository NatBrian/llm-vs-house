// Shared cross-game types. Per-game bet/outcome shapes live in each game module.

export type GameId = 'roulette' | 'blackjack' | 'baccarat' | 'sicbo' | 'slot';

/**
 * Every engine returns net profit in SIMULATED POINTS per bet:
 *   win  => +amount * (payout odds)   (stake conceptually returned on top)
 *   lose => -amount
 * A push returns 0. Bankroll is just the running sum of these nets.
 * NOTE: payout tables are quoted "to-one" (net) except the slot paytable,
 * which is quoted "for-one" (total return) internally and converted to net here.
 */
export interface BetResolution {
  /** Net points won (+) or lost (-). */
  net: number;
  /** True if the bet won anything (net > 0). Pushes are false. */
  won: boolean;
}
