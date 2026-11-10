import React from 'react';
import { earthEnding, ENDING_NAMES, worldStats } from '../../game/engine.ts';
import type { GameState } from '../../game/engine.ts';
import { assetUrl } from '../../game/assets.ts';
import { AlertTriangle, Globe, ArrowRight, ShieldAlert, Sparkles, Scale } from 'lucide-react';
import { CONFIG } from '../../game/config.ts';

interface EarthEndingViewProps {
  gameState: GameState;
  onProceedToCourt?: () => void;
  isTeacher?: boolean;
}

export const EarthEndingView: React.FC<EarthEndingViewProps> = ({
  gameState,
  onProceedToCourt,
  isTeacher = false,
}) => {
  const result = earthEnding(gameState);
  const endingKey = result.ending;
  const endingTitle = ENDING_NAMES[endingKey];

  // Analyze causes
  const avg = result.avg;
  const collapsedAxes = (['health', 'ecology', 'society'] as const).filter(
    (ax) => avg[ax] < CONFIG.ending.collapseLine
  );

  let explanation = '';
  if (collapsedAxes.length >= 2) {
    explanation = '2개 이상의 핵심 영역(건강/생태/사회)이 붕괴선 아래로 추락하여 문명 전체가 연쇄적 파국에 도달했습니다.';
  } else if (collapsedAxes[0] === 'ecology') {
    explanation = '유전자 변형 농업의 과도한 확산과 슈퍼 잡초 및 다양성 상실로 생태계 수치가 회복 불가능하게 무너졌습니다.';
  } else if (collapsedAxes[0] === 'health') {
    explanation = '통제되지 않은 유전자 편집의 부작용과 변이로 인해 전 인류의 건강 지표가 붕괴선 밑으로 곤두박질쳤습니다.';
  } else if (collapsedAxes[0] === 'society') {
    explanation = 'AI 추천과 무단 실험, 유전자 차별이 심화되어 사회적 신뢰와 인간다운 판단력이 완전히 와해되었습니다.';
  } else if (result.top2 >= CONFIG.ending.wealthTop2Share) {
    explanation = `상위 2개 부유국이 세계 부의 ${Math.round(result.top2 * 100)}%를 독점하고 대다수 나라는 빈곤과 오염에 갇혔습니다.`;
  } else if (endingKey === 'together') {
    explanation = '모든 국가가 적정 기술을 나누고 서로를 지키며 불평등과 파국을 극복하여 다 함께 지속가능한 2075년을 맞이했습니다!';
  } else {
    explanation = '국가 간 빈부 격차와 오염 피해의 불평등으로 부유한 나라들만의 고립된 섬들이 형성되었습니다.';
  }

  // Pending harms for future generations
  const futureHarms = gameState.harms.filter((h) => !h.arrived);
  const totalFutureHarm = futureHarms.reduce(
    (acc, h) => acc + h.amount.health + h.amount.ecology + h.amount.society,
    0
  );

  // Cumulative loss caused by neglected background crises
  const totalCrisisLoss = gameState.countries.reduce((acc, c) => acc + (c.lostToCrisis || 0), 0);

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8 space-y-8 animate-fade-in text-white">
      {/* Title Banner */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-950/80 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Globe className="w-4 h-4" />
          2075년 지구 시뮬레이션 최종 결과
        </div>
        <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white drop-shadow">
          {endingTitle}
        </h1>
        <p className="text-slate-300 text-base md:text-lg max-w-2xl mx-auto break-keep">
          6개 국가가 5라운드 동안 내린 선택들이 하나로 모여 만들어 낸 우리의 2075년입니다.
        </p>
      </div>

      {/* Main Visual & Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Large Artwork */}
        <div className="lg:col-span-7 relative rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-950 shadow-2xl flex flex-col justify-end min-h-[320px]">
          <img
            src={assetUrl(`ending_${endingKey}` as any)}
            alt={endingTitle}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src = assetUrl('ending_islands');
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
          <div className="relative p-6 space-y-2">
            <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
              Ending Scenario
            </span>
            <h2 className="text-2xl font-bold text-white">{endingTitle}</h2>
            <p className="text-slate-200 text-sm leading-relaxed">{explanation}</p>
          </div>
        </div>

        {/* Global Statistics & Causes */}
        <div className="lg:col-span-5 flex flex-col justify-between gap-4 p-6 bg-slate-900/90 rounded-2xl border border-slate-700 shadow-xl">
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              지구 평균 지표
            </h3>

            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-rose-400">건강 (Health)</span>
                  <span>{Math.round(avg.health)} / 100</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${avg.health < 55 ? 'bg-red-500' : 'bg-rose-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, avg.health))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-emerald-400">생태 (Ecology)</span>
                  <span>{Math.round(avg.ecology)} / 100</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${avg.ecology < 55 ? 'bg-red-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, avg.ecology))}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span className="text-sky-400">사회 (Society)</span>
                  <span>{Math.round(avg.society)} / 100</span>
                </div>
                <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${avg.society < 55 ? 'bg-red-500' : 'bg-sky-500'}`}
                    style={{ width: `${Math.min(100, Math.max(0, avg.society))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-800/80 rounded-xl text-xs space-y-1.5 border border-slate-700">
              <div className="flex justify-between">
                <span className="text-slate-400">상위 2개국 부 집중도:</span>
                <span className="font-bold text-amber-400">{Math.round(result.top2 * 100)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">세계 적정기술 보호막 누적:</span>
                <span className="font-bold text-teal-400">{result.appro} 단계</span>
              </div>
            </div>
          </div>

          {/* Future Generations Harm Callout */}
          <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-rose-300 font-bold text-xs uppercase">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              미래 세대 몫으로 남겨진 피해
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              게임이 끝난 뒤에도 아직 도착하지 않은 피해 수치가 총 <strong className="text-rose-400 font-bold">{Math.round(totalFutureHarm)}</strong> 남아 있습니다. 이 지연된 피해는 고스란히 다음 세대가 떠안게 됩니다.
            </p>
          </div>

          {gameState.cfg.crisis?.enabled && totalCrisisLoss > 0 && (
            <div className="p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-xs uppercase">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                방치된 배경 위기로 잃은 점수
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                질병·식량·인력 위기를 제때 해결하지 못해 전 세계에서 총 <strong className="text-amber-400 font-bold">{Math.round(totalCrisisLoss)}점</strong>의 생존 지표가 깎였습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Button to Proceed to Court */}
      <div className="flex justify-center pt-4">
        {onProceedToCourt ? (
          <button
            onClick={onProceedToCourt}
            className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 hover:from-amber-500 hover:to-amber-500 text-slate-950 font-black text-lg rounded-2xl shadow-xl hover:shadow-amber-500/30 transition-all cursor-pointer transform hover:scale-105"
          >
            <Scale className="w-6 h-6 text-slate-950" />
            <span>미래 세대 법정으로 이동하기</span>
            <ArrowRight className="w-5 h-5 text-slate-950" />
          </button>
        ) : (
          <div className="text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <Scale className="w-4 h-4 text-amber-400" />
            선생님이 미래 세대 법정 판결을 시작하기를 기다리고 있습니다...
          </div>
        )}
      </div>
    </div>
  );
};
