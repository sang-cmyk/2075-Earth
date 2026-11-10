import type { Config } from './config.ts';

export function rulesText(cfg: Config): string[] {
  const rows: string[] = [];
  rows.push(`우리 모둠은 하나의 나라입니다. ${cfg.rounds}라운드 동안 모둠원 모두가 투표하고, 표가 가장 많은 쪽으로 결정됩니다.`);
  rows.push(`처음에 받는 돈은 ${cfg.startMoney}이고, 이후에는 더 받지 못합니다. 돈이 늘어나는 길은 기술을 가진 나라가 되어 시장 수익과 로열티를 받는 것뿐입니다. 이미 가진 기술에는 매 라운드 유지비(보유 단계 합계 × ${cfg.upkeepPerLevel})가 듭니다.`);
  rows.push('같은 표가 나오면 공동 1위 중 하나가 무작위로 정해집니다. (재투표는 없습니다)');
  for (const d of cfg.domains) {
    const costs = d.cost.slice(1).join(' / ');
    const chances = d.success.slice(1).map((p) => `${Math.round(p * 100)}%`).join(' / ');
    rows.push(`${d.icon} ${d.label}: 단계가 높을수록 시장 몫이 크지만 비용이 늘고 성공 확률이 낮아집니다. 비용 ${costs}, 성공 확률 ${chances}. 실패해도 비용의 ${Math.round(cfg.failRefund * 100)}%는 돌려받습니다.`);
  }
  const a = cfg.appropriate;
  rows.push(`🔧 ${a.label}: 돈은 거의 안 되지만 피해를 줄여 줍니다. 비용 ${a.cost.slice(1).join(' / ')}.`);
  rows.push(`🌳 기술 트리: 지금 가진 단계보다 한 번에 최대 ${cfg.techStepLimit}단계까지만 올릴 수 있습니다. 1라운드에는 0단계에서 최대 ${cfg.techStepLimit}단계까지입니다.`);
  rows.push(`💸 로열티: 나보다 앞선 단계의 기술을 가진 나라에는 매 라운드 사용료를 냅니다. 단계 차이가 클수록 많이 내고, 기술을 따라잡으면 줄어듭니다. 앞선 나라는 로열티를 받지만 한 라운드에 받을 수 있는 양에는 상한(${cfg.royaltyReceiveCap})이 있습니다.`);
  rows.push(`🏚️ 재정 파탄: 로열티와 유지비를 다 못 내면 빚이 되고 이자(${Math.round(cfg.debtInterest * 100)}%)가 붙습니다. 빚이 ${cfg.bankruptcyDebt} 이상이 되면 모든 스탯 -${cfg.bankruptcyStatLoss}, 국민 지지도 -${cfg.bankruptcySupportLoss}가 되고 다음 라운드에는 새로 투자할 수 없습니다.`);
  rows.push(`🏛️ 국민 지지도: ${cfg.support.highThreshold}% 이상이면 자금 보너스, ${cfg.support.protestThreshold}% 미만이면 시위로 자금과 사회 점수가 줄고, ${cfg.support.demandThreshold}% 미만이면 가장 위험한 영역에 투자가 강제됩니다.`);
  rows.push('⚡ 매 라운드 돌발 위기가 한 번씩 일어납니다. 모둠이 대응책을 골라야 합니다.');
  rows.push(`혜택은 바로 오지만, 피해는 ${cfg.harmDelay}라운드 뒤에 도착하고 고를 때는 보이지 않습니다. 내 선택의 피해는 다른 나라에도 갑니다.`);
  rows.push(`피해는 복구할 수 있지만 비용은 개발 비용의 약 ${cfg.repairCostMult}배입니다.`);
  rows.push(`🔦 위험 조사: ${cfg.investigateCost}를 내면 선택지 하나의 ${cfg.harmDelay}라운드 뒤 결과를 흐릿하게 미리 볼 수 있습니다. 투표로 정하고, 반대가 많으면 못 합니다.`);
  rows.push('투표를 내려면 먼저 "이게 잘못되면 최악은?"을 한 줄 적어야 합니다.');
  rows.push('엔딩은 두 번입니다. 먼저 6개 나라를 합친 2075년 지구가 공개되고, 이어서 미래 세대 법정이 나라마다 판결합니다.');
  return rows;
}
