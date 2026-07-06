import { useStore } from '../store';
import { fmt, sessionColor, GAME_META } from '../lib/format';

export function SessionsList() {
  const sessions = useStore((s) => s.sessions);
  const activeId = useStore((s) => s.activeId);
  const select = useStore((s) => s.selectSession);
  const remove = useStore((s) => s.removeSession);

  if (sessions.length === 0) {
    return (
      <div className="glass rounded-xl p-4 text-sm text-white/40">
        No sessions yet. Configure one above and hit <span className="text-gold-400">Run</span>.
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-3 flex flex-col gap-2">
      <h2 className="text-sm font-semibold text-white/80 px-1">Sessions ({sessions.length})</h2>
      <div className="flex flex-col gap-2 max-h-[380px] overflow-y-auto pr-1">
      {sessions.map((s) => {
        const up = s.finalBankroll >= s.config.startingBankroll;
        const active = s.config.id === activeId;
        return (
          <button
            key={s.config.id}
            onClick={() => select(s.config.id)}
            className={`text-left rounded-lg px-3 py-2 border transition group ${
              active ? 'bg-white/5 border-gold-500/50' : 'bg-ink-850/50 border-white/5 hover:border-white/20'
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: sessionColor(s.config.id) }} />
              <span className="text-xs">{GAME_META[s.config.game]!.icon}</span>
              <span className="text-sm truncate flex-1">{s.config.label}</span>
              <span
                onClick={(e) => { e.stopPropagation(); remove(s.config.id); }}
                className="opacity-0 group-hover:opacity-60 hover:!opacity-100 text-white/60 text-xs cursor-pointer"
              >✕</span>
            </div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-white/45">
              <span>{s.rounds.length} rounds · {s.config.deciderId.startsWith('llm') ? 'LLM' : 'bot'}{s.stopped ? ' · stopped' : s.bustedOut ? ' · bust' : s.quitVoluntarily ? ' · quit' : s.targetHit ? ' · target hit' : ''}</span>
              <span className={up ? 'text-chip-green' : 'text-chip-red'}>
                {fmt(s.config.startingBankroll)} → {fmt(s.finalBankroll)}
              </span>
            </div>
          </button>
        );
      })}
      </div>
    </div>
  );
}
