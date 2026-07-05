// Zod schemas for schema-VALIDATED decisions. The LLM must return one of these
// shapes; free-form text is never parsed for a bet. Reasoning travels inside the
// structured payload so it is captured atomically with the decision.

import { z } from 'zod';
import { SLOT_DENOMINATIONS, SLOT_MAX_LEVEL } from '@casino/engine';

const reasoning = z.string().min(1).max(4000);
const amount = z.number().positive();
// A real casino is walk-in-walk-out free — every bet-kind decision may optionally end
// the session after this round resolves. Purely optional, never required either way;
// whether/when to use it is left entirely to the decider, not suggested by this schema.
const stop = z.boolean().optional();

// ---- Roulette ----
// A discriminated union (keyed on `type`) rather than one flat all-optional-fields
// object: the JSON Schema the model actually receives (injected verbatim into the
// prompt/tool-schema by the AI SDK) then states, per bet type, EXACTLY which field(s)
// are required — e.g. `series3` requires `seriesGroup`, `straight` requires a
// 1-element `numbers` tuple — instead of leaving that mapping to be inferred from
// field names alone. Cross-field geometry (is this split really adjacent on the
// felt?) still can't be expressed in JSON Schema, so that stays a runtime check in
// isValidRouletteBet — this only closes the "which field goes with which type" gap.
const Pocket = z.union([z.number().int().min(0).max(36), z.literal('00')]);
export const RouletteBetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('straight'), amount, numbers: z.tuple([Pocket]) }),
  z.object({ type: z.literal('split'), amount, numbers: z.tuple([Pocket, Pocket]) }),
  z.object({ type: z.literal('street'), amount, numbers: z.tuple([Pocket, Pocket, Pocket]) }),
  z.object({ type: z.literal('corner'), amount, numbers: z.tuple([Pocket, Pocket, Pocket, Pocket]) }),
  z.object({ type: z.literal('sixline'), amount, numbers: z.tuple([Pocket, Pocket, Pocket, Pocket, Pocket, Pocket]) }),
  z.object({ type: z.literal('column'), amount, selector: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ type: z.literal('dozen'), amount, selector: z.union([z.literal(1), z.literal(2), z.literal(3)]) }),
  z.object({ type: z.literal('red'), amount }),
  z.object({ type: z.literal('black'), amount }),
  z.object({ type: z.literal('odd'), amount }),
  z.object({ type: z.literal('even'), amount }),
  z.object({ type: z.literal('high'), amount }),
  z.object({ type: z.literal('low'), amount }),
  z.object({ type: z.literal('five'), amount }),
  z.object({ type: z.literal('zeroCombo'), amount }),
  z.object({ type: z.literal('series3'), amount, seriesGroup: z.number().int().min(1).max(12) }),
  z.object({ type: z.literal('series6'), amount, seriesGroup: z.number().int().min(1).max(6) }),
]);
export const RouletteDecisionSchema = z.object({
  bets: z.array(RouletteBetSchema).min(1).max(10),
  reasoning,
  stop,
});

// ---- Baccarat ----
// Already a flat shape with no bet-type-specific extra fields — no union needed.
export const BaccaratBetSchema = z.object({
  type: z.enum(['player', 'banker', 'tie', 'playerPair', 'bankerPair']),
  amount,
});
export const BaccaratDecisionSchema = z.object({
  bets: z.array(BaccaratBetSchema).min(1).max(4),
  reasoning,
  stop,
});

// ---- Sic Bo ----
// Same discriminated-union rationale as Roulette above.
const Face = z.number().int().min(1).max(6);
export const SicBoBetSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('small'), amount }),
  z.object({ type: z.literal('big'), amount }),
  z.object({ type: z.literal('odd'), amount }),
  z.object({ type: z.literal('even'), amount }),
  z.object({ type: z.literal('anytriple'), amount }),
  z.object({ type: z.literal('total'), amount, total: z.number().int().min(4).max(17) }),
  z.object({ type: z.literal('single'), amount, face: Face }),
  z.object({ type: z.literal('double'), amount, face: Face }),
  z.object({ type: z.literal('triple'), amount, face: Face }),
  z.object({ type: z.literal('combo'), amount, faces: z.tuple([Face, Face]) }),
  z.object({ type: z.literal('doubleAny'), amount, face: Face, partner: Face }),
  z.object({ type: z.literal('threeSingleCombo'), amount, triple: z.tuple([Face, Face, Face]) }),
  z.object({ type: z.literal('threeFromFour'), amount, group: z.number().int().min(1).max(4) }),
]);
export const SicBoDecisionSchema = z.object({
  bets: z.array(SicBoBetSchema).min(1).max(8),
  reasoning,
  stop,
});

// ---- Slot ----
// The decider chooses machine CONTROLS, not a raw stake — a denomination (coin
// value) and a bet level (credits per spin), or `betMax` to slam the BET MAX button
// (snaps to the highest denomination x highest level). This makes the reasoning
// trace and the UI replay both speak in terms of a real cabinet's physical controls.
export const SlotDecisionSchema = z.object({
  denomination: z.number().refine((v) => (SLOT_DENOMINATIONS as readonly number[]).includes(v), {
    message: `denomination must be one of ${SLOT_DENOMINATIONS.join(', ')}`,
  }),
  betLevel: z.number().int().min(1).max(SLOT_MAX_LEVEL),
  betMax: z.boolean().optional(),
  reasoning,
  stop,
});

// ---- Blackjack (DEPRECATED — excluded from GAME_IDS, see index.ts) ----
export const BlackjackBetSchema = z.object({
  amount: z.number().positive(),
  reasoning,
});
export const BlackjackActionSchema = z.object({
  action: z.enum(['hit', 'stand', 'double', 'split', 'surrender', 'insurance', 'decline-insurance']),
  reasoning,
});

export type RouletteDecision = z.infer<typeof RouletteDecisionSchema>;
export type BaccaratDecision = z.infer<typeof BaccaratDecisionSchema>;
export type SicBoDecision = z.infer<typeof SicBoDecisionSchema>;
export type SlotDecision = z.infer<typeof SlotDecisionSchema>;
export type BlackjackBet = z.infer<typeof BlackjackBetSchema>;
export type BlackjackActionDecision = z.infer<typeof BlackjackActionSchema>;
