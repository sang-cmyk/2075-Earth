import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve('public/assets');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const iconsPath = path.resolve('public/assets/aistudio/sheet_icons.png');
const scenesPath = path.resolve('public/assets/aistudio/sheet_scenes.png');
const haruPath = path.resolve('public/assets/aistudio/sheet_haru.png');

interface CropBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Remove pure chroma green background (#1CFB08) from raw RGBA buffer
 */
function removeGreenScreen(data: Buffer, width: number, height: number): Buffer {
  const result = Buffer.from(data);
  for (let i = 0; i < result.length; i += 4) {
    const r = result[i];
    const g = result[i + 1];
    const b = result[i + 2];
    const d = g - Math.max(r, b);

    if (d > 100) {
      result[i + 3] = 0; // Fully transparent
    } else if (d > 40) {
      // Soft edge feathering and green spill suppression
      const alphaFactor = 1 - (d - 40) / 60;
      result[i + 3] = Math.round(result[i + 3] * Math.max(0, alphaFactor));
      result[i + 1] = Math.max(r, b);
    }
  }
  return result;
}

async function cropAndSave(
  src: string,
  box: CropBox,
  names: string[],
  keyGreen: boolean = false
) {
  try {
    let pipeline = sharp(src).extract({
      left: Math.max(0, Math.round(box.left)),
      top: Math.max(0, Math.round(box.top)),
      width: Math.round(box.width),
      height: Math.round(box.height),
    });

    if (keyGreen) {
      const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const keyed = removeGreenScreen(data, info.width, info.height);
      pipeline = sharp(keyed, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4,
        },
      });
    }

    const webpBuffer = await pipeline.webp({ quality: 95 }).toBuffer();

    for (const name of names) {
      const dest = path.join(outDir, `${name}.webp`);
      fs.writeFileSync(dest, webpBuffer);
      console.log(`Saved: public/assets/${name}.webp`);
    }
  } catch (err) {
    console.error(`Failed to crop [${names.join(', ')}]:`, err);
  }
}

async function run() {
  console.log('--- Slicing Scene Sheet (3 cols x 3 rows) ---');
  // Divider bounds measured precisely from sheet_scenes.png
  const sceneCols = [
    { left: 12, width: 902 },
    { left: 925, width: 902 },
    { left: 1838, width: 902 },
  ];
  const sceneRows = [
    { top: 4, height: 502 },
    { top: 517, height: 502 },
    { top: 1030, height: 501 },
  ];

  const sceneMap: Record<string, [number, number]> = {
    scene_news: [0, 0],
    scene_protest: [0, 1],
    scene_war: [0, 2],
    scene_treaty: [1, 0],
    scene_crisis_bio: [1, 1],
    scene_crisis_agri: [1, 2],
    scene_crisis_ai: [2, 0],
    scene_event_accident: [2, 1],
    scene_event_discovery: [2, 2],
  };

  for (const [name, [row, col]] of Object.entries(sceneMap)) {
    const box: CropBox = {
      left: sceneCols[col].left,
      top: sceneRows[row].top,
      width: sceneCols[col].width,
      height: sceneRows[row].height,
    };
    await cropAndSave(scenesPath, box, [name], false);
  }

  console.log('\n--- Slicing Icon Sheet (5 cols x 3 rows) ---');
  // Divider bounds measured precisely from sheet_icons.png
  const iconCols = [
    { left: 44, width: 482 },
    { left: 589, width: 482 },
    { left: 1134, width: 483 },
    { left: 1680, width: 482 },
    { left: 2225, width: 482 },
  ];
  const iconRows = [
    { top: 39, height: 445 },
    { top: 547, height: 445 },
    { top: 1056, height: 445 },
  ];

  const iconMap: Record<string, [number, number]> = {
    icon_crisis_bio: [0, 0],
    icon_crisis_agri: [0, 1],
    icon_crisis_ai: [0, 2],
    icon_support: [0, 3],
    icon_defense: [0, 4],
    icon_war: [1, 0],
    icon_news: [1, 1],
    icon_event: [1, 2],
    icon_treaty: [1, 3],
    icon_faction_tradition: [1, 4],
    icon_faction_progress: [2, 0],
    icon_faction_fair: [2, 1],
    icon_verdict_neglect: [2, 2],
    icon_verdict_defenseless: [2, 3],
    icon_verdict_war: [2, 4],
  };

  for (const [name, [row, col]] of Object.entries(iconMap)) {
    const box: CropBox = {
      left: iconCols[col].left,
      top: iconRows[row].top,
      width: iconCols[col].width,
      height: iconRows[row].height,
    };
    await cropAndSave(iconsPath, box, [name], true);
  }

  console.log('\n--- Slicing Haru Expression Sheet (4 cols x 1 row) ---');
  // Bounds measured precisely around Haru character silhouettes
  const haruPoses: { box: CropBox; names: string[] }[] = [
    {
      box: { left: 80, top: 140, width: 580, height: 1020 },
      names: ['char_haru_surprised', 'char_haru_serious', 'char_haru_normal'],
    },
    {
      box: { left: 740, top: 140, width: 620, height: 1020 },
      names: ['char_haru_proud', 'char_haru_hopeful'],
    },
    {
      box: { left: 1430, top: 140, width: 560, height: 1020 },
      names: ['char_haru_nervous', 'char_haru_worried'],
    },
    {
      box: { left: 2050, top: 110, width: 680, height: 1380 },
      names: ['char_haru_cheer'],
    },
  ];

  for (const pose of haruPoses) {
    await cropAndSave(haruPath, pose.box, pose.names, true);
  }

  console.log('\nAll asset sheets sliced and saved to public/assets/ successfully!');
}

run().catch((err) => {
  console.error('Fatal error during slicing:', err);
  process.exit(1);
});
