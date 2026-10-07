#!/usr/bin/env python3
"""Keep local, crisp shrine/lightroot vectors with fixed upstream provenance."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / '.cache/shrine-research'
SNAPSHOT = '3c37e5317c5fce3b4edf1bb2daf49c5607871a8f'
ORIGIN = f'https://raw.githubusercontent.com/zeldamods/objmap-totk/{SNAPSHOT}'
ICONS = {
    'shrine': ('339926032fca3e5c447ad6c92974d55db0d70542', '3 4 18.5 19.5'),
    'lightroot': ('22b462e22c33bc8e8ebe128a17e675457efb58af', '4 2 18 17'),
}


def fetch(path, destination):
    with urlopen(Request(f'{ORIGIN}/{path}', headers={'User-Agent': 'totk-companion/0.1.2'}), timeout=45) as response:
        destination.write_bytes(response.read())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--offline', action='store_true')
    args = parser.parse_args()
    CACHE.mkdir(parents=True, exist_ok=True)
    output_dir = ROOT / 'public/ui/map'
    output_dir.mkdir(parents=True, exist_ok=True)
    license_path = CACHE / 'LICENSE.md'
    if not args.offline:
        fetch('LICENSE.md', license_path)
    license_data = license_path.read_bytes()
    assert b'GNU GENERAL PUBLIC LICENSE' in license_data
    local_license = ROOT / 'public/licenses/objmap-totk-GPL-3.0.txt'
    local_license.parent.mkdir(parents=True, exist_ok=True)
    local_license.write_bytes(license_data)
    records = []
    for name, (blob, viewbox) in ICONS.items():
        source_path = f'public/icons/{name}.svg'
        cached = CACHE / f'{name}.svg'
        if not args.offline:
            fetch(source_path, cached)
        raw = cached.read_bytes()
        actual_blob = hashlib.sha1(f'blob {len(raw)}\0'.encode() + raw).hexdigest()
        assert actual_blob == blob, f'Unexpected upstream icon: {name}'
        source = ET.fromstring(raw)
        elements = []
        svg_ns = '{http://www.w3.org/2000/svg}'
        for group in source.findall(f'{svg_ns}g'):
            transform = group.get('transform')
            if transform:
                elements.append(f'<g transform="{transform}">')
            for element in group:
                tag = element.tag.removeprefix(svg_ns)
                assert tag in ('path', 'circle')
                attributes = {key: value for key, value in element.attrib.items()
                              if key in ('d', 'cx', 'cy', 'r', 'style')}
                # Preserve the actual game-map shape/fill/stroke, remove editor metadata and blurry halo.
                attributes = ' '.join(f'{key}="{value}"' for key, value in attributes.items())
                elements.append(f'<{tag} {attributes}/>')
            if transform:
                elements.append('</g>')
        local = (f'<!-- ZeldaMods objmap-totk {SNAPSHOT}; GPL-3.0, see /licenses/objmap-totk-GPL-3.0.txt. '
                 'Modified 2026-10-07: remove blur/editor metadata and trim viewBox. Game symbols belong to their rights holders. -->\n'
                 f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{viewbox}">\n' + '\n'.join(elements) + '\n</svg>\n').encode()
        path = output_dir / f'{name}.svg'
        path.write_bytes(local)
        records.append({'name': name, 'file': f'/ui/map/{name}.svg', 'sourcePath': source_path,
                        'sourceUrl': f'{ORIGIN}/{source_path}', 'gitBlob': blob,
                        'sourceSha256': hashlib.sha256(raw).hexdigest(), 'sha256': hashlib.sha256(local).hexdigest(),
                        'bytes': len(local), 'format': 'svg', 'viewBox': viewbox})
    manifest = {'schemaVersion': 1, 'checkedAt': datetime.now(timezone.utc).isoformat(),
                'source': 'https://github.com/zeldamods/objmap-totk', 'snapshot': SNAPSHOT,
                'license': 'GPL-3.0', 'licenseFile': '/licenses/objmap-totk-GPL-3.0.txt',
                'verification': 'Original SVG bytes matched fixed Git blobs; shrine and lightroot shape paths, transforms, fills and strokes preserved. Blurred CSS shadows and editor metadata removed, viewBox trimmed. Community representations of game map symbols, not official exported game assets.',
                'total': len(records), 'icons': records}
    (ROOT / 'public/data/map-icons-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print('Saved 2 source-matched, local SVG map symbols and their upstream license')


if __name__ == '__main__':
    main()
