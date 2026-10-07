#!/usr/bin/env node
// Export the original SVG mark to the existing native icon and local web bitmaps.
import { chromium } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const svgFile = 'public/icons/app.svg';
const androidFile = 'android/res/drawable/ic_emblem.xml';
const source = await readFile(path.join(root, svgFile), 'utf8');
if (!source.includes('viewBox="0 0 512 512"')) throw new Error('Unexpected icon coordinate system.');
const paths = [...source.matchAll(/<path\s+([^>]+)\/>/g)].map(match => Object.fromEntries(
  [...match[1].matchAll(/([\w-]+)="([^"]*)"/g)].map(attribute => [attribute[1], attribute[2]]),
));
if (!paths.length || paths.filter(item => item.id === 'icon-background').length !== 1) throw new Error('Icon source paths are incomplete.');
const escape = value => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const color = value => value === 'none' || !value ? '#00000000' : value;
const nativePaths = paths.filter(item => item.id !== 'icon-background').map(item => {
  const fields = { pathData: item.d, fillColor: color(item.fill), strokeColor: color(item.stroke),
    strokeWidth: item['stroke-width'] ?? '0', strokeLineCap: 'round', strokeLineJoin: 'round' };
  if (item['fill-opacity']) fields.fillAlpha = item['fill-opacity'];
  if (item['stroke-opacity']) fields.strokeAlpha = item['stroke-opacity'];
  return '    <path ' + Object.entries(fields).map(([name, value]) => `android:${name}="${escape(value)}"`).join(' ') + ' />';
});
await writeFile(path.join(root, androidFile), `<?xml version="1.0" encoding="utf-8"?>\n<!-- Generated from public/icons/app.svg by scripts/sync-app-icon.mjs. -->\n<vector xmlns:android="http://schemas.android.com/apk/res/android"\n    android:width="108dp" android:height="108dp" android:viewportWidth="512" android:viewportHeight="512">\n${nativePaths.join('\n')}\n</vector>\n`);

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  await page.setContent(`<html><head><style>html,body{margin:0}svg{display:block;width:100vw;height:100vh}</style></head><body>${source}</body></html>`);
  for (const size of [192, 512]) {
    await page.setViewportSize({ width: size, height: size });
    await page.screenshot({ path: path.join(root, `public/icons/app-${size}.png`), scale: 'css' });
  }
  const image = 'data:image/png;base64,' + (await readFile(path.join(root, 'public/icons/app-512.png'))).toString('base64');
  await page.setViewportSize({ width: 960, height: 620 });
  await page.setContent(`<html lang="zh-CN"><head><style>
    *{box-sizing:border-box}body{margin:0;padding:36px 44px;background:#f2eddd;color:#254d3e;font:16px system-ui,sans-serif}
    h1{margin:0;font:600 28px serif}p{color:#657c65;margin:12px 0 26px}.gallery{display:flex;justify-content:space-between;gap:30px}
    figure{margin:0;text-align:center}.gallery img{display:block;width:230px;height:230px}.circle{border-radius:50%}.squircle{border-radius:27%}
    figcaption{margin-top:14px}.small{display:flex;align-items:center;gap:32px;margin-top:42px;padding-top:28px;border-top:1px solid #c4c7ab}
    .small figure{display:flex;align-items:center;gap:12px}.small img{border-radius:25%}.small figcaption{margin:0;font-size:13px}
  </style></head><body><h1>海拉鲁探险手册 · 原创探索徽章</h1><p>矢量原图与桌面裁切预览</p>
    <div class="gallery"><figure><img src="${image}"/><figcaption>完整图标</figcaption></figure><figure><img class="circle" src="${image}"/><figcaption>圆形裁切</figcaption></figure><figure><img class="squircle" src="${image}"/><figcaption>方圆形裁切</figcaption></figure></div>
    <div class="small">${[48,72,96].map(size => `<figure><img src="${image}" width="${size}" height="${size}"/><figcaption>${size} px</figcaption></figure>`).join('')}</div>
  </body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await mkdir(path.join(root, 'docs/previews'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'docs/previews/app-icon-variants.png'), scale: 'css' });
} finally { await browser.close(); }

const sha = buffer => createHash('sha256').update(buffer).digest('hex');
const webAssets = [];
for (const file of ['icons/app.svg', 'icons/app-192.png', 'icons/app-512.png']) {
  const buffer = await readFile(path.join(root, 'public', file));
  webAssets.push({ file: '/' + file, bytes: buffer.length, sha256: sha(buffer) });
}
const native = await readFile(path.join(root, androidFile));
await writeFile(path.join(root, 'public/data/app-icon-manifest.json'), JSON.stringify({
  schemaVersion: 1, id: 'original-explorer-emblem-v1', checkedAt: new Date().toISOString(),
  source: 'Project-authored original SVG paths; Android VectorDrawable and PNGs exported from the same source.',
  generator: 'scripts/sync-app-icon.mjs', originalFile: svgFile,
  imageGenerationAttempt: { tool: 'built-in image_gen', usableNewFileReturned: false,
    prompt: "Original square exploration atlas icon: deep jade background, gold engraved ring, folded map, ivory explorer's sword and mint navigation spark; no characters, lettering or existing franchise symbols." },
  productionAssetType: 'original-vector', gameVersion: null,
  webAssets, androidForeground: { file: androidFile, sha256: sha(native) },
  backgroundColor: '#173e37', preview: 'docs/previews/app-icon-variants.png',
}, null, 2) + '\n');
console.log('Exported original SVG to Android foreground, 192/512 PNGs, icon manifest and mask previews.');
