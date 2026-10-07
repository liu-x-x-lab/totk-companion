#!/usr/bin/env python3
"""Build a local Chinese map-name layer from attributed static markers and game text."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import argparse
import collections
import hashlib
import json
from pathlib import Path
import re
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = "1c66ac1a02edf2d73d10b0dc6f0f2de29da7b119"
TEXT_ORIGIN = f"https://raw.githubusercontent.com/sh0wer1ee/TotkText/{SNAPSHOT}"
STATIC_URL = "https://objmap-totk.zeldamods.org/game_files/map_summary/MainField/static.json"


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "totk-companion/0.1"}), timeout=45) as response:
        return response.read()


def clean(text):
    return re.sub(r"<[^>]*>", "", text).replace("\n", " ").strip()


def layer(marker):
    message = marker["MessageID"]
    explicit = marker.get("map_name")
    if explicit == "Sky": return "sky"
    if explicit == "Surface": return "surface"
    if message.startswith("MinusField_") or marker["Translate"]["Y"] < -50: return "depths"
    if message.endswith("_Sky") or message.startswith("SkyIslands_") or marker["Translate"]["Y"] >= 1000: return "sky"
    return "surface"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    cache = ROOT / ".cache/locations"
    cache.mkdir(parents=True, exist_ok=True)
    sources = [("static.json", STATIC_URL)] + [(f"location-{index:04}.json", f"{TEXT_ORIGIN}/data/chunks/LocationMsg/Location/{index:04}.json") for index in range(15)]
    if not args.offline:
        def acquire(item):
            name, url = item
            (cache / name).write_bytes(fetch(url))
        with ThreadPoolExecutor(max_workers=4) as pool:
            list(pool.map(acquire, sources))
    texts = {}
    for name, _ in sources[1:]:
        chunk = json.loads((cache / name).read_text())
        assert chunk["meta"]["version"] == "121"
        for row in chunk["rows"]:
            texts[row["key"]] = {"name": clean(row["CNzh"]), "originalName": clean(row["USen"])}
    static = json.loads((cache / "static.json").read_text())
    groups, excluded = {}, []
    for group in ("Location", "Place", "Labo"):
        for marker in static["markers"][group]:
            key = marker["MessageID"]
            if key not in texts:
                if not (key.startswith("ZonauRelief_") or key in ("ShieldSurfing_BeginnerGoal", "ShieldSurfing_SeniorGoal")):
                    raise ValueError(f"Missing Chinese location text: {key}")
                excluded.append({"id": "loc:" + marker["hash_id"], "messageId": key,
                                 "reason": "Technical objective marker, not a named geographic place; retained in the full point index"})
                continue
            map_layer = layer(marker)
            groups.setdefault((map_layer, key), []).append((group, marker))
    labels, locations = [], {}
    point_pack = json.loads((ROOT / "public/data/points.json").read_text())
    source_points = {row[0]: row for row in point_pack["rows"]}
    best_matches = {}
    for (map_layer, key), records in sorted(groups.items()):
        group, marker = records[0]
        kind = "region" if key.startswith("MapRegion_") else "stable" if marker.get("Icon") == "Hatago" else "town" if marker.get("Icon") == "Village" else "lab" if group == "Labo" else "landmark"
        xyz = [round(sum(item[1]["Translate"][axis] for item in records) / len(records), 4) for axis in ("X", "Y", "Z")]
        if not (-6000 <= xyz[0] <= 6000 and -5000 <= xyz[2] <= 5000): raise ValueError("Label outside world bounds")
        identifier = "loc:" + marker["hash_id"]
        levels = sorted({level for _, record in records for level in record.get("ShowLevel", "").split(",") if level})
        labels.append({"id": identifier, "messageId": key, **texts[key], "layer": map_layer, "kind": kind,
                       "showLevel": ",".join(levels), "rawCoordinates": xyz,
                       "mapPosition": {"x": (xyz[0] + 6000) / 12000, "y": (xyz[2] + 5000) / 10000},
                       "sourceIds": ["loc:" + item[1]["hash_id"] for item in records]})
        for _, record in records:
            source_id = "loc:" + record["hash_id"]
            point = source_points.get(source_id)
            distance = sum((record["Translate"][axis] - point[4 + index]) ** 2 for index, axis in enumerate(("X", "Y", "Z"))) if point else 0
            if distance < best_matches.get(source_id, float("inf")):
                best_matches[source_id] = distance
                locations[source_id] = {**texts[key], "layer": map_layer}
    for key in ("City_BaseCamp", "Hateno", "Kakariko", "BeginningIsland", "MinusField_AncientColosseum"):
        assert any(label["messageId"] == key for label in labels), key
    assert all(label["layer"] == "sky" for label in labels if label["messageId"].endswith("_Sky"))
    pack = {"schemaVersion": 1, "source": {"name": "TotK Object Map + TotkText Chinese location text", "checkedAt": datetime.now(timezone.utc).isoformat(),
            "mapSource": STATIC_URL, "mapGameVersion": None, "textSource": "https://github.com/sh0wer1ee/TotkText", "textSnapshot": SNAPSHOT, "textGameVersion": "1.2.1",
            "verification": "MessageID matched to CNzh game text; static source IDs, coordinates, ShowLevel and layer preserved; duplicate label records merged only for display",
            "files": [{"url": url, "sha256": hashlib.sha256((cache / name).read_bytes()).hexdigest()} for name, url in sources]},
            "total": len(labels), "counts": dict(collections.Counter(label["layer"] for label in labels)), "labels": labels, "locations": locations, "excludedTechnicalMarkers": excluded}
    output = ROOT / "public/data/map-labels.json"
    output.write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    # Fix the old height-only boundary (exactly 1000 m) without changing IDs or coordinates.
    points_path = ROOT / "public/data/points.json"
    points = json.loads(points_path.read_text())
    corrections = []
    for row in points["rows"]:
        name = locations.get(row[0])
        if name and row[3] != name["layer"]:
            corrections.append({"id": row[0], "from": row[3], "to": name["layer"]})
            row[3] = name["layer"]
    if corrections:
        points_path.write_text(json.dumps(points, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        manifest_path = ROOT / "public/data/manifest.json"
        manifest = json.loads(manifest_path.read_text())
        manifest["layers"] = dict(collections.Counter(row[3] for row in points["rows"]))
        manifest["layerCorrections"] = corrections
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        print(f"Corrected the layer of {len(corrections)} static landmarks; all IDs and coordinates preserved")
    print(f"Saved {len(labels)} Chinese map labels, {len(locations)} source location IDs: {pack['counts']}")


if __name__ == "__main__":
    main()
