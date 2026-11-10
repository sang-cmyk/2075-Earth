export const ASSET_FILES = [
  'char_haru_normal', 'char_haru_worried', 'char_haru_serious', 'char_haru_hopeful',
  'icon_bio', 'icon_agri', 'icon_ai', 'icon_appro', 'icon_investigate', 'icon_vote_yes', 'icon_vote_no',
  'country_base_normal',
  'state_bio_good', 'state_bio_shaky', 'state_bio_bad',
  'state_agri_good', 'state_agri_shaky', 'state_agri_bad',
  'state_ai_good', 'state_ai_shaky', 'state_ai_bad',
  'ending_race', 'ending_field', 'ending_designed', 'ending_matched', 'ending_islands', 'ending_together',
  'court_bg',
  'icon_verdict_unseen', 'icon_verdict_ignored', 'icon_verdict_exported', 'icon_verdict_sold',
  'icon_verdict_unaware', 'icon_verdict_rider', 'icon_verdict_clear',
  'icon_verdict_war', 'icon_verdict_defenseless', 'icon_verdict_neglect',
  'icon_crisis_bio', 'icon_crisis_agri', 'icon_crisis_ai',
  'icon_support', 'icon_defense', 'icon_war',
  'icon_news', 'scene_news',
  'icon_event', 'scene_event_accident', 'scene_event_discovery',
  'icon_treaty', 'scene_treaty',
  'icon_faction_tradition', 'icon_faction_progress', 'icon_faction_fair',
  'scene_protest', 'scene_crisis_bio', 'scene_crisis_agri', 'scene_crisis_ai', 'scene_war',
  'char_haru_surprised', 'char_haru_proud', 'char_haru_nervous', 'char_haru_cheer',
  'scene_intro', 'bg_title',
  'scene_b1', 'scene_b2', 'scene_b3', 'scene_b4',
  'scene_a1', 'scene_a2', 'scene_a3', 'scene_a4',
  'scene_i1', 'scene_i2', 'scene_i3', 'scene_i4',
  'scene_c1', 'scene_c2',
] as const;

export type AssetName = (typeof ASSET_FILES)[number];

export const assetUrl = (name: AssetName): string => `/assets/${name}.webp`;
