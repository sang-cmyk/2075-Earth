import React from 'react';
import { Heart, Trees, Users, Coins, Shield } from 'lucide-react';
import type { Stats, DomainId } from '../game/config.ts';
import { assetUrl } from '../game/assets.ts';
import { SafeImg } from './SafeImg.tsx';

interface GaugesProps {
  stats: Stats;
  money: number;
  shield?: number;
  compact?: boolean;
}

export const Gauges: React.FC<GaugesProps> = ({ stats, money, shield = 0, compact = false }) => {
  const getBarColor = (val: number) => {
    if (val <= 50) return 'bg-red-500 text-red-400';
    if (val <= 70) return 'bg-amber-500 text-amber-400';
    return 'bg-emerald-500 text-emerald-400';
  };

  const items = [
    { label: '건강', val: Math.round(stats.health), icon: Heart, color: 'text-rose-400', bg: 'bg-rose-500' },
    { label: '생태', val: Math.round(stats.ecology), icon: Trees, color: 'text-emerald-400', bg: 'bg-emerald-500' },
    { label: '사회', val: Math.round(stats.society), icon: Users, color: 'text-sky-400', bg: 'bg-sky-500' },
  ];

  return (
    <div className={`flex flex-col gap-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Money & Shield */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-800/80 rounded-lg border border-slate-700">
        <div className="flex items-center gap-1.5 font-bold text-amber-400">
          <Coins className={compact ? 'w-4 h-4' : 'w-5 h-5'} />
          <span>{Math.round(money)}</span>
          <span className="text-[11px] font-normal text-slate-400">자금</span>
        </div>
        {shield > 0 && (
          <div className="flex items-center gap-1 text-teal-400 font-semibold text-xs">
            <Shield className="w-3.5 h-3.5" />
            <span>보호막 {Math.round(shield * 5)}%</span>
          </div>
        )}
      </div>

      {/* Axis Gauges */}
      <div className="grid grid-cols-3 gap-2">
        {items.map((it) => {
          const Icon = it.icon;
          return (
            <div key={it.label} className="flex flex-col gap-1 p-2 bg-slate-800/60 rounded-lg border border-slate-700/60">
              <div className="flex items-center justify-between">
                <span className={`flex items-center gap-1 font-semibold ${it.color}`}>
                  <Icon className="w-3.5 h-3.5" />
                  {it.label}
                </span>
                <span className="font-bold text-white text-xs">{it.val}</span>
              </div>
              <div className="w-full h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${it.bg}`}
                  style={{ width: `${Math.min(100, Math.max(0, it.val))}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface CountryVisualProps {
  countryId: number;
  stats: Stats;
  className?: string;
  showDomainOverlays?: boolean;
}

export const CountryVisual: React.FC<CountryVisualProps> = ({
  countryId,
  stats,
  className = 'w-full h-40',
  showDomainOverlays = true,
}) => {
  const getDomainState = (score: number): 'good' | 'shaky' | 'bad' => {
    if (score < 55) return 'bad';
    if (score < 75) return 'shaky';
    return 'good';
  };

  const bioState = getDomainState(stats.health);
  const agriState = getDomainState(stats.ecology);
  const aiState = getDomainState(stats.society);

  return (
    <div className={`relative overflow-hidden rounded-xl border border-slate-700 bg-slate-950 flex items-center justify-center ${className}`}>
      {/* Base Country Image */}
      <img
        src={assetUrl('country_base_normal')}
        alt={`국가 ${countryId + 1}`}
        className="absolute inset-0 w-full h-full object-cover opacity-85"
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />

      {/* Overlays */}
      {showDomainOverlays && (
        <div className="absolute inset-0 grid grid-cols-3 gap-1 p-1 bg-black/35 backdrop-blur-[1px]">
          <div className="relative rounded overflow-hidden border border-white/10 group">
            <img
              src={assetUrl(`state_bio_${bioState}` as any)}
              alt="의료/생명공학 상태"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1 py-0.5 rounded bg-black/60 text-white">
              의료: {bioState === 'good' ? '안정' : bioState === 'shaky' ? '위태' : '위기'}
            </span>
          </div>

          <div className="relative rounded overflow-hidden border border-white/10 group">
            <img
              src={assetUrl(`state_agri_${agriState}` as any)}
              alt="농업/생태계 상태"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1 py-0.5 rounded bg-black/60 text-white">
              생태: {agriState === 'good' ? '풍요' : agriState === 'shaky' ? '획일' : '황폐'}
            </span>
          </div>

          <div className="relative rounded overflow-hidden border border-white/10 group">
            <img
              src={assetUrl(`state_ai_${aiState}` as any)}
              alt="사회/AI 상태"
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
            />
            <span className="absolute bottom-1 left-1 text-[10px] font-bold px-1 py-0.5 rounded bg-black/60 text-white">
              사회: {aiState === 'good' ? '조화' : aiState === 'shaky' ? '중독' : '분열'}
            </span>
          </div>
        </div>
      )}

      {/* Country Tag Badge */}
      <div className="absolute top-2 left-2 z-10 px-2.5 py-1 rounded-md bg-slate-900/90 border border-slate-700 text-xs font-bold text-emerald-300 shadow">
        제{countryId + 1}국
      </div>
    </div>
  );
};

interface CrisisSupportGaugesProps {
  pressure: Record<DomainId, number>;
  support: number;
  compact?: boolean;
  demandedDomain?: DomainId | null;
  protested?: boolean;
}

export const CrisisSupportGauges: React.FC<CrisisSupportGaugesProps> = ({
  pressure,
  support,
  compact = false,
  demandedDomain,
  protested,
}) => {
  // Crisis color: < 40 초록, 40~70 노랑, > 70 빨강
  const getCrisisColor = (val: number) => {
    if (val < 40) return { text: 'text-emerald-400', bar: 'bg-emerald-500', label: '양호' };
    if (val <= 70) return { text: 'text-amber-400', bar: 'bg-amber-500', label: '주의' };
    return { text: 'text-rose-400', bar: 'bg-rose-500', label: '심각' };
  };

  // Support color (반대): >= 70 초록, 40~69 노랑, < 40 빨강
  const getSupportColor = (val: number) => {
    if (val >= 70) return { text: 'text-emerald-400', bar: 'bg-emerald-500', label: '양호' };
    if (val >= 40) return { text: 'text-amber-400', bar: 'bg-amber-500', label: '보통' };
    return { text: 'text-rose-400', bar: 'bg-rose-500', label: '위험' };
  };

  const crises = [
    { id: 'bio' as DomainId, label: '질병·고령화', val: Math.round(pressure.bio ?? 0), iconName: 'icon_crisis_bio' as const, fallback: '🧬' },
    { id: 'agri' as DomainId, label: '식량·기후', val: Math.round(pressure.agri ?? 0), iconName: 'icon_crisis_agri' as const, fallback: '🌾' },
    { id: 'ai' as DomainId, label: '인력·격차', val: Math.round(pressure.ai ?? 0), iconName: 'icon_crisis_ai' as const, fallback: '🤖' },
  ];

  const sup = getSupportColor(support);

  return (
    <div className={`p-3 bg-slate-900/90 rounded-2xl border border-slate-700/80 shadow-md space-y-2.5 ${compact ? 'text-xs' : 'text-sm'}`}>
      {/* Support and Crisis summary header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-800">
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-slate-300 flex items-center gap-1.5">
              <SafeImg name="icon_support" fallbackEmoji="🤝" className="w-4 h-4 object-contain inline-block" />
              <span>국민 지지도</span>
            </span>
            <span className={`font-mono font-black ${sup.text}`}>
              {Math.round(support)}% ({sup.label})
            </span>
          </div>
          <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
            <div
              className={`h-full transition-all duration-500 rounded-full ${sup.bar}`}
              style={{ width: `${Math.min(100, Math.max(0, support))}%` }}
            />
          </div>
        </div>

        {/* Warning chips for low support */}
        {support < 40 && (
          <span className="px-2 py-0.5 rounded-full bg-rose-950 border border-rose-500/50 text-rose-300 text-[10px] font-bold animate-pulse whitespace-nowrap">
            {support < 10 ? '정권 위기' : support < 25 ? '국민 요구' : '시위 발생'}
          </span>
        )}
      </div>

      {/* 3 Crisis Gauges */}
      <div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
          <span>배경 위기 압력 (40 초과 시 매 라운드 수치 삭감)</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {crises.map((c) => {
            const color = getCrisisColor(c.val);
            const isOver = c.val > 40;
            return (
              <div
                key={c.id}
                className={`p-2 rounded-xl border flex flex-col gap-1 ${
                  isOver ? 'bg-slate-950 border-amber-500/30' : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 text-[11px] flex items-center gap-1">
                    <SafeImg name={c.iconName} fallbackEmoji={c.fallback} className="w-3.5 h-3.5 object-contain inline-block" />
                    <span className="truncate">{c.label}</span>
                  </span>
                  <span className={`font-mono font-bold text-xs ${color.text}`}>
                    {c.val}
                  </span>
                </div>
                <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 rounded-full ${color.bar}`}
                    style={{ width: `${Math.min(100, Math.max(0, c.val))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Demand & Protest notices */}
      {demandedDomain && (
        <div className="p-2 bg-amber-950/60 border border-amber-500/50 rounded-xl text-xs text-amber-300 font-bold flex items-center gap-1.5">
          <span>⚠️</span>
          <span>국민이 {demandedDomain === 'bio' ? '생명공학' : demandedDomain === 'agri' ? '농업' : '인공지능'} 개발을 강력히 요구하여 0단계 투표가 불가합니다!</span>
        </div>
      )}
      {protested && (
        <div className="p-2 bg-rose-950/70 border border-rose-500/50 rounded-xl text-[11px] text-rose-300 font-medium flex items-center gap-2">
          <SafeImg name="scene_protest" fallbackEmoji="📢" className="w-6 h-6 object-contain flex-shrink-0" />
          <span>국민 시위 진행 중: 낮은 지지도로 인해 이번 라운드 국가 자금 5%가 감소했습니다.</span>
        </div>
      )}
    </div>
  );
};

export const getCountryCrisisBadge = (pressure: Record<DomainId, number> | undefined, support: number | undefined) => {
  if (!pressure || support === undefined) return null;
  const maxP = Math.max(pressure.bio || 0, pressure.agri || 0, pressure.ai || 0);

  const crisisStatus = maxP > 70 ? '심각' : maxP >= 40 ? '보통' : '양호';
  const crisisClass =
    crisisStatus === '심각'
      ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
      : crisisStatus === '보통'
      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';

  const supportStatus = support >= 70 ? '양호' : support >= 40 ? '보통' : '심각';
  const supportClass =
    supportStatus === '심각'
      ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
      : supportStatus === '보통'
      ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
      : 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50';

  return {
    crisisStatus,
    crisisClass,
    supportStatus,
    supportClass,
  };
};
