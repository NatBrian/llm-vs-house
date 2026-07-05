import ReactECharts from 'echarts-for-react';
import { useStore, computeStats } from '../store';
import { fmt, signed, pct, sessionColor, GAME_META } from '../lib/format';

export function Dashboard() {
  const sessions = useStore((s) => s.sessions);

  if (sessions.length === 0) {
    return <div className="glass rounded-xl p-10 text-center text-white/40">Run one or more sessions to compare them here.</div>;
  }

  const stats = sessions.map((s) => ({ session: s, stats: computeStats(s) }));
  const maxLen = Math.max(...stats.map((x) => x.stats.bankrollSeries.length));

  const bankrollOption = {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 20, top: 30, bottom: 40 },
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#9fb0c0' }, top: 0, type: 'scroll' },
    xAxis: {
      type: 'category',
      name: 'round',
      nameTextStyle: { color: '#6b7d8d' },
      data: Array.from({ length: maxLen }, (_, i) => i),
      axisLine: { lineStyle: { color: '#2a3846' } },
      axisLabel: { color: '#6b7d8d' },
    },
    yAxis: {
      type: 'value', name: 'bankroll',
      nameTextStyle: { color: '#6b7d8d' },
      splitLine: { lineStyle: { color: '#1d2731' } },
      axisLabel: { color: '#6b7d8d' },
    },
    series: stats.map(({ session, stats }) => ({
      name: session.config.label,
      type: 'line',
      showSymbol: false,
      smooth: false,
      lineStyle: { width: 2, color: sessionColor(session.config.id) },
      itemStyle: { color: sessionColor(session.config.id) },
      data: stats.bankrollSeries,
    })),
  };

  const netOption = {
    backgroundColor: 'transparent',
    grid: { left: 48, right: 20, top: 20, bottom: 60 },
    tooltip: { trigger: 'axis' },
    xAxis: {
      type: 'category',
      data: stats.map((x) => x.session.config.label),
      axisLabel: { color: '#6b7d8d', interval: 0, rotate: 30, fontSize: 10 },
      axisLine: { lineStyle: { color: '#2a3846' } },
    },
    yAxis: { type: 'value', name: 'net pts', splitLine: { lineStyle: { color: '#1d2731' } }, axisLabel: { color: '#6b7d8d' }, nameTextStyle: { color: '#6b7d8d' } },
    series: [{
      type: 'bar',
      data: stats.map((x) => ({ value: x.stats.net, itemStyle: { color: sessionColor(x.session.config.id) } })),
      barWidth: '55%',
    }],
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="glass rounded-xl p-4">
        <h2 className="text-sm font-semibold text-white/80 mb-2">Bankroll over time</h2>
        <ReactECharts option={bankrollOption} style={{ height: 300 }} notMerge lazyUpdate />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="glass rounded-xl p-4">
          <h2 className="text-sm font-semibold text-white/80 mb-2">Net result</h2>
          <ReactECharts option={netOption} style={{ height: 240 }} notMerge lazyUpdate />
        </div>

        <div className="glass rounded-xl p-4 overflow-auto">
          <h2 className="text-sm font-semibold text-white/80 mb-2">Aggregate stats</h2>
          <table className="w-full text-xs">
            <thead className="text-white/40 text-left">
              <tr>
                <th className="py-1 pr-2">Session</th><th className="pr-2">Game</th>
                <th className="pr-2 text-right">Win%</th><th className="pr-2 text-right">EV/rd</th>
                <th className="pr-2 text-right">ROI</th><th className="text-right">Net</th>
              </tr>
            </thead>
            <tbody>
              {stats.map(({ session, stats }) => (
                <tr key={session.config.id} className="border-t border-white/5">
                  <td className="py-1.5 pr-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ background: sessionColor(session.config.id) }} />
                    <span className="truncate max-w-[110px]">{session.config.label}</span>
                  </td>
                  <td className="pr-2">{GAME_META[session.config.game]!.icon}</td>
                  <td className="pr-2 text-right tabular-nums">{pct(stats.winRate)}</td>
                  <td className="pr-2 text-right tabular-nums">{fmt(stats.evPerRound)}</td>
                  <td className="pr-2 text-right tabular-nums">{pct(stats.roi)}</td>
                  <td className={`text-right tabular-nums font-medium ${stats.net >= 0 ? 'text-chip-green' : 'text-chip-red'}`}>{signed(stats.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
