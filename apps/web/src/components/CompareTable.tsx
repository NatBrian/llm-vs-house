import { useMemo } from 'react';
import { useStore } from '../store';
import type { RouletteVariant } from '@casino/engine';
import { computeGamblersRuin, type GamblersRuinRow } from '@casino/core';
import { pct } from '../lib/format';

type SupportedGame = 'roulette' | 'baccarat' | 'sicbo';

function isSupported(g: string): g is SupportedGame {
  return g === 'roulette' || g === 'baccarat' || g === 'sicbo';
}

export function CompareTable() {
  const form = useStore((s) => s.form);

  const result = useMemo(() => {
    if (!isSupported(form.game)) return null;
    if (form.game === 'roulette' && !form.ruleBot.roulette.type) return null;
    if (form.game === 'baccarat' && !form.ruleBot.baccarat.type) return null;
    if (form.game === 'sicbo' && !form.ruleBot.sicbo.type) return null;

    const targetMoney = form.stopTarget > form.startingBankroll
      ? form.stopTarget
      : form.startingBankroll + form.baseBet * 5;

    let betType: string;
    let variant: RouletteVariant | undefined;

    if (form.game === 'roulette') {
      betType = form.ruleBot.roulette.type;
      variant = form.rouletteVariant;
    } else if (form.game === 'baccarat') {
      betType = form.ruleBot.baccarat.type;
    } else {
      betType = form.ruleBot.sicbo.type;
    }

    return computeGamblersRuin({
      game: form.game,
      betType,
      variant,
      startingBankroll: form.startingBankroll,
      baseBet: form.baseBet,
      targetMoney,
    });
  }, [
    form.game,
    form.startingBankroll,
    form.baseBet,
    form.stopTarget,
    form.ruleBot,
    form.rouletteVariant,
  ]);

  const effectiveTarget = form.stopTarget > form.startingBankroll
    ? form.stopTarget
    : form.startingBankroll + form.baseBet * 5;

  const isDefaultTarget = form.stopTarget <= form.startingBankroll;

  if (form.game === 'slot') {
    return (
      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white/80 mb-2">Probability comparison</h2>
        <p className="text-xs text-white/40">Slot machine dynamics don't follow a simple gambler's ruin model — run a session to see results.</p>
      </div>
    );
  }

  const rows = result?.rows ?? [];
  const startIdx = result ? result.startingUnits : -1;
  const targetIdx = result ? result.targetUnits : -1;

  return (
    <div className="glass rounded-xl p-4 overflow-auto">
      <h2 className="text-sm font-semibold text-white/80 mb-1">Probability comparison</h2>
      <p className="text-xs text-white/40 mb-3 leading-relaxed">
        Starting from a fixed bankroll of <strong>${form.startingBankroll}</strong>
        {result && (
          <> · betting <strong>{result.betInfo.label}</strong> (p = {pct(result.effectiveP)})</>
        )}
        , the probability of reaching each milest<wbr/>one <strong>before</strong> busting (hitting $0).
        Milestones at or below the starting bankroll are already reached.
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
              <th className="py-1 pr-3">Milestone</th>
              <th className="pr-3 text-right">Reach milestone</th>
              <th className="text-right">Bust before milestone</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isStart = i === startIdx;
              const isTarget = i === targetIdx;
              const isAlreadyReached = i <= startIdx;
              return (
                <tr
                  key={r.bankroll}
                  className={`border-t border-white/5 transition-colors ${isStart ? 'ring-1 ring-inset ring-gold-500/30 bg-gold-500/10' : ''} ${isTarget && !isStart ? 'bg-gold-500/5' : ''}`}
                >
                  <td className={`py-1 pr-3 font-medium ${isStart ? 'text-gold-300' : isTarget ? 'text-gold-200' : 'text-white/70'}`}>
                    ${r.bankroll}
                    {isStart && <span className="ml-1.5 text-[10px] text-gold-400/60">← start</span>}
                    {isTarget && !isStart && <span className="ml-1.5 text-[10px] text-gold-400/60">← target</span>}
                  </td>
                  {isAlreadyReached ? (
                    <>
                      <td className="pr-3 text-right text-chip-green">Already reached</td>
                      <td className="text-right text-white/30">{pct(0)}</td>
                    </>
                  ) : (
                    <>
                      <td className={`pr-3 text-right ${r.reachProb > 0.5 ? 'text-chip-green' : 'text-white/70'}`}>
                        {pct(r.reachProb)}
                      </td>
                      <td className={`text-right ${r.bustProb > 0.5 ? 'text-chip-red' : 'text-white/70'}`}>
                        {pct(r.bustProb)}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
