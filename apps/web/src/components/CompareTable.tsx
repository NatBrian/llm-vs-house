import { useMemo } from 'react';
import { useStore } from '../store';
import type { RouletteVariant, SicBoBetType, BaccaratBetType, RouletteBetType } from '@casino/engine';
import { computeGamblersRuin, type GamblersRuinRow } from '@casino/core';
import { GAME_META, pct } from '../lib/format';

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

    const defaultTarget = form.startingBankroll * 2;
    const targetMoney = form.stopTarget > form.startingBankroll
      ? form.stopTarget
      : defaultTarget;

    const baseBet = form.baseBet;
    const minTarget = form.startingBankroll + baseBet;
    if (targetMoney < minTarget) return null;

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
      baseBet,
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

  const isDefaultTarget = form.stopTarget <= form.startingBankroll;
  const targetDisplay = isDefaultTarget
    ? form.startingBankroll * 2
    : form.stopTarget;

  if (form.game === 'slot') {
    return (
      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white/80 mb-2">Probability comparison</h2>
        <p className="text-xs text-white/40">Slot machine dynamics don't follow a simple gambler's ruin model — skip analysis here and run a session to see results.</p>
      </div>
    );
  }

  const rows = result?.rows ?? [];
  const startIdx = rows.findIndex((r) => r.bankroll >= form.startingBankroll);
  const targetIdx = rows.length - 1;

  return (
    <div className="glass rounded-xl p-4 overflow-auto">
      <h2 className="text-sm font-semibold text-white/80 mb-1">Probability comparison</h2>
      <p className="text-xs text-white/40 mb-3 leading-relaxed">
        For each bankroll level, the probability of reaching <strong>${targetDisplay}</strong> before busting
        {result && (
          <> · betting <strong>{result.betInfo.label}</strong> (p = {pct(result.effectiveP)})</>
        )}
        .{isDefaultTarget && form.stopTarget !== 0 && (
          <span className="text-chip-yellow"> Stop target is below starting bankroll; using 2× bankroll as target.</span>
        )}
        {isDefaultTarget && form.stopTarget === 0 && (
          <span> No stop target set; using 2× bankroll as target.</span>
        )}
      </p>

      {!result || rows.length === 0 ? (
        <p className="text-xs text-white/30">Set a target above the starting bankroll to see the table.</p>
      ) : (
        <table className="w-full text-xs tabular-nums">
          <thead className="text-white/40 text-left">
            <tr>
              <th className="py-1 pr-3">Bankroll</th>
              <th className="pr-3 text-right">Reach target</th>
              <th className="text-right">Bust</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const isStart = i === startIdx;
              const isEnd = i === targetIdx;
              const highlight = isStart || isEnd;
              return (
                <tr
                  key={r.bankroll}
                  className={`border-t border-white/5 transition-colors ${highlight ? 'bg-gold-500/10' : ''} ${isStart ? 'ring-1 ring-inset ring-gold-500/30' : ''}`}
                >
                  <td className={`py-1 pr-3 font-medium ${highlight ? 'text-gold-300' : 'text-white/70'}`}>
                    ${r.bankroll}
                    {isStart && <span className="ml-1.5 text-[10px] text-gold-400/60">← start</span>}
                    {isEnd && <span className="ml-1.5 text-[10px] text-gold-400/60">← target</span>}
                  </td>
                  <td className={`pr-3 text-right ${r.winProb > 0.5 ? 'text-chip-green' : 'text-white/70'}`}>
                    {pct(r.winProb)}
                  </td>
                  <td className={`text-right ${r.bustProb > 0.5 ? 'text-chip-red' : 'text-white/70'}`}>
                    {pct(r.bustProb)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
