#!/usr/bin/env python3
"""Match all 152 shrine actors to fixed Chinese text and public video chapters."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/shrine-research'
TEXT_SNAPSHOT = '1c66ac1a02edf2d73d10b0dc6f0f2de29da7b119'
BVID = 'BV1Ru41147ca'
VIDEO_URL = f'https://www.bilibili.com/video/{BVID}/'
API_URL = f'https://api.bilibili.com/x/web-interface/view?bvid={BVID}'
TEXT_ORIGIN = f'https://raw.githubusercontent.com/sh0wer1ee/TotkText/{TEXT_SNAPSHOT}'


def clean(value):
    return re.sub(r'<[^>]*>', '', value).replace('\n', ' ').strip()


def acquire(item):
    name, url = item
    request = Request(url, headers={'User-Agent': 'totk-companion/0.1.2'})
    with urlopen(request, timeout=45) as response:
        data = response.read()
    # A failed platform response must not replace the last successful snapshot.
    if name == 'bili.json' and json.loads(data).get('code') != 0:
        raise ValueError('Video platform did not return a successful metadata response')
    (CACHE / name).write_bytes(data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true', help='Use the previously fetched primary-source snapshots')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    sources = [('bili.json', API_URL)] + [
        (f'dungeon-{i:04}.json', f'{TEXT_ORIGIN}/data/chunks/LocationMsg/Dungeon/{i:04}.json') for i in range(4)
    ]
    if not args.offline:
        with ThreadPoolExecutor(max_workers=5) as pool:
            list(pool.map(acquire, sources))
    checked_at = datetime.now(timezone.utc).isoformat()
    texts = {}
    for name, _ in sources[1:]:
        chunk = json.loads((CACHE / name).read_text())
        assert chunk['meta']['version'] == '121'
        for row in chunk['rows']:
            assert row['key'] not in texts
            texts[row['key']] = row
    response = json.loads((CACHE / 'bili.json').read_text())
    assert response['code'] == 0
    video = response['data']
    assert video['bvid'] == BVID and video['state'] == 0
    assert len(video['pages']) == 154
    # Full tokens are essential: 乔尼乌 is contained in 乔乔尼乌,
    # and 乔高乌 is contained in 希哈乔高乌; substring matching misassigns them.
    chapters = {}
    for page in video['pages'][2:]:
        token = re.search(r'(?:^|[- ])([^- ]+神庙)(?=[- ])', page['part'])
        assert token and token[1] not in chapters, page['part']
        assert page['duration'] > 0 and page['cid'] > 0
        chapters[token[1]] = page
    assert len(chapters) == 152
    pack = json.loads((ROOT / 'public/data/points.json').read_text())
    points = {pack['strings'][row[8]]: row for row in pack['rows'] if row[2] == 'shrine'}
    assert len(points) == 152
    guides = []
    for number in range(152):
        actor_id = f'Dungeon{number:03}'
        point = points[actor_id]
        name = clean(texts[f'{number:04}']['CNzh'])
        original_name = clean(texts[f'{number:04}']['USen'])
        assert original_name == pack['strings'][point[1]], actor_id
        puzzle = clean(texts[f'{2000 + number:04}']['CNzh'])
        chapter = chapters[name]
        guides.append({
            'actorId': actor_id, 'pointId': point[0], 'name': name, 'originalName': original_name,
            'puzzle': puzzle, 'layer': point[3],
            'video': {'platform': 'bilibili', 'bvid': BVID, 'page': chapter['page'], 'cid': chapter['cid'],
                      'title': chapter['part'], 'author': video['owner']['name'],
                      'durationSeconds': chapter['duration'], 'url': f"{VIDEO_URL}?p={chapter['page']}",
                      'status': 'title-matched', 'checkedAt': checked_at},
            'douyinVideo': None,
        })
    assert {guide['video']['page'] for guide in guides} == set(range(3, 155))
    assert {guide['layer'] for guide in guides} == {'sky', 'surface'}
    assert sum(guide['layer'] == 'sky' for guide in guides) == 32
    output = {'schemaVersion': 1, 'total': len(guides), 'videoTotal': len(guides), 'douyinVideoTotal': 0,
              'source': {
                  'checkedAt': checked_at, 'textSource': 'https://github.com/sh0wer1ee/TotkText',
                  'textSnapshot': TEXT_SNAPSHOT, 'textGameVersion': '1.2.1',
                  'videoSource': VIDEO_URL, 'videoMetadataUrl': API_URL, 'videoTitle': video['title'],
                  'author': video['owner']['name'], 'authorId': video['owner']['mid'],
                  'verification': 'All 152 complete CNzh shrine names matched exactly to public chapter title tokens; BVID, page, CID and duration checked. Footage was not watched or independently played through. Douyin entries are search links, not verified direct videos.',
                  'rights': 'Game text and symbols belong to their rights holders. Video copyright remains with its creator; only metadata and outbound links are stored, no video files or remote players.',
                  'files': [{'url': url, 'sha256': hashlib.sha256((CACHE / name).read_bytes()).hexdigest()}
                            for name, url in sources],
              }, 'guides': guides}
    (ROOT / 'public/data/shrine-guides.json').write_text(json.dumps(output, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f"Saved {len(guides)} shrine names and title-matched video chapters (120 surface, 32 sky); Douyin direct videos: 0")


if __name__ == '__main__':
    main()
