#!/usr/bin/env python3
"""Match 900 Korok puzzles and 100 carry-task pairs through exact source hashes and Links."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/korok-research'
RADAR = 'https://radar-totk.zeldamods.org'
QUERY_URL = f'{RADAR}/objs/MainAndMinusField/?q={quote("Korok")}&limit=-1'

# Project-written action summaries; classifications come from the source, not guessed coordinates.
TYPES = {
    'Rock Lift': ('举起石头', '检查可疑石头，清理挡住它的冰或杂草后举起。'),
    'Stationary Lights': ('调查闪光', '靠近固定闪光点，按提示调查。'),
    'Puzzle Blocks': ('方块拼图', '用究极手移动和旋转金属方块，补全旁边的图案。'),
    'Rock Pattern': ('石头图案', '对照石头排列，把缺少的石头放到对应空位。'),
    'Flower Trail': ('追踪花朵', '触碰花朵并寻找下一朵，沿着移动的花朵走到终点。'),
    'Pinwheel Balloons': ('风车气球', '站到风车旁，找出出现的气球并用弓箭击破。'),
    'Moving Lights': ('追逐光点', '追上移动的闪光点，在靠近时调查。'),
    'Hanging Acorn': ('悬挂橡果', '寻找悬挂的橡果，用弓箭击中。'),
    'Goal Ring (Race)': ('限时圆环', '触发树桩后，在时限内到达出现的圆环。'),
    'Through the Roof': ('通天术树桩', '从带有标记的树桩下方使用通天术。'),
    'Catch the Seed': ('接住种子', '触发树桩后观察飘落的种子，在它落地前接住。'),
    'Land on Target': ('空中落点', '从起始树桩出发，直接落到出现的目标位置。'),
    'Boulder Stand': ('巨石底座', '用究极手把巨石放入对应底座。'),
    'Pull the Plug': ('拔出木塞', '利用连接物、重力或浮力拉出堵住洞口的木塞。'),
    'Dive': ('跳水圆环', '跳入水面上的叶子圆环中心。'),
    'Stationary Balloon': ('定点气球', '寻找藏在附近的气球，用弓箭击破。'),
    'Offering Plate': ('供品托盘', '对照已有的供品，把同类物品放到空托盘里。'),
    'Acorn in a Hole': ('洞中橡果', '寻找洞口里的橡果，调整角度后用弓箭击中。'),
    'Catch the Light': ('捕捉光点', '跟随光点移动，在可调查时及时互动。'),
    'Repair Roof': ('修补屋顶', '寻找可用木板，用究极手补齐破损的屋顶。'),
    'Provide Shelter': ('遮雨小屋', '把附近材料搭成遮挡，让目标得到庇护。'),
    'Touch the Target': ('触碰标靶', '到达标靶所在位置并触碰目标。'),
    'Ring the Bell': ('敲响钟', '找到钟并敲响，注意周围可以借助的平台。'),
    'Korok Friends': ('搬运克洛格', '在起点与背包克洛格交谈，用究极手或载具送到朋友身边。'),
}


def fetch(url, path):
    request = Request(url, headers={'User-Agent': 'TotkCompanion/0.1.2 (public map research)'})
    with urlopen(request, timeout=45) as response:
        raw = response.read()
    value = json.loads(raw)
    path.write_bytes(raw)
    return value


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    query_path = CACHE / 'name-korok.json'
    records = json.loads(query_path.read_text()) if args.offline else fetch(QUERY_URL, query_path)
    tasks = [item for item in records if item.get('korok_type')]
    assert len(tasks) == 900
    assert {item['korok_type'] for item in tasks} == set(TYPES)
    keepers = {item['hash_id']: item for item in tasks if item['name'] == 'KorokCarryProgressKeeper'}
    destinations = {item['hash_id']: item for item in records if item['name'] == 'KorokCarry_Destination'}
    passengers = [item for item in records if item['name'] == 'KorokCarryPassenger_Pair']
    assert len(keepers) == len(destinations) == len(passengers) == 100
    files = [{'url': QUERY_URL, 'sha256': hashlib.sha256(query_path.read_bytes()).hexdigest()}]

    def acquire(item):
        path = CACHE / f"obj-{item['objid']}.json"
        url = f"{RADAR}/obj/{item['objid']}/"
        if args.offline or path.exists():
            detail = json.loads(path.read_text())
        else:
            detail = fetch(url, path)
        assert detail['hash_id'] == item['hash_id'] and detail['name'] == 'KorokCarryPassenger_Pair'
        links = {link['Dst'] for link in detail['data']['Links'] if link.get('Name') == 'Reference' and link['Src'] == item['hash_id']}
        keeper_ids = links & keepers.keys()
        destination_ids = links & destinations.keys()
        assert len(keeper_ids) == len(destination_ids) == 1, item['hash_id']
        keeper_id, destination_id = next(iter(keeper_ids)), next(iter(destination_ids))
        return keeper_id, {'start': {'sourceId': 'obj:' + item['hash_id'], 'sourceObjectId': item['objid'],
                                    'rawCoordinates': detail['data']['Translate']},
                           'destination': {'sourceId': 'obj:' + destination_id, 'sourceObjectId': destinations[destination_id]['objid'],
                                           'rawCoordinates': destinations[destination_id]['pos']},
                           'association': 'explicit-source-links'}, {'url': url, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}

    with ThreadPoolExecutor(max_workers=4) as pool:
        pairs = list(pool.map(acquire, passengers))
    carry_by_hash = {key: pair for key, pair, _ in pairs}
    assert len(carry_by_hash) == 100
    files.extend(record for _, _, record in pairs)
    points = json.loads((ROOT / 'public/data/points.json').read_text())
    by_id = {row[0]: row for row in points['rows'] if row[2] == 'korok'}
    assert len(by_id) == 900
    guides = []
    for task in sorted(tasks, key=lambda item: item['korok_id']):
        point_id = 'loc:' + task['hash_id']
        point = by_id[point_id]
        assert points['strings'][point[8]] == task['korok_id']
        kind, hint = TYPES[task['korok_type']]
        pair = carry_by_hash.get(task['hash_id'])
        if pair:
            # The upstream map marker denotes the friend/goal, not the passenger's start.
            assert all(abs(a-b) <= .011 for a,b in zip(point[4:7], pair['destination']['rawCoordinates']))
            pair['destination']['rawCoordinates'] = point[4:7]
        else:
            assert all(abs(a-b) <= .011 for a,b in zip(point[4:7], task['pos']))
        guides.append({'pointId': point_id, 'code': task['korok_id'], 'name': f"呀哈哈 · {task['korok_id']} · {kind}",
                       'layer': point[3], 'type': task['korok_type'], 'typeName': kind,
                       'hint': hint, 'rewardSeeds': 2 if pair else 1, 'pair': pair})
    output = {'schemaVersion': 1, 'total': 900, 'carryTotal': 100, 'seedTotal': 1000, 'typeTotal': len(TYPES),
              'source': {'name': 'TotK Object Map / ZeldaMods Korok classifications and explicit actor links',
                         'url': 'https://objmap-totk.zeldamods.org/', 'gameVersion': None, 'status': 'unverified',
                         'checkedAt': datetime.now(timezone.utc).isoformat(),
                         'verification': '900 typed source hashes matched exact static task IDs. All 100 carry starts and destinations linked via passenger actor Reference links, not proximity. Static carry marker is the destination. Source coordinates retained. Rewards follow the one-seed/single-puzzle and two-seed/friends-puzzle rule; hints are project-written summaries, not individual in-game verification.',
                         'rewardRuleReference': 'https://www.nintendolife.com/guides/zelda-tears-of-the-kingdom-all-korok-seed-locations',
                         'rights': 'Community source attribution retained; game content belongs to its rights holders.', 'files': files},
              'guides': guides}
    (ROOT / 'public/data/korok-guides.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    print('Saved 900 Korok task guides, 24 puzzle types, 100 source-linked carry pairs, 1000 reward seeds')


if __name__ == '__main__':
    main()
