import React, { useEffect, useState } from 'react';
import { assetUrl, type AssetName } from '../game/assets.ts';

// 캐릭터·아이콘 이미지는 연두색(#1CFB08 근처) 배경에 그려져 있다.
// 화면에 올릴 때 그 배경만 투명하게 지워서 보여 준다 (원본 파일은 그대로).
const cache = new Map<string, Promise<string>>();

function keyOutGreen(src: string): Promise<string> {
  const hit = cache.get(src);
  if (hit) return hit;
  const job = new Promise<string>((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0);
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const px = data.data;
        for (let i = 0; i < px.length; i += 4) {
          const r = px[i];
          const g = px[i + 1];
          const b = px[i + 2];
          const d = g - Math.max(r, b);
          if (d > 120) {
            px[i + 3] = 0;
          } else if (d > 50) {
            // 가장자리: 반투명 + 초록 번짐 제거
            px[i + 3] = Math.round(255 * (1 - (d - 50) / 70));
            px[i + 1] = Math.max(r, b);
          }
        }
        ctx.putImageData(data, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(src);
      }
    };
    img.onerror = () => resolve(src);
    img.src = src;
  });
  cache.set(src, job);
  return job;
}

interface ChromaImgProps extends Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  name: AssetName;
}

export const ChromaImg: React.FC<ChromaImgProps> = ({ name, className = '', alt = '', ...rest }) => {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    keyOutGreen(assetUrl(name)).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [name]);
  return <img {...rest} alt={alt} src={url ?? undefined} className={`${className} ${url ? '' : 'opacity-0'}`} />;
};
