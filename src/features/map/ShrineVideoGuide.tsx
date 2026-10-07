import { Icon } from '../../components/Icon';
import { shrineSearchUrls, videoDuration } from '../../data/shrine-guides';
import type { ShrineGuide } from '../../types/domain';

export function ShrineVideoGuide({ guide }: { guide: ShrineGuide }) {
  const searches = shrineSearchUrls(guide.name);
  return <section className="shrine-video-guide" aria-label="神庙解谜视频" data-testid="shrine-video-guide">
    <div className="shrine-guide-heading"><Icon name="shrine" size={24}/><div><h3>解谜视频</h3><p>{guide.puzzle}</p></div></div>
    <a className="shrine-video-link" href={guide.video.url} target="_blank" rel="noreferrer" aria-label={`观看${guide.name}攻略（B站第${guide.video.page}集）`}>
      <span className="video-play-icon"><Icon name="play" size={20}/></span><span><strong>观看本神庙攻略</strong><small>B站 · 第 {guide.video.page} 集 · {videoDuration(guide.video.durationSeconds)}</small></span><Icon name="chevron" size={16}/>
    </a>
    <div className="shrine-search-links"><a href={searches.douyin} target="_blank" rel="noreferrer"><Icon name="search" size={16}/>抖音搜索</a><a href={searches.bilibili} target="_blank" rel="noreferrer"><Icon name="search" size={16}/>B站搜索</a></div>
    <p className="shrine-video-note">视频需联网，在外部平台播放。抖音入口按神庙名称搜索。</p>
    <details className="shrine-video-source"><summary>视频来源与核对说明</summary><p>作者：{guide.video.author}</p><p>{guide.video.title}</p><p>已核对神庙名称与分集标题，未逐集观看。核对日期：{guide.video.checkedAt.slice(0,10)}。</p></details>
  </section>;
}
