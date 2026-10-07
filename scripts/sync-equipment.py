#!/usr/bin/env python3
"""Import public equipment data tables without running upstream JavaScript."""
import argparse
import csv
import hashlib
import json
import re
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as XML
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parent.parent
SOURCES = {
    'phil': ('totk-equipment-phil.xlsx', 'https://docs.google.com/spreadsheets/d/1fBvQ17WHP3ASgtO8ode_rf1g4DfEHErMrHwwLppNTJM/export?format=xlsx'),
    'echo': ('totk-equipment-echo.xlsx', 'https://docs.google.com/spreadsheets/d/18pNtDx3z-8CwGJRmlW574xbQ6VphQOkvpZhClpOEVDA/export?format=xlsx'),
    'zh': ('totk-equipment-zh.js', 'https://raw.githubusercontent.com/marcrobledo/savegame-editors/master/zelda-totk/locale/zelda-totk.locale.zh.js'),
    'reference': ('totk-equipment-weapons-142.json', 'https://raw.githubusercontent.com/savage13/totk-dc/main/src/weapon_data.json'),
}


def workbook(path):
    """Read named sheets and headers; use cached formula values from XLSX."""
    with ZipFile(path) as archive:
        strings = [''.join(t.text or '' for t in entry.findall('.//{*}t'))
                   for entry in XML.fromstring(archive.read('xl/sharedStrings.xml'))]
        relations = {r.attrib['Id']: r.attrib['Target'] for r in
                     XML.fromstring(archive.read('xl/_rels/workbook.xml.rels'))}
        result = {}
        for sheet in XML.fromstring(archive.read('xl/workbook.xml')).findall('{*}sheets/{*}sheet'):
            if sheet.attrib['name'] not in {'Weapons', 'Bows', 'Shields', 'Armor', 'Armors', 'Materials'}:
                continue
            target = relations[sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']]
            target = target.lstrip('/') if target.startswith('/') else 'xl/' + target
            rows = []
            for row in XML.fromstring(archive.read(target)).findall('{*}sheetData/{*}row'):
                values = {}
                for cell in row:
                    value = cell.find('{*}v')
                    if value is None or value.text is None:
                        continue
                    text = strings[int(value.text)] if cell.attrib.get('t') == 's' else value.text
                    values[re.sub(r'\d', '', cell.attrib['r'])] = text
                rows.append(values)
            headers = rows[0]
            result[sheet.attrib['name']] = [{headers[col].strip(): value for col, value in row.items() if col in headers}
                                           for row in rows[1:] if row]
        return result


def number(value):
    if value is None or value == '-':
        return None
    try:
        parsed = float(value)
        assert parsed >= 0 and parsed < float('inf')
        return int(parsed) if parsed.is_integer() else parsed
    except ValueError:
        return None


def band(value):
    match = re.fullmatch(r'(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)', value or '')
    return [number(match[1]), number(match[2])] if match else None


def normalized(name):
    return ' '.join(name.replace('’', "'").replace('✨', '').split()).casefold()


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source-dir', type=Path, default=ROOT / '.cache/equipment')
    parser.add_argument('--offline', action='store_true', help='Rebuild from existing snapshots')
    args = parser.parse_args()
    args.source_dir.mkdir(parents=True, exist_ok=True)
    hashes = []
    for name, (filename, url) in SOURCES.items():
        path = args.source_dir / filename
        if not args.offline:
            request = urllib.request.Request(url, headers={'User-Agent': 'TotK-Companion-Data/0.1'})
            with urllib.request.urlopen(request, timeout=60) as response:
                path.write_bytes(response.read())
        if not path.exists():
            raise FileNotFoundError(f'Missing source snapshot: {path}')
        hashes.append({'name': name, 'url': url, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})

    primary = workbook(args.source_dir / SOURCES['phil'][0])
    secondary = workbook(args.source_dir / SOURCES['echo'][0])
    reference = {r['actorID']: r for r in json.loads((args.source_dir / SOURCES['reference'][0]).read_text())}
    translations = {}
    # Keep the first (simplified Chinese) entry, ignoring the later zh-TW block.
    for match in re.finditer(r"^([A-Za-z][A-Za-z0-9_]*):'((?:[^'\\]|\\.)*)'",
                             (args.source_dir / SOURCES['zh'][0]).read_text(), re.M):
        translations.setdefault(match[1], match[2].replace("\\'", "'").replace('\\\\', '\\'))
    materials = {normalized(row['Name']): (row['ActorName'], translations.get(row['ActorName'], row['Name']))
                 for row in primary['Materials'] if 'ActorName' in row and 'Name' in row}
    assert [len(primary[k]) for k in ('Weapons', 'Bows', 'Shields', 'Armor')] == [112, 30, 33, 135]
    pristine = {normalized(row['Name']) for row in primary['Weapons'] if '✨' in row['Name']}
    items, aliases, comparisons, differences = [], [], 0, []
    specs = [
        ('Weapons', 'Weapons', ['Base Attack Power', 'Base Attack Power (UI)', 'Durability'], ['BaseAttack', 'Shown Attack', 'MaxLife']),
        ('Bows', 'Bows', ['Attack Power', 'Durability'], ['BaseAttack', 'MaxLife']),
        ('Shields', 'Shields', ['Base Shield Guard Strength', 'Durability'], ['GuardPower', 'MaxLife']),
        ('Armor', 'Armors', ['Defense (Base)', 'Defense ★', 'Defense ★★', 'Defense ★★★', 'Defense ★★★★'], ['Base Defense', 'Defense ★', 'Defense ★★', 'Defense ★★★', 'Defense ★★★★']),
    ]
    for tab, second_tab, pfields, efields in specs:
        other = {row['ActorName']: row for row in secondary[second_tab] if 'ActorName' in row}
        for row in primary[tab]:
            actor = row.get('ActorName', row.get('ActorName (Base)'))
            assert actor in other and actor in translations, actor
            echo = other[actor]
            for pf, ef in zip(pfields, efields):
                p, e = number(row.get(pf)), number(echo.get(ef))
                if p is None or e is None:
                    continue
                comparisons += 1
                if p != e:
                    assert actor == 'Weapon_Sword_070_Broken' and pf == 'Durability' and p == 4 and e == 6
                    assert reference[actor]['durability'] == p
                    differences.append({'actor': actor, 'field': 'baseDurability', 'phil': p, 'echo': e,
                                        'chosen': p, 'reason': 'Phil table and parameter reference agree; older Echo table differs.'})
            category = {'1H': 'one-handed', '2H': 'two-handed', 'Spear': 'spear'}.get(row.get('Type'))
            category = category or {'Bows': 'bow', 'Shields': 'shield', 'Armor': 'armor'}[tab]
            english = row['Name'].replace('✨', '').strip()
            variant = 'pristine' if '✨' in row['Name'] else 'decayed' if tab == 'Weapons' and normalized(english) in pristine else 'standard'
            item = {'id': actor, 'name': translations[actor], 'originalName': english, 'category': category,
                    'variant': variant, 'attack': None, 'rawAttack': None, 'attackRange': None,
                    'defense': None, 'baseDurability': number(row.get('Durability')), 'description': '',
                    'effects': [], 'modifiers': {}, 'catalogEntry': True}
            effect_fields = {'Weapons': ('Property 1', 'Property 2'), 'Bows': ('Property 1', 'Property 2'),
                             'Shields': ('Property',), 'Armor': ('Effect', 'Set Bonus')}[tab]
            item['effects'] = [row[k] for k in effect_fields if row.get(k) not in (None, '-')]
            if tab == 'Weapons':
                item['rawAttack'] = number(row.get('Base Attack Power'))
                item['attack'] = number(row.get('Base Attack Power (UI)')) or item['rawAttack']
                item['fuseExtraDurability'] = number(row.get('Fuse Extra Durability'))
                item['fuseDurabilityNote'] = ('大师之剑的融合耐久有状态与版本例外，此处不自动计算。' if actor == 'Weapon_Sword_070'
                                              else '武器参数中的融合额外耐久上限；实际消耗还与附加物和使用方式有关。')
                for dest, key in [('attackUp', 'Base Attack Up Lv1 Range'), ('attackUpPlus', 'Base Attack Up Lv2 Range')]:
                    item['modifiers'][dest] = band(row.get(key + ' (UI)', row.get(key)))
            elif tab == 'Bows':
                item['attack'] = number(row.get('Attack Power'))
                item['rawAttack'] = item['attack']
                item['attackRange'] = band(row.get('Attack Power'))
                item['arrowsPerShot'] = number(row.get('Arrows Per Shot (Default)'))
                item['bowRange'] = number(row.get('Range'))
                item['modifiers'].update(attackUp=band(row.get('Attack Up Lv1 Range')), attackUpPlus=band(row.get('Attack Up Lv 2 Range')))
                if actor == 'Weapon_Bow_166':
                    item['attackNote'] = '每颗红心上限对应 2 点攻击，攻击上限 60；此处显示 2–60 的范围。'
                    assert item['attackRange'] == [2, 60]
            elif tab == 'Shields':
                item['defense'] = number(row.get('Base Shield Guard Strength'))
                item['modifiers'].update(guardUp=band(row.get('Shield Guard Up Lv1 Range')), guardUpPlus=band(row.get('Shield Guard Up Lv2 Range')))
            else:
                item['defense'] = number(row['Defense (Base)'])
                item['baseDurability'] = None
                item['armorSlot'] = {'Head': 'head', 'Body': 'upper', 'Legs': 'lower', 'All': 'full'}[row['Equip Slot']]
                item['armorLevels'] = [{'level': 0, 'defense': item['defense'], 'rupees': 0, 'materials': []}]
                for level in range(1, 5):
                    stars = '★' * level
                    defense = number(row.get('Defense ' + stars))
                    if defense is None:
                        continue
                    required = []
                    for slot in range(1, 4):
                        name = row.get(f'Upgrade Material {stars} ({slot})')
                        quantity = number(row.get(f'Upgrade Material Quantity {stars} ({slot})'))
                        if name in (None, '-'):
                            continue
                        assert quantity is not None and quantity > 0, (actor, level, name)
                        material_id, zh = materials.get(normalized(name), (None, name))
                        required.append({'id': material_id, 'name': zh, 'originalName': name, 'quantity': quantity})
                    cost = re.search(r'(\d+)\s+rupees', echo.get('Upgrade ' + stars, ''), re.I)
                    assert cost is not None, (actor, level, 'upgrade rupees')
                    item['armorLevels'].append({'level': level, 'defense': defense, 'rupees': int(cost[1]), 'materials': required})
                    upgraded = row.get('ActorName ' + stars)
                    assert upgraded not in (None, '-'), (actor, level)
                    aliases.append({'id': upgraded, 'targetId': actor, 'upgradeLevel': level, 'defense': defense})
                altered = row.get('ActorName (Base) [Altered]')
                if altered not in (None, '-'):
                    aliases.append({'id': altered, 'targetId': actor, 'upgradeLevel': 0, 'defense': item['defense']})
            if tab != 'Armor':
                assert item['baseDurability'] is not None and item['baseDurability'] > 0, actor
                item['modifiers'].update(durabilityUp=band(row.get('Durability Up Range')), durabilityUpPlus=band(row.get('Durability Up+ Range')))
                item['description'] = '数值为无词条、未融合时的基础属性。'
            else:
                item['description'] = ('这件防具覆盖全身，防御与强化费用按整体记录。' if item['armorSlot'] == 'full'
                                       else '防具按单件显示防御，强化材料为升级到相应星级所需。')
            if actor == 'Weapon_Sword_070':
                item['attackNote'] = '常态基础攻击 30；接近瘴气等特殊状态会变化，游戏菜单隐藏该值。'
                item['durabilityNote'] = '基础耐久 40；耗尽后进入恢复阶段，特殊战斗状态另有规则。'
            if actor == 'Weapon_Sword_070_Broken':
                item['durabilityNote'] = '采用 Phil 表与参数参考的 4；旧 Echo 表为 6，来源差异已保留。'
            if category in ('armor', 'shield'):
                assert item['defense'] is not None, (actor, 'missing defense')
            else:
                assert item['attack'] is not None or item['attackRange'] is not None, (actor, 'missing attack')
            item['modifiers'] = {k: v for k, v in item['modifiers'].items() if v is not None}
            items.append(item)

    ids = {item['id'] for item in items}
    assert len(ids) == len(items) == 310
    assert len({a['id'] for a in aliases}) == len(aliases) and not ids.intersection(a['id'] for a in aliases)
    previous_names = json.loads((ROOT / 'public/data/equipment-names.json').read_text())
    available = ids | {a['id'] for a in aliases}
    legacy = {key: translations.get(key, value) for key, value in previous_names.items() if key not in available}
    timestamp = datetime.now(timezone.utc).isoformat()
    source = {'name': 'Phil · TotK 装备数据表（已对照）', 'status': 'verified',
              'url': SOURCES['phil'][1].replace('/export?format=xlsx', '/edit'), 'checkedAt': timestamp}
    output = ROOT / 'public/data'
    output.mkdir(parents=True, exist_ok=True)
    write_json(output / 'equipment.json', {'schemaVersion': 1, 'source': source, 'items': items, 'aliases': aliases, 'legacyNames': legacy})
    manifest = {'schemaVersion': 1, 'updatedAt': timestamp, 'gameVersion': None,
                'versionNote': '原始表未统一声明游戏版本；按抓取快照展示。参数参考文件来自 Product.142 相关仓库。',
                'catalogTotal': len(items), 'counts': dict(Counter(item['category'] for item in items)),
                'armorLevels': sum(len(item.get('armorLevels', [])) for item in items),
                'upgradeAliases': len(aliases), 'legacyUnavailable': len(legacy), 'chineseNames': len(items),
                'verification': {'method': 'Cross-check two original data tables, with documented source differences; no claim of in-game testing.',
                                 'comparedNumericFields': comparisons, 'matchedNumericFields': comparisons - len(differences), 'differences': differences,
                                 'conditionalAttack': ['Weapon_Bow_166', 'Weapon_Sword_070']}, 'sources': hashes}
    write_json(output / 'equipment-manifest.json', manifest)
    fields = ['id', 'name', 'originalName', 'category', 'variant', 'attack', 'rawAttack', 'attackRange', 'defense', 'baseDurability', 'arrowsPerShot', 'bowRange', 'fuseExtraDurability', 'armorLevels', 'modifiers']
    with (output / 'equipment.csv').open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.writer(file, lineterminator='\n')
        writer.writerow(fields)
        for item in items:
            writer.writerow([json.dumps(item[field], ensure_ascii=False) if isinstance(item.get(field), (dict, list)) else item.get(field) for field in fields])
    print(json.dumps({key: manifest[key] for key in ('catalogTotal', 'counts', 'armorLevels', 'upgradeAliases', 'legacyUnavailable', 'verification')}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
