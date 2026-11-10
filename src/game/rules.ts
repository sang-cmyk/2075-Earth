import type { Config } from './config.ts';

export function rulesText(cfg: Config): string[] {
  const rows: string[] = [];
  rows.push(`우리 모둠은 하나의 나라입니다. ${cfg.rounds}라운드 동안 모둠원 모두가 투표하고, 표가 가장 많은 쪽으로 결정됩니다.`);
  rows.push(`처음에 받는 돈은 ${cfg.startMoney}이고, 이후에는 더 받지 못합니다. 돈이 늘어나는 길은 개발에 성공해 시장에서 버는 것뿐입니다.`);
  rows.push('같은 표가 나오면 한 번 더 투표하고, 그래도 같으면 돈이 덜 드는 낮은 단계로 정해집니다.');
  for (const d of cfg.domains) {
    const costs = d.cost.slice(1).join(' / ');
    const chances = d.success.slice(1).map((p) => `${Math.round(p * 100)}%`).join(' / ');
    rows.push(`${d.icon} ${d.label}: 단계가 높을수록 시장 몫이 크지만 비용이 늘고 성공 확률이 낮아집니다. 비용 ${costs}, 성공 확률 ${chances}. 실패하면 낸 돈은 사라집니다.`);
  }
  const a = cfg.appropriate;
  rows.push(`🔧 ${a.label}: 돈은 거의 안 되지만 피해를 줄여 줍니다. 비용 ${a.cost.slice(1).join(' / ')}.`);
  rows.push('개발에 성공한 나라는 그 기술의 세계 시장을 가져가고, 기술이 없는 나라는 매 라운드 돈이 빠져나갑니다. 먼저 성공할수록 몫이 큽니다.');
  rows.push(`혜택은 바로 오지만, 피해는 ${cfg.harmDelay}라운드 뒤에 도착하고 고를 때는 보이지 않습니다. 내 선택의 피해는 다른 나라에도 갑니다.`);
  rows.push(`피해는 복구할 수 있지만 비용은 개발 비용의 약 ${cfg.repairCostMult}배입니다.`);
  rows.push(`🔦 위험 조사: ${cfg.investigateCost}를 내면 선택지 하나의 ${cfg.harmDelay}라운드 뒤 결과를 흐릿하게 미리 볼 수 있습니다. 투표로 정하고, 반대가 많으면 못 합니다.`);
  rows.push('투표를 내려면 먼저 "이게 잘못되면 최악은?"을 한 줄 적어야 합니다.');
  rows.push('엔딩은 두 번입니다. 먼저 6개 나라를 합친 2075년 지구가 공개되고, 이어서 미래 세대 법정이 나라마다 판결합니다.');
  return rows;
}
