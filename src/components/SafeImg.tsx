import React, { useState } from 'react';
import { assetUrl, type AssetName } from '../game/assets.ts';

// 각 에셋에 대응되는 직관적인 폴백 이모지 매핑
export const ASSET_FALLBACK_EMOJI: Record<string, string> = {
  // 위기 게이지
  icon_crisis_bio: '🧬',
  icon_crisis_agri: '🌾',
  icon_crisis_ai: '🤖',
  // 국민 지지도
  icon_support: '🤝',
  // 국방 및 전쟁
  icon_defense: '🛡️',
  icon_war: '⚔️',
  // 세계 소식
  icon_news: '📰',
  scene_news: '📡',
  // 돌발 사건
  icon_event: '⚡',
  scene_event_accident: '🚨',
  scene_event_discovery: '💡',
  // 국제 협약
  icon_treaty: '📜',
  scene_treaty: '🌐',
  // 사상 단체
  icon_faction_tradition: '🌿',
  icon_faction_progress: '🚀',
  icon_faction_fair: '⚖️',
  // 시위 및 위기/전쟁 장면
  scene_protest: '📢',
  scene_crisis_bio: '☣️',
  scene_crisis_agri: '🏜️',
  scene_crisis_ai: '💻',
  scene_war: '💥',
  // 법정 판결
  icon_verdict_war: '⚔️',
  icon_verdict_defenseless: '🛡️',
  icon_verdict_neglect: '🥀',
  icon_verdict_clear: '🕊️',
  icon_verdict_unseen: '👁️',
  icon_verdict_ignored: '⚠️',
  icon_verdict_exported: '🚢',
  icon_verdict_sold: '💰',
  icon_verdict_unaware: '❓',
  icon_verdict_rider: '🛹',
  // 하루 반응
  char_haru_normal: '👧',
  char_haru_worried: '😟',
  char_haru_serious: '🧐',
  char_haru_hopeful: '✨',
  char_haru_surprised: '😲',
  char_haru_proud: '😊',
  char_haru_nervous: '😰',
  char_haru_cheer: '🙌',
  // 기술 영역 아이콘
  icon_bio: '🧬',
  icon_agri: '🌾',
  icon_ai: '🤖',
  icon_appro: '🛠️',
  icon_investigate: '🔍',
  icon_vote_yes: '⭕',
  icon_vote_no: '❌',
};

interface SafeImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  name: AssetName;
  fallbackEmoji?: string;
  fallbackText?: string;
}

export const SafeImg: React.FC<SafeImgProps> = ({
  name,
  fallbackEmoji,
  fallbackText,
  className = '',
  alt = '',
  ...rest
}) => {
  const [hasError, setHasError] = useState(false);
  const emoji = fallbackEmoji || ASSET_FALLBACK_EMOJI[name] || '📌';

  if (hasError) {
    return (
      <div
        className={`inline-flex flex-col items-center justify-center select-none bg-slate-800/80 text-white rounded-xl border border-slate-700/60 overflow-hidden ${className}`}
        title={alt || name}
      >
        <span className="text-xl leading-none">{emoji}</span>
        {fallbackText && <span className="text-[10px] mt-0.5 opacity-80">{fallbackText}</span>}
      </div>
    );
  }

  return (
    <img
      src={assetUrl(name)}
      alt={alt || name}
      onError={() => setHasError(true)}
      className={className}
      {...rest}
    />
  );
};
