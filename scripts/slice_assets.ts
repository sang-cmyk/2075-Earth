import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const img1Path = 'public/assets/aistudio/Gemini_Generated_Image_6xstf86xstf86xst_92489b89.png';
const img2Path = 'public/assets/aistudio/Gemini_Generated_Image_84hm3184hm3184hm_cfcb17b0.png';
const img3Path = 'public/assets/aistudio/Gemini_Generated_Image_ofj0plofj0plofj0_60b23604.png';

async function crop(src: string, box: { left: number; top: number; width: number; height: number }, name: string) {
  const dest = path.join(outDir, `${name}.webp`);
  try {
    await sharp(src)
      .extract({
        left: Math.max(0, box.left),
        top: Math.max(0, box.top),
        width: box.width,
        height: box.height,
      })
      .webp({ quality: 90 })
      .toFile(dest);
    console.log(`Saved ${name}.webp`);
  } catch (err) {
    console.error(`Failed ${name}:`, err);
  }
}

async function main() {
  console.log('Slicing Image 3 (Domain states)...');
  await crop(img3Path, { left: 224, top: 48, width: 728, height: 448 }, 'state_bio_good');
  await crop(img3Path, { left: 1016, top: 48, width: 728, height: 448 }, 'state_bio_shaky');
  await crop(img3Path, { left: 1808, top: 48, width: 728, height: 448 }, 'state_bio_bad');

  await crop(img3Path, { left: 224, top: 536, width: 728, height: 464 }, 'state_agri_good');
  await crop(img3Path, { left: 1016, top: 536, width: 728, height: 464 }, 'state_agri_shaky');
  await crop(img3Path, { left: 1808, top: 536, width: 728, height: 464 }, 'state_agri_bad');

  await crop(img3Path, { left: 224, top: 1048, width: 728, height: 440 }, 'state_ai_good');
  await crop(img3Path, { left: 1016, top: 1048, width: 728, height: 440 }, 'state_ai_shaky');
  await crop(img3Path, { left: 1808, top: 1048, width: 728, height: 440 }, 'state_ai_bad');

  console.log('Slicing Image 2 (Haru & Icons)...');
  await crop(img2Path, { left: 320, top: 104, width: 544, height: 648 }, 'char_haru_normal');
  await crop(img2Path, { left: 1208, top: 112, width: 344, height: 400 }, 'char_haru_worried');
  await crop(img2Path, { left: 1752, top: 112, width: 344, height: 400 }, 'char_haru_serious');
  await crop(img2Path, { left: 2296, top: 112, width: 344, height: 400 }, 'char_haru_hopeful');

  await crop(img2Path, { left: 1184, top: 576, width: 392, height: 400 }, 'icon_bio');
  await crop(img2Path, { left: 1700, top: 560, width: 440, height: 420 }, 'icon_agri');
  await crop(img2Path, { left: 2280, top: 560, width: 400, height: 420 }, 'icon_ai');

  await crop(img2Path, { left: 1216, top: 1072, width: 344, height: 408 }, 'icon_appro');
  await crop(img2Path, { left: 2288, top: 1080, width: 384, height: 384 }, 'icon_investigate');
  await crop(img2Path, { left: 312, top: 832, width: 520, height: 704 }, 'country_base_normal');

  console.log('Slicing Image 1 (Court, Ending & Verdicts)...');
  await crop(img1Path, { left: 104, top: 96, width: 984, height: 656 }, 'court_bg');
  await crop(img1Path, { left: 1144, top: 96, width: 472, height: 408 }, 'icon_verdict_unseen');
  await crop(img1Path, { left: 1664, top: 96, width: 472, height: 408 }, 'icon_verdict_ignored');
  await crop(img1Path, { left: 2184, top: 96, width: 472, height: 408 }, 'icon_verdict_unaware');

  await crop(img1Path, { left: 1144, top: 552, width: 480, height: 440 }, 'icon_verdict_sold');
  await crop(img1Path, { left: 616, top: 792, width: 488, height: 664 }, 'icon_verdict_rider');
  await crop(img1Path, { left: 1144, top: 1032, width: 480, height: 432 }, 'icon_verdict_clear');
  await crop(img1Path, { left: 104, top: 792, width: 472, height: 408 }, 'icon_verdict_exported');

  // The sunset rooftop view overlooking islands
  await crop(img1Path, { left: 1672, top: 792, width: 976, height: 664 }, 'ending_islands');
  await crop(img1Path, { left: 1672, top: 792, width: 976, height: 664 }, 'scene_intro');
  await crop(img1Path, { left: 1672, top: 792, width: 976, height: 664 }, 'bg_title');

  // Copy or generate remaining endings and icons:
  const mappings: Record<string, string> = {
    'icon_vote_yes': 'icon_investigate',
    'icon_vote_no': 'icon_verdict_ignored',
    'ending_field': 'state_agri_bad',
    'ending_designed': 'state_bio_shaky',
    'ending_matched': 'state_ai_bad',
    'ending_race': 'state_bio_bad',
    'ending_together': 'state_ai_good',
    // Event scenes
    'scene_b1': 'state_bio_shaky',
    'scene_b2': 'state_bio_bad',
    'scene_b3': 'state_bio_bad',
    'scene_b4': 'state_bio_shaky',
    'scene_a1': 'state_agri_good',
    'scene_a2': 'state_agri_shaky',
    'scene_a3': 'state_agri_shaky',
    'scene_a4': 'state_agri_bad',
    'scene_i1': 'state_ai_shaky',
    'scene_i2': 'state_ai_shaky',
    'scene_i3': 'state_ai_bad',
    'scene_i4': 'state_ai_bad',
    'scene_c1': 'state_bio_shaky',
    'scene_c2': 'state_agri_shaky',
  };

  for (const [target, source] of Object.entries(mappings)) {
    const srcFile = path.join(outDir, `${source}.webp`);
    const dstFile = path.join(outDir, `${target}.webp`);
    if (fs.existsSync(srcFile) && !fs.existsSync(dstFile)) {
      fs.copyFileSync(srcFile, dstFile);
      console.log(`Copied ${source}.webp -> ${target}.webp`);
    }
  }

  console.log('All assets processed successfully.');
}

main().catch(console.error);
