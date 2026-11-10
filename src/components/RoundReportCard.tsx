import type { Country } from '../game/engine.ts';
import { findEvent } from '../game/engine.ts';
import { CONFIG } from '../game/config.ts';

const domLabel = (id: string) => CONFIG.domains.find((d) => d.id === id)?.label ?? id;
const domIcon = (id: string) => CONFIG.domains.find((d) => d.id === id)?.icon ?? '';
const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);

/**
 * 한 나라의 "이번 라운드 선택 → 결과" 인과 카드.
 * 학생 화면(우리 나라)과 교사 화면(전체 모둠) 모두에서 쓴다.
 */
export function RoundReportCard({
  country,
  compact = false,
}: {
  country: Country;
  compact?: boolean;
}) {
  const r = country.lastReport;
  if (!r) return <p className="text-xs text-slate-400">결과를 불러오는 중이에요...</p>;

  const incomeSum = r.income.reduce((s, x) => s + x.amount, 0);
  const feeSum = r.fees.reduce((s, x) => s + x.amount, 0);
  const royaltyInSum = (r.royaltyIn ?? []).reduce((s, x) => s + x.amount, 0);
  const spent = r.dev.reduce((s, x) => s + x.cost - x.refund, 0) + (r.appro?.cost ?? 0);

  // 내가 일으킨 피해를 사건별로 묶는다
  const sentMap = new Map<string, { self: number; others: { to: number; total: number }[] }>();
  for (const s of r.sent) {
    const g = sentMap.get(s.eventId) ?? { self: 0, others: [] };
    if (s.spill) g.others.push({ to: s.to, total: s.total });
    else g.self += s.total;
    sentMap.set(s.eventId, g);
  }

  return (
    <div className={`space-y-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
      {/* 1. 내가 한 선택의 결과 */}
      <div className="space-y-1">
        <div className="font-black text-slate-300">① 내가 한 선택은 어떻게 됐나</div>
        {r.dev.length === 0 && !r.appro && <div className="text-slate-500">이번 라운드에는 투자하지 않았어요.</div>}
        {r.dev.map((d) => (
          <div
            key={d.domain}
            className={`flex items-center justify-between gap-2 p-2 rounded-lg border ${
              d.success ? 'bg-emerald-950/40 border-emerald-600/40' : 'bg-rose-950/40 border-rose-600/40'
            }`}
          >
            <span className="font-bold text-white break-keep">
              {domIcon(d.domain)} {domLabel(d.domain)} {d.level}단계
            </span>
            <span className={d.success ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
              {d.success ? '개발 성공' : `개발 실패 (비용 ${d.cost} 중 ${d.refund} 환급)`}
            </span>
          </div>
        ))}
        {r.appro && (
          <div className="flex items-center justify-between gap-2 p-2 rounded-lg border bg-slate-950/60 border-slate-700">
            <span className="font-bold text-white">🌱 적정 기술 {r.appro.level}단계</span>
            <span className={r.appro.success ? 'text-emerald-300 font-bold' : 'text-rose-300 font-bold'}>
              {r.appro.success ? '성공' : '실패'}
            </span>
          </div>
        )}
      </div>

      {/* 2. 돈의 흐름 */}
      <div className="space-y-1">
        <div className="font-black text-slate-300">② 돈은 어떻게 움직였나</div>
        <div className="grid grid-cols-2 gap-1">
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            투자 비용 <strong className="text-rose-300">-{spent}</strong>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800">
            시장 수익 <strong className="text-emerald-300">+{incomeSum}</strong>
          </div>
          {(r.upkeep ?? 0) > 0 && (
            <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 col-span-2">
              🔧 기술 유지비 <strong className="text-rose-300">-{r.upkeep}</strong>
              <span className="text-slate-400"> (가진 기술 단계 합계 × {CONFIG.upkeepPerLevel})</span>
            </div>
          )}
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 col-span-2">
            💸 로열티 지출 <strong className="text-rose-300">-{feeSum}</strong>
            {r.fees.length > 0 && (
              <span className="text-slate-400">
                {' '}
                ({r.fees.map((f) => `${domLabel(f.domain)} → ${(f.to ?? []).map((t) => `제${t + 1}국`).join('·')} ${f.amount}`).join(', ')})
              </span>
            )}
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800 col-span-2">
            💰 로열티 수입 <strong className="text-emerald-300">+{royaltyInSum}</strong>
            {(r.royaltyIn ?? []).length > 0 && (
              <span className="text-slate-400">
                {' '}
                ({(r.royaltyIn ?? []).map((f) => `제${f.from + 1}국 ${domLabel(f.domain)} ${f.amount}`).join(', ')})
              </span>
            )}
          </div>
        </div>
        {(r.debt ?? 0) > 0 && (
          <div className="p-2 rounded-lg bg-amber-950/50 border border-amber-500/50 text-amber-200 font-bold">
            ⚠️ 재정 적자! 로열티를 다 못 내서 빚 {r.debt}이 남았어요. 빚이 {CONFIG.bankruptcyDebt} 이상이 되면 재정 파탄이에요.
          </div>
        )}
        {r.bankrupt && (
          <div className="p-2 rounded-lg bg-rose-950/70 border border-rose-500 text-rose-200 font-black">
            🏚️ 재정 파탄! 모든 스탯과 지지도가 크게 깎이고 다음 라운드 투자가 막혀요.
          </div>
        )}
        <div className="text-slate-400">
          자금 {r.moneyStart} → <strong className="text-white">{Math.round(country.money)}</strong>{' '}
          <span className={country.money - r.moneyStart >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            ({sign(Math.round(country.money - r.moneyStart))})
          </span>
        </div>
      </div>

      {/* 3. 내 선택이 남에게 준 영향 */}
      {sentMap.size > 0 && (
        <div className="space-y-1">
          <div className="font-black text-slate-300">③ 내 선택이 만든 피해 (다음 라운드에 도착)</div>
          {[...sentMap.entries()].map(([eventId, g]) => (
            <div key={eventId} className="p-2 rounded-lg bg-amber-950/30 border border-amber-600/40 space-y-0.5">
              <div className="font-bold text-amber-300 break-keep">{findEvent(CONFIG, eventId)?.title ?? eventId}</div>
              <div className="text-slate-300">
                우리 나라 <strong className="text-rose-300">-{Math.round(g.self * 10) / 10}</strong>
                {g.others.length > 0 && (
                  <>
                    {' · '}다른 나라:{' '}
                    {g.others.map((o) => `제${o.to + 1}국 -${Math.round(o.total * 10) / 10}`).join(', ')}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 4. 지지도 */}
      <div className="space-y-1">
        <div className="font-black text-slate-300">④ 국민 지지도</div>
        <div className="text-slate-300">
          {Math.round(country.support)}%{' '}
          <span className={r.supportDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>({sign(r.supportDelta)})</span>
        </div>
        {r.supportEffects.map((e, i) => (
          <div key={i} className="p-2 rounded-lg bg-sky-950/40 border border-sky-600/40 text-sky-200 break-keep">
            {e}
          </div>
        ))}
      </div>
    </div>
  );
}
