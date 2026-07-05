// Zod schemas for schema-VALIDATED decisions. The LLM must return one of these
// shapes; free-form text is never parsed for a bet. Reasoning travels inside the
// structured payload so it is captured atomically with the decision.

import { z } from 'zod';

const reasoning = z.string().min(1).max(4000);

// ---- Roulette ----
export const RouletteBetTypeSchema = z.enum([
  'straight', 'split', 'street', 'corner', 'sixline',
  'column', 'dozen', 'red', 'black', 'odd', 'even', 'high', 'low', 'five',
]);
export const RouletteBetSchema = z.object({
  type: RouletteBetTypeSchema,
  amount: z.number().positive(),
  numbers: z.array(z.union([z.number().int().min(0).max(36), z.literal('00')])).optional(),
  selector: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});
export const RouletteDecisionSchema = z.object({
  bets: z.array(RouletteBetSchema).min(1).max(10),
  reasoning,
});

// ---- Baccarat ----
export const BaccaratBetSchema = z.object({
  type: z.enum(['player', 'banker', 'tie', 'playerPair', 'bankerPair']),
  amount: z.number().positive(),
});
export const BaccaratDecisionSchema = z.object({
  bets: z.array(BaccaratBetSchema).min(1).max(4),
  reasoning,
});

// ---- Sic Bo ----
export const SicBoBetSchema = z.object({
  type: z.enum(['small', 'big', 'odd', 'even', 'total', 'single', 'combo', 'double', 'triple', 'anytriple']),
  amount: z.number().positive(),
  total: z.number().int().min(4).max(17).optional(),
  face: z.number().int().min(1).max(6).optional(),
  faces: z.tuple([z.number().int().min(1).max(6), z.number().int().min(1).max(6)]).optional(),
});
export const SicBoDecisionSchema = z.object({
  bets: z.array(SicBoBetSchema).min(1).max(8),
  reasoning,
});

// ---- Slot ----
export const SlotDecisionSchema = z.object({
  amount: z.number().positive(),
  reasoning,
});

// ---- Blackjack ----
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
