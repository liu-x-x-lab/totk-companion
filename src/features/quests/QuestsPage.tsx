import { useState } from 'react';
import type { MapLabel, PointOfInterest, Quest, QuestCategory } from '../../types/domain';
import { LAYER_LABELS, QUEST_LABELS } from '../../types/domain';
import type { PlayerStore } from '../../hooks/usePlayerData';
import { Icon } from '../../components/Icon';
import { completedStages, questStatus, resolveQuestPlace } from './quests';

interface Props {
  quests: readonly Quest[]; points: readonly PointOfInterest[]; labels: readonly MapLabel[]; store: PlayerStore;
  selectedId: string | null; onSelect: (id: string | null) => void; onLocate: (point: PointOfInterest) => void;
}
function QuestDetail({ quest, quests, points, labels, store, onSelect, onLocate }: Props & { quest: Quest }) {
  const done = completedStages(quest, store.data), stages = quest.stages ?? [];
  const [expanded, setExpanded] = useState<string | null>(stages.find((stage) => !done.includes(stage.id))?.id ?? stages[0]?.id ?? null);
  const start = resolveQuestPlace(quest.start?.messageId, labels, points);
  return <div className="quest-detail" data-testid={`quest-${quest.id}`}>
    <button className="text-button quest-back" onClick={() => onSelect(null)}>‹ 返回任务列表</button>
    <div className="page-heading"><div><p className="eyebrow">{QUEST_LABELS[quest.category]} · {quest.chapter ?? '任务索引'}</p><h1>{quest.name}</h1></div><span className="heading-icon"><Icon name="journal" size={26}/></span></div>
    <p className="quest-english">{quest.originalName}</p>
    {quest.guideStatus === 'index' ? <div className="info-note"><Icon name="journal"/><p>已收录任务名称与分类，这条任务的离线教程尚未整理。可在联网时查看下方参考资料。</p></div> : <>
      <div className="quest-progress"><span>阶段进度</span><strong data-testid="quest-progress">{done.length} / {stages.length}</strong><progress aria-label="任务阶段进度" value={done.length} max={stages.length}/><small>手动勾选，随时取消 · 后续步骤展开查看</small></div>
      <section className="quest-info-card" aria-label="接取地点与前置条件"><div className="card-heading"><h2>从这里开始</h2>{start && <button className="text-button" onClick={() => onLocate(start)}><Icon name="target" size={16}/>地图定位</button>}</div>
        <p className="quest-start">{quest.start!.name}</p><p>{quest.start!.npc ? `寻找：${quest.start!.npc}` : '调查地点的任务提示'}</p>
        {start && <small>{LAYER_LABELS[start.layer]} · 定位为地点区域，请按步骤寻找人物或入口。</small>}
        <h3>前置条件</h3><ul>{quest.prerequisites!.map((text) => <li key={text}>{text}</li>)}</ul>
        {!!quest.preparations?.length && <><h3>出发前准备</h3><ul>{quest.preparations.map((text) => <li key={text}>{text}</li>)}</ul></>}
      </section>
      <div className="section-label"><span>按阶段推进</span><Icon name="journal" size={17}/></div>
      <div className="quest-stages">{stages.map((stage, index) => {
        const finished = done.includes(stage.id), place = resolveQuestPlace(stage.messageId, labels, points);
        return <details key={stage.id} className={`quest-stage ${finished ? 'finished' : ''}`} data-testid={`quest-stage-${stage.id}`} open={expanded === stage.id}>
          <summary onClick={(event) => { event.preventDefault(); setExpanded(expanded === stage.id ? null : stage.id); }}><span className="stage-number">{finished ? <Icon name="check" size={17}/> : String(index + 1).padStart(2, '0')}</span><span>{stage.title}<small>{finished ? '已完成' : '点击查看操作步骤'}</small></span><Icon name="chevron" size={16}/></summary>
          <ol>{stage.actions.map((action) => <li key={action}>{action}</li>)}</ol>
          {place && <button className="text-button stage-locate" onClick={() => onLocate(place)}><Icon name="target" size={16}/>查看{place.name}</button>}
          <label className="stage-complete"><input type="checkbox" aria-label={`完成阶段：${stage.title}`} checked={finished} onChange={() => {
            store.toggleQuestStage(quest.id, stage.id);
            if (!finished) setExpanded(stages.find((entry) => entry.id !== stage.id && !done.includes(entry.id))?.id ?? stage.id);
          }}/><span>{finished ? '这一阶段已完成' : '我已完成这一阶段'}</span></label>
        </details>;
      })}</div>
      {!!quest.nextQuestIds?.length && <section className="quest-next"><h2>接着查看</h2>{quest.nextQuestIds.map((id) => {
        const next = quests.find((entry) => entry.id === id);
        return next && <button key={id} className="outline-button" onClick={() => { onSelect(id); window.scrollTo({ top: 0, behavior: 'instant' }); }}>{next.name}<Icon name="arrow" size={16}/></button>;
      })}</section>}
    </>}
    <details className="quest-reference"><summary>资料来源与版本</summary><p>任务中文名称：游戏文本快照 1.2.1。教程为整理的操作步骤，未经游戏内逐阶段实测。</p><a href={quest.referenceUrl} target="_blank" rel="noreferrer">查看参考攻略（需联网）</a></details>
  </div>;
}

export function QuestsPage(props: Props) {
  const { quests, store, selectedId, onSelect } = props;
  const [category, setCategory] = useState<QuestCategory | 'all'>('all');
  const [query, setQuery] = useState(''), [tutorialOnly, setTutorialOnly] = useState(true), [progressFilter, setProgressFilter] = useState('all'), [limit, setLimit] = useState(30);
  const selected = quests.find((quest) => quest.id === selectedId), search = query.trim().toLocaleLowerCase();
  const filtered = quests.filter((quest) => (!tutorialOnly || quest.guideStatus === 'tutorial') && (category === 'all' || quest.category === category)
    && [quest.name, quest.originalName, quest.id, quest.start?.name, quest.start?.npc].some((text) => text?.toLocaleLowerCase().includes(search))
    && (progressFilter === 'all' || questStatus(quest, store.data) === progressFilter));
  return <div className="page quests-page">{selected ? <QuestDetail key={selected.id} {...props} quest={selected}/> : <>
    <div className="page-heading"><div><p className="eyebrow">FOLLOW THE ADVENTURE</p><h1>任务手册</h1></div><span className="heading-icon"><Icon name="journal" size={26}/></span></div>
    <p className="page-intro">在哪里接，去哪里，按阶段一步步完成。</p>
    <div className="quest-coverage"><strong>{quests.filter((quest) => quest.guideStatus === 'tutorial').length}<small>篇离线教程</small></strong><span>覆盖全部 {quests.filter((quest) => quest.category === 'main').length} 条主线<br/>收录 {quests.length} 个任务索引</span><Icon name="journal" size={30}/></div>
    <label className="search-field"><Icon name="search"/><input type="search" aria-label="搜索任务" placeholder="任务名称、接取地点、人物…" value={query} onChange={(event) => { setQuery(event.target.value); setLimit(30); }}/></label>
    <div className="filter-row" role="group" aria-label="任务分类"><button className={`filter-chip ${category === 'all' ? 'active' : ''}`} aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setLimit(30); }}>全部</button>{(Object.keys(QUEST_LABELS) as QuestCategory[]).map((type) => <button key={type} className={`filter-chip ${category === type ? 'active' : ''}`} aria-pressed={category === type} onClick={() => { setCategory(type); setLimit(30); }}>{QUEST_LABELS[type]}</button>)}</div>
    <div className="quest-list-toolbar"><button className={`filter-chip ${tutorialOnly ? 'active' : ''}`} aria-pressed={tutorialOnly} onClick={() => { setTutorialOnly(!tutorialOnly); setLimit(30); }}>只看有教程</button><select aria-label="筛选任务进度" value={progressFilter} onChange={(event) => { setProgressFilter(event.target.value); setLimit(30); }}><option value="all">全部进度</option><option value="new">尚未开始</option><option value="started">进行中</option><option value="done">已完成</option></select></div>
    <p className="quest-list-count" data-testid="quest-count">{filtered.length} 个{tutorialOnly ? '有教程的任务' : '任务'}</p>
    <div className="quest-list">{filtered.slice(0, limit).map((quest) => <button key={quest.id} className="quest-card" aria-label={`查看任务：${quest.name}`} onClick={() => { onSelect(quest.id); window.scrollTo({ top: 0, behavior: 'instant' }); }}>
      <span className="quest-card-mark"><Icon name={questStatus(quest, store.data) === 'done' ? 'check' : 'journal'} size={20}/></span>
      <span><small>{QUEST_LABELS[quest.category]} · {quest.chapter ?? (quest.guideStatus === 'tutorial' ? '实用任务' : '任务索引')}</small><strong>{quest.name}</strong><em>{quest.guideStatus === 'tutorial' ? `${quest.start?.name} · ${completedStages(quest, store.data).length} / ${quest.stages!.length} 阶段` : '离线教程待整理'}</em></span><Icon name="chevron" size={16}/>
    </button>)}</div>
    {filtered.length > limit && <button className="outline-button load-more" onClick={() => setLimit(limit + 30)}>显示更多任务</button>}
    {filtered.length === 0 && <div className="empty-state"><Icon name="search" size={30}/><h2>没有找到任务</h2><p>试试其他名称或关闭“只看有教程”。</p></div>}
  </>}</div>;
}
