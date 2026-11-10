import { CONFIG, type Config } from './config.ts';

export interface RoomConfigFlags {
  enableCrisisSupport?: boolean;
  enableEvents?: boolean;
  enableTreaties?: boolean;
  enableReflections?: boolean;
  gameSpeedMode?: 'quick' | 'standard';
}

// 방을 만들 때 고른 옵션(위기·지지도, 돌발 사건, 협약, 빠른 모드)을 반영한 설정.
// exportState는 cfg를 저장하지 않으므로, 상태를 불러올 때마다 이 함수로 다시 만들어야 옵션이 유지된다.
export function buildRoomConfig(flags: RoomConfigFlags = {}): Config {
  const quick = flags.gameSpeedMode === 'quick';
  const crisisOn = flags.enableCrisisSupport ?? true;
  return {
    ...CONFIG,
    crisis: { ...CONFIG.crisis, enabled: crisisOn },
    support: { ...CONFIG.support, enabled: crisisOn },
    events: {
      ...CONFIG.events,
      enabled: flags.enableEvents ?? true,
      chance: quick ? 0.25 : 0.5,
    },
    treaties: {
      ...CONFIG.treaties,
      enabled: flags.enableTreaties ?? true,
      rounds: quick ? [3] : [3, 5],
    },
    reflections: {
      ...CONFIG.reflections,
      enabled: flags.enableReflections ?? true,
    },
  };
}
