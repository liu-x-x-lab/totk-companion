import type { ShrineGuide } from '../types/domain';

export interface ShrineGuidePack {
  schemaVersion: number;
  total: number;
  videoTotal: number;
  douyinVideoTotal: number;
  source: { checkedAt: string; textGameVersion: string; textSnapshot: string; videoSource: string };
  guides: ShrineGuide[];
}

export function decodeShrineGuides(pack: ShrineGuidePack): ShrineGuide[] {
  if (pack.schemaVersion !== 1 || pack.total !== 152 || pack.videoTotal !== 152 || pack.douyinVideoTotal !== 0
    || !Array.isArray(pack.guides) || pack.guides.length !== pack.total || pack.source?.textGameVersion !== '1.2.1'
    || !/^[a-f0-9]{40}$/.test(pack.source.textSnapshot)) throw new Error('神庙攻略目录不完整。');
  const actors = new Set<string>(), points = new Set<string>(), chapters = new Set<string>();
  for (const guide of pack.guides) {
    const video = guide.video;
    const token = video?.title?.match(/(?:^|[- ])([^- ]+神庙)(?=[- ])/u)?.[1];
    if (!/^Dungeon\d{3}$/.test(guide.actorId) || Number(guide.actorId.slice(7)) > 151
      || actors.has(guide.actorId) || !/^loc:0x[\da-f]+$/.test(guide.pointId) || points.has(guide.pointId)
      || !guide.name.endsWith('神庙') || !guide.originalName.endsWith(' Shrine') || !guide.puzzle
      || !['surface', 'sky'].includes(guide.layer) || guide.douyinVideo !== null
      || !video || video.platform !== 'bilibili' || !/^BV[\da-zA-Z]{10}$/.test(video.bvid)
      || !Number.isInteger(video.page) || video.page < 3 || video.page > 154
      || !Number.isSafeInteger(video.cid) || video.cid <= 0 || !Number.isInteger(video.durationSeconds) || video.durationSeconds <= 0
      || !video.author || video.status !== 'title-matched' || !Number.isFinite(Date.parse(video.checkedAt))
      || token !== guide.name || video.url !== `https://www.bilibili.com/video/${video.bvid}/?p=${video.page}`
      || pack.source.videoSource !== `https://www.bilibili.com/video/${video.bvid}/`
      || chapters.has(`${video.bvid}:${video.page}`)) throw new Error('神庙与视频分集对应关系无效。');
    actors.add(guide.actorId); points.add(guide.pointId); chapters.add(`${video.bvid}:${video.page}`);
  }
  if (pack.guides.filter(guide => guide.layer === 'sky').length !== 32) throw new Error('天空神庙攻略目录不完整。');
  return pack.guides;
}

export function shrineSearchUrls(name: string) {
  const query = encodeURIComponent(`王国之泪 ${name} 攻略`);
  return { douyin: `https://www.douyin.com/search/${query}?type=video`, bilibili: `https://search.bilibili.com/all?keyword=${query}` };
}

export function videoDuration(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
