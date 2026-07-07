import { useMemo, useState, useCallback, useEffect } from 'react';
import { useStore } from '../store';
import type { RouletteVariant } from '@casino/engine';
import { EXAMPLE_SLOT, SLOT_MAX_BET } from '@casino/engine';
import {
  computeGamblersRuin,
  simulateSlotSessions,
  computeSlotTierBreakdown,
  SLOT_TIERS,
  type GamblersRuinRow,
  type SlotSimulationResult,
  type SlotPerSpinBreakdown,
} from '@casino/core';
import { fmt, pct } from '../lib/format';

type SupportedGame = 'roulette' | 'baccarat' | 'sicbo';

function isSupported(g: string): g is SupportedGame {
  return g === 'roulette' || g === 'baccarat' || g === 'sicbo';
}

function slotBet(form: { ruleBot: { slot: { useMax?: boolean; denomination: number; betLevel: number } }; baseBet: number }): number {
  if (form.ruleBot.slot.useMax) return SLOT_MAX_BET;
  if (form.ruleBot.slot.denomination && form.ruleBot.slot.betLevel) return form.ruleBot.slot.denomination * form.ruleBot.slot.betLevel;
  return form.baseBet;
}

function tierDollarLabel(tier: typeof SLOT_TIERS[number], bet: number): string {
  if (tier.label === 'Miss') return '-$' + bet;
  const min$ = Math.round(tier.minPayout * bet);
  if (tier.maxPayout === Infinity) return '>=$' + min$;
  const max$ = Math.round(tier.maxPayout * bet);
  return '$' + min$ + '–$' + max$;
}

function tierColor(label: string): string {
  const map: Record<string, string> = {
    'Miss': 'text-white/30',
    'Mini win': 'text-sky-300',
    'Nice win': 'text-chip-green',
    'Big win': 'text-violet-300',
    'Mega win': 'text-pink-300',
    'Jackpot': 'text-amber-300',
  };
  return map[label] ?? 'text-white/70';
}

function pctColor(p: number): string {
  if (p >= 0.05) return 'text-chip-green';
  if (p >= 0.001)   return 'text-orange-300';
  return 'text-chip-red';
}

function SlotOutcomeCard({ result, breakdown, bet, bankroll, maxSpins, setMaxSpins, onSimulate, isPending }:
  { result: SlotSimulationResult | null; breakdown: SlotPerSpinBreakdown | null;
    bet: number; bankroll: number; maxSpins: number; setMaxSpins: (n: number) => void; onSimulate: () => void; isPending?: boolean }) {

  return (
    <div className="flex flex-col gap-3">

      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white/80 mb-1">Slot Machine · What to expect</h2>
        <p className="text-xs text-white/40 mb-3">
          Bankroll: <strong>${bankroll}</strong> · Bet: <strong>${bet}/spin</strong> (RTP 93.9% · Hit 20.2%)
        </p>

        <div className="flex items-center gap-2 mb-4">
          <span className="text-xs text-white/50">Spins to play:</span>
          <input type="number" min={1} max={5000} value={maxSpins}
            onChange={(e) => setMaxSpins(Math.max(1, Math.min(5000, +e.target.value || 1)))}
            className="w-20 rounded bg-ink-850 border border-white/10 px-2 py-1 text-xs text-white" />
          <button onClick={onSimulate} disabled={isPending}
            className="rounded bg-gold-500/20 hover:bg-gold-500/30 border border-gold-500/40 px-3 py-1 text-xs text-gold-300 transition disabled:opacity-40 disabled:cursor-wait">
            {isPending ? 'Simulating…' : 'Simulate'}
          </button>
        </div>

        {breakdown && (
          <>
            <table className="w-full text-xs tabular-nums">
              <thead className="text-white/40 text-left">
                <tr>
                  <th className="py-1 pr-3 w-1/2">Outcome</th>
                  <th className="pr-3 text-right w-1/4">Each spin chance</th>
                  <th className="text-right w-1/4">After {maxSpins} spins</th>
                </tr>
              </thead>
              <tbody>
                {breakdown.tiers.filter((t) => t.probability > 0).map((t) => {
                  const tier = SLOT_TIERS.find((s) => s.label === t.label)!;
                  const label = t.label === 'Miss' ? t.label : t.label + ' (' + tierDollarLabel(tier, bet) + ')';
                  const sessionPct = result?.tierHitRates[t.label] ?? 0;
                  return (
                    <tr key={t.label} className="border-t border-white/5">
                      <td className={`py-1 pr-3 font-medium ${tierColor(t.label)}`}>{label}</td>
                      <td className={`pr-3 text-right ${pctColor(t.probability)}`}>{pct(t.probability)}</td>
                      <td className={`text-right font-medium ${sessionPct > 0 ? pctColor(sessionPct) : 'text-white/20'}`}>
                        {sessionPct > 0 ? pct(sessionPct) : '—'}
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t border-white/5">
                  <td className="py-1 pr-3 font-medium text-cyan-300">Free spins bonus (8–20 extra spins)</td>
                  <td className={`pr-3 text-right ${pctColor(breakdown.triggerProb)}`}>{pct(breakdown.triggerProb)}</td>
                  <td className={`text-right font-medium ${pctColor(result?.tierHitRates['Free spins'] ?? 0)}`}>
                    {result ? pct(result.tierHitRates['Free spins']) : pct(breakdown.triggerProb)}
                  </td>
                </tr>
              </tbody>
            </table>

            {result && (
              <div className="mt-3 pt-3 border-t border-white/10 text-[11px] text-white/40 flex flex-wrap gap-x-4 gap-y-1">
                <span>Median survival: <strong className="text-white/70">{result.medianSurvival} spins</strong></span>
                <span>90% bust by: <strong className="text-white/70">{result.p90BustBy} spins</strong></span>
                <span>Expected loss: <strong className="text-chip-red">-${fmt(result.expectedLoss)}</strong></span>
                {isPending && <span className="text-gold-500/60 animate-pulse">⟳ updating…</span>}
              </div>
            )}
          </>
        )}

        {!breakdown && (
          <p className="text-xs text-white/30">Click Simulate to see results.</p>
        )}
      </div>

    </div>
  );
}

export function CompareTable() {
  const form = useStore((s) => s.form);
  const [maxSpins, setMaxSpins] = useState(100);
  const [simKey, setSimKey] = useState(1); // 1 = auto-compute on mount

  const isSlot = form.game === 'slot';

  const targetMoney = form.stopTarget > form.startingBankroll
    ? form.stopTarget
    : form.startingBankroll + form.baseBet * 5;

  const hasConfig = form.game === 'roulette' ? !!form.ruleBot.roulette.type
    : form.game === 'baccarat' ? !!form.ruleBot.baccarat.type
    : form.game === 'sicbo' ? !!form.ruleBot.sicbo.type
    : true;

  // Slot results: computed after paint so the UI never freezes.
  // On mount (simKey=1) and on Simulate click, we schedule the MC simulation
  // via setTimeout(0) — the browser paints first, keeping inputs responsive.
  const [slotResult, setSlotResult] = useState<SlotSimulationResult | null>(null);
  const [isSimPending, setIsSimPending] = useState(false);
  useEffect(() => {
    if (!isSlot) { setSlotResult(null); setIsSimPending(false); return; }
    setIsSimPending(true);
    const bet = slotBet(form);
    const id = setTimeout(() => {
      setSlotResult(simulateSlotSessions({
        config: EXAMPLE_SLOT,
        bet,
        startingBankroll: form.startingBankroll,
        maxSpins,
      }));
      setIsSimPending(false);
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSlot, simKey]);

  // Tier breakdown: compute after first paint so the histogram enumeration
  // (one-time ~50ms) doesn't block initial render.
  const [slotBreakdown, setSlotBreakdown] = useState<SlotPerSpinBreakdown | null>(null);
  useEffect(() => {
    if (!isSlot) { setSlotBreakdown(null); return; }
    const id = requestIdleCallback(() => setSlotBreakdown(computeSlotTierBreakdown(EXAMPLE_SLOT)),
      { timeout: 200 });
    return () => cancelIdleCallback(id);
  }, [isSlot]);

  const onSlotSimulate = useCallback(() => { setSimKey((k) => k + 1); }, []);

  // Non-slot gambler's ruin
  const result = useMemo(() => {
    if (isSlot || !isSupported(form.game)) return null;
    if (!hasConfig) return null;

    const betType = form.game === 'roulette' ? form.ruleBot.roulette.type
      : form.game === 'baccarat' ? form.ruleBot.baccarat.type
      : form.ruleBot.sicbo.type;
    const variant: RouletteVariant | undefined = form.game === 'roulette' ? form.rouletteVariant : undefined;

    return computeGamblersRuin({
      game: form.game,
      betType,
      variant,
      startingBankroll: form.startingBankroll,
      baseBet: form.baseBet,
      targetMoney,
    });
  }, [form.game, form.startingBankroll, form.baseBet, form.stopTarget,
    form.ruleBot.roulette.type, form.ruleBot.baccarat.type, form.ruleBot.sicbo.type,
    form.rouletteVariant, isSlot, hasConfig, targetMoney]);

  // Slot view
  if (isSlot) {
    const bet = slotBet(form);
    return (
      <SlotOutcomeCard
        result={slotResult}
        breakdown={slotBreakdown}
        bet={bet}
        bankroll={form.startingBankroll}
        maxSpins={maxSpins}
        setMaxSpins={setMaxSpins}
        onSimulate={onSlotSimulate}
        isPending={isSimPending}
      />
    );
  }

  // Non-slot view
  const effectiveTarget = form.stopTarget > form.startingBankroll
    ? form.stopTarget
    : form.startingBankroll + form.baseBet * 5;
  const isDefaultTarget = form.stopTarget <= form.startingBankroll;
  const rows = result?.rows ?? [];
  const targetIdx = rows.length - 1;

  return (
    <div className="glass rounded-xl p-4 overflow-auto">
      <h2 className="text-sm font-semibold text-white/80 mb-1">Probability comparison</h2>
      <p className="text-xs text-white/40 mb-3 leading-relaxed">
        Fixed bankroll: <strong>${form.startingBankroll}</strong>
        {result && (
          <> · Bet: <strong>{result.betInfo.label}</strong> (p = {pct(result.effectiveP)})</>
        )}
        . Probability of reaching each winning milest<wbr/>one <strong>before</strong> busting ($0).
        {isDefaultTarget && (
          <span> Target: <strong>${effectiveTarget}</strong>{
            form.stopTarget === 0
              ? ' (auto, 5 steps above start)'
              : ' (stop target is below start, auto-adjusted)'
          }.</span>
        )}
        {!isDefaultTarget && (
          <span> Target: <strong>${effectiveTarget}</strong>.</span>
        )}
      </p>

      {!result || rows.length === 0 ? (
        <p className="text-xs text-white/30">Set a target above the starting bankroll to see the table.</p>
      ) : (
        <table className="w-full text-xs tabular-nums">
          <thead className="text-white/40 text-left">
            <tr>
              <th className="py-1 pr-3">Profit Goal</th>
              <th className="pr-3 text-right">Success %</th>
              <th className="pr-3 text-right">Bust %</th>
              <th className="text-right">Avg Plays</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isTarget = i === targetIdx;
              return (
                <tr
                  key={r.bankroll}
                  className={`border-t border-white/5 transition-colors ${isTarget ? 'bg-gold-500/5' : ''}`}
                >
                  <td className={`py-1 pr-3 font-medium ${isTarget ? 'text-gold-200' : 'text-white/70'}`}>
                    ${r.bankroll}
                    {isTarget && <span className="ml-1.5 text-[10px] text-gold-400/60">← target</span>}
                  </td>
                  <td className={`pr-3 text-right ${r.reachProb > 0.5 ? 'text-chip-green' : 'text-white/70'}`}>
                    {pct(r.reachProb)}
                  </td>
                  <td className={`pr-3 text-right ${r.bustProb > 0.5 ? 'text-chip-red' : 'text-white/70'}`}>
                    {pct(r.bustProb)}
                  </td>
                  <td className="text-right text-white/60">{r.avgPlays.toFixed(1)} bets</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
