#!/usr/bin/env python3
"""Download attributable public TotK placements and build a compact local coordinate index."""
import argparse
import collections
import concurrent.futures
import csv
import datetime
import hashlib
import json
import pathlib
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
UPSTREAM = 'https://objmap-totk.zeldamods.org'
RADAR = 'https://radar-totk.zeldamods.org'
QUERIES = {
    'enemies': 'actor:^Enemy_',
    'special': 'actor:^MiasmaSwarm',
    'objects': 'actor:^TBox_ OR actor:^Weapon_ OR actor:^Item_ OR actor:^Animal_ OR actor:^Npc_ OR actor:^SpObj_ OR actor:^Obj_Mineral OR name:"Ore Deposit" OR name:"Zonaite Deposit"',
}
# Shrine layer membership from the source's map index; height alone misclassifies two shrines.
SKY_SHRINES = {38,105,43,151,34,149,82,128,117,148,121,145,15,55,60,62,63,61,71,109,150,127,83,93,66,146,45,50,69,110,99,52}
MONSTERS = [
 ('Enemy_Giant_Bone','stalnox'), ('Enemy_Giant','hinox'), ('Enemy_Lynel','lynel'),
 ('Enemy_Golem_Little','pebblit'), ('Enemy_Golem','talus'), ('Enemy_Zonau_BlockMaster','flux'),
 ('Enemy_Drake','gleeok'), ('Enemy_Mogurudo_Baby','little-frox'), ('Enemy_Mogurudo','frox'),
 ('Enemy_Sandworm','molduga'), ('Enemy_Bokoblin_Boss','boss-bokoblin'), ('Enemy_Bokoblin','bokoblin'),
 ('Enemy_Moriblin','moblin'), ('Enemy_Lizalfos','lizalfos'), ('Enemy_Zonau','construct'),
 ('Enemy_Chuchu','chuchu'), ('Enemy_Keese','keese'), ('Enemy_LikeLike','like-like'),
 ('Enemy_Wizzrobe','wizzrobe'), ('Enemy_Octarock','octorok'), ('Enemy_Toby','aerocuda'),
 ('Enemy_Zombie','gibdo'), ('Enemy_Horablin','horablin'), ('Enemy_CaveMaster','bubbulfrog'),
 ('Enemy_Treant','evermean'), ('Enemy_Assassin','yiga'), ('Enemy_PhantomGanon','phantom-ganon'),
 ('Enemy_DungeonBoss','temple-boss'), ('Enemy_Dragon','dragon'), ('Enemy_Ganondorf','story-boss'), ('Enemy_Kohga','story-boss'),
]

def fetch(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'TotkCompanion/0.1 (public map research)'})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()

def write_json(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def classify_actor(actor):
    if actor.startswith('MiasmaSwarm'): return 'gloom-spawn'
    if actor.startswith('Enemy_'):
        return next((category for prefix, category in MONSTERS if actor.startswith(prefix)), 'other-enemy')
    if actor.startswith('TBox_'): return 'chest'
    if actor.startswith('Weapon_'): return 'weapon'
    if actor.startswith(('Npc_', 'NPC_')): return 'npc'
    if actor.startswith('SpObj_'): return 'zonai'
    if actor.startswith('Animal_Fish'): return 'fish'
    if actor.startswith('Animal_Insect'): return 'insect'
    if actor.startswith('Animal_'): return 'animal'
    if 'Mineral' in actor: return 'ore'
    if actor.startswith('Item_Fruit'): return 'fruit'
    if actor.startswith('Item_Plant'): return 'plant'
    if actor.startswith('Item_Mushroom'): return 'mushroom'
    if actor.startswith('Item_Ore'): return 'ore'
    if actor.startswith('Item_Enemy'): return 'monster-material'
    if 'Arrow' in actor: return 'arrow'
    if actor.startswith('Item_'): return 'material'
    return 'other-object'

def actor_layer(obj):
    if obj['map_type'].startswith('MinusField'): return 'depths'
    if obj.get('map_name', '').startswith('Sky'): return 'sky'
    return 'surface'

def marker_class(group, marker):
    if group == 'Cave': return 'well' if str(marker.get('MessageID','')).startswith('Well_') else 'cave'
    if group == 'Place': return 'stable' if marker.get('Icon') == 'Hatago' else 'settlement'
    return {'Dungeon':'shrine','CheckPoint':'root','Tower':'tower','Korok':'korok','Chasm':'chasm','Location':'landmark','DragonTears':'tear','Shop':'shop','Labo':'lab','Dispensers':'dispenser'}[group]

def marker_layer(group, marker):
    if group == 'Dungeon':
        return 'sky' if int(marker['MessageID'].replace('Dungeon','')) in SKY_SHRINES else 'surface'
    if group == 'CheckPoint': return 'depths'
    if marker.get('map_name') == 'Sky': return 'sky'
    if marker.get('map_name') == 'Surface': return 'surface'
    message = str(marker.get('MessageID', ''))
    if message.endswith('_Sky') or message.startswith('SkyIslands_'): return 'sky'
    y = marker['Translate']['Y']
    if y < -50: return 'depths'
    if y >= 1000: return 'sky'
    return 'surface'

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--source-dir', type=pathlib.Path, default=ROOT / '.cache' / 'sources')
    parser.add_argument('--offline', action='store_true', help='Use previously downloaded source JSONs')
    parser.add_argument('--tiles', action='store_true', help='Download low-resolution overview tiles for all three layers')
    args = parser.parse_args()
    cache = args.source_dir
    cache.mkdir(parents=True, exist_ok=True)
    sources = {
        'static': f'{UPSTREAM}/game_files/map_summary/MainField/static.json',
        'names': f'{UPSTREAM}/game_files/names.json',
        'location-names': f'{UPSTREAM}/game_files/text/StaticMsg/LocationMarker.json',
    }
    for name, query in QUERIES.items():
        sources[f'{name}-world'] = f'{RADAR}/objs/MainAndMinusField/?' + urllib.parse.urlencode({'q':query,'withMapNames':'true','limit':'-1'})
    filenames = {name: cache / f'totk-{name}.json' for name in sources}
    if not args.offline:
        def download(item):
            name, url = item
            filenames[name].write_bytes(fetch(url))
        with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
            list(pool.map(download, sources.items()))
    data = {name:json.loads(path.read_text()) for name,path in filenames.items()}
    names = data['names']; locations = data['location-names']
    strings = []; string_ids = {}
    def sid(value):
        value = str(value or '')
        if value not in string_ids:
            string_ids[value] = len(strings); strings.append(value)
        return string_ids[value]
    rows = []; seen = set(); excluded = []
    for obj in data['enemies-world'] + data['objects-world'] + data['special-world']:
        identifier = 'obj:' + obj['hash_id']
        if identifier in seen: continue
        seen.add(identifier)
        x,y,z = obj['pos']
        if not (-6000 <= x <= 6000 and -5000 <= z <= 5000):
            excluded.append(identifier); continue
        actor = obj['name']
        category = classify_actor(actor)
        loot = (obj.get('drop') or {})
        contents = loot.get('value',[]) if loot.get('type')=='Actor' else []
        title = names.get(actor,actor)
        if actor.startswith('TBox_'):
            if 'Obj_SageWill' in contents: category='sages-will'; title="Sage's Will"
            elif any(item.startswith('Obj_TreasureMap_') for item in contents): category='old-map'; title='Old Map'
        rows.append([identifier,sid(title),category,actor_layer(obj),x,y,z,sid(obj.get('region')),sid(actor),obj['objid'],[sid(names.get(item,item)) for item in contents]])
    for group, markers in data['static']['markers'].items():
        for marker in markers:
            p = marker['Translate']; x,y,z = p['X'],p['Y'],p['Z']
            message = marker.get('MessageID') or marker.get('id') or marker.get('name') or group
            if isinstance(message,list): message = ', '.join(message)
            label = locations.get(message) or marker.get('name') or message
            identifier = 'loc:' + marker['hash_id']
            if identifier in seen: continue
            seen.add(identifier)
            rows.append([identifier,sid(label),marker_class(group,marker),marker_layer(group,marker),round(x,4),round(y,4),round(z,4),sid(locations.get(message,'')),sid(message),None])
    counts = collections.Counter(row[2] for row in rows)
    layers = collections.Counter(row[3] for row in rows)
    assert counts['hinox'] == 49 and counts['stalnox'] == 20 and counts['lynel'] == 34, counts
    assert counts['flux'] == 35 and counts['talus'] == 87
    assert counts['sages-will'] == 20 and counts['old-map'] == 31
    assert counts['shrine'] == 152 and counts['root'] == 120 and counts['tower'] == 15
    assert sum(row[2]=='shrine' and row[3]=='sky' for row in rows) == 32
    source_manifest = {
        'schemaVersion':1,'updatedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'provider':'TotK Object Map / ZeldaMods','gameVersion':None,'total':len(rows),
        'counts':dict(sorted(counts.items())),'layers':dict(layers),'excludedOutsideWorld':excluded,
        'sources':[{'name':name,'url':url,'sha256':hashlib.sha256(filenames[name].read_bytes()).hexdigest()} for name,url in sources.items()],
        'scope':'Fixed MainField / sky and MinusField placements plus all upstream static exploration markers. Dynamic spawns, quest state and interior-only dungeon placements are not live game state.',
        'coordinateSystem':{'raw':'X east, Y height, Z south','display':'X east, Y north = -raw Z, Z height = raw Y','bounds':[-6000,6000,-5000,5000]},
    }
    write_json(ROOT/'public/data/points.json',{'schemaVersion':1,'strings':strings,'rows':rows})
    write_json(ROOT/'public/data/manifest.json',source_manifest)
    write_json(ROOT/'public/data/equipment-names.json',{k:v for k,v in names.items() if k.startswith(('Weapon_','Armor_'))})
    with (ROOT/'public/data/coordinates.csv').open('w',encoding='utf-8-sig',newline='') as file:
        writer = csv.writer(file, lineterminator='\n')
        writer.writerow(['id','original_name','category','layer','east_x','north_y','height_z','raw_x','raw_y','raw_z','region','actor','source_object_id','associated_items'])
        for identifier,name,category,layer,x,y,z,region,actor,objid,*extra in rows:
            contents = extra[0] if extra else []
            writer.writerow([identifier,strings[name],category,layer,x,-z,y,x,y,z,strings[region],strings[actor],objid,'; '.join(strings[index] for index in contents)])
    if args.tiles:
        tasks = [(layer,x,y) for layer in ['Ground','Sky','Depths'] for x in range(3) for y in range(3)]
        def tile(task):
            layer,x,y = task
            target = ROOT/f'public/maps/{layer}/2/{x}/{y}.webp'
            target.parent.mkdir(parents=True,exist_ok=True)
            target.write_bytes(fetch(f'{UPSTREAM}/game_files/map/{layer}/maptex/2/{x}/{y}.webp'))
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(tile,tasks))
    print(json.dumps({'total':len(rows),'layers':dict(layers),'counts':dict(sorted(counts.items()))},ensure_ascii=False,indent=2))

if __name__ == '__main__': main()
