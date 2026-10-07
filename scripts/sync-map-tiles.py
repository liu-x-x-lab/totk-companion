#!/usr/bin/env python3
"""Download every native world-map tile for an offline package."""
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
import argparse
import hashlib
import http.client
import io
import json
import math
from pathlib import Path
import time
import threading
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://objmap-totk.zeldamods.org"
LAYERS = ("Ground", "Sky", "Depths")
CONNECTIONS = threading.local()


def download(path):
    # Each worker reuses its TLS connection rather than reconnecting for every tile.
    if not getattr(CONNECTIONS, "connection", None):
        CONNECTIONS.connection = http.client.HTTPSConnection("objmap-totk.zeldamods.org", timeout=25)
    connection = CONNECTIONS.connection
    try:
        connection.request("GET", path, headers={"User-Agent": "totk-companion/0.1"})
        response = connection.getresponse()
        data = response.read()
        if response.status != 200:
            raise ValueError(f"Upstream returned HTTP {response.status}")
        return data
    except Exception:
        connection.close()
        CONNECTIONS.connection = None
        raise


def validate(data):
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise ValueError("The source response is not a WebP tile")
    with Image.open(io.BytesIO(data)) as image:
        image.load()
        if image.size != (256, 256):
            raise ValueError(f"Unexpected map tile dimensions: {image.size}")


def acquire(relative):
    path = ROOT / "public" / relative
    if path.exists():
        data = path.read_bytes()
        validate(data)
    else:
        layer, level, x, filename = relative.split("/")[1:]
        url = f"{ORIGIN}/game_files/map/{layer}/maptex/{level}/{x}/{filename}"
        for attempt in range(3):
            try:
                data = download(url.removeprefix(ORIGIN))
                validate(data)
                break
            except Exception:
                if attempt == 2:
                    raise
                time.sleep(attempt + 1)
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_bytes(data)
        temporary.replace(path)
    return {"file": "/" + relative, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workers", type=int, default=16, choices=range(1, 17))
    args = parser.parse_args()
    tasks, counts = [], {}
    for layer in LAYERS:
        for level in range(2, 8):
            factor = 2 ** (level - 7)
            columns, rows = math.ceil(24000 * factor / 256), math.ceil(20000 * factor / 256)
            counts[f"{layer}/{level}"] = columns * rows
            tasks.extend(f"maps/{layer}/{level}/{x}/{y}.webp" for x in range(columns) for y in range(rows))
    print(f"Checking and downloading {len(tasks):,} tiles for three map layers", flush=True)
    results, errors = [], []
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(acquire, relative): relative for relative in tasks}
        for future in as_completed(futures):
            try:
                results.append(future.result())
            except Exception as error:
                errors.append(f"{futures[future]}: {error}")
            complete = len(results) + len(errors)
            if complete % 500 == 0 or complete == len(tasks):
                print(f"{complete:,}/{len(tasks):,}; saved {sum(item['bytes'] for item in results) / 1024 / 1024:.1f} MiB; errors {len(errors)}", flush=True)
    if errors:
        (ROOT / ".cache").mkdir(exist_ok=True)
        (ROOT / ".cache/map-tile-errors.txt").write_text("\n".join(errors))
        raise RuntimeError(f"{len(errors)} tiles missing; rerun to resume. See .cache/map-tile-errors.txt")
    results.sort(key=lambda item: item["file"])
    manifest = {"schemaVersion": 1, "source": {"name": "TotK Object Map · native world map tiles", "url": ORIGIN,
        "checkedAt": datetime.now(timezone.utc).isoformat(), "gameVersion": None,
        "path": "/game_files/map/{Ground|Sky|Depths}/maptex/{level}/{x}/{y}.webp",
        "verification": "Every WebP decoded at 256×256, native bounds and level counts checked, SHA-256 recorded"},
        "levels": list(range(2, 8)), "total": len(results), "bytes": sum(item["bytes"] for item in results),
        "counts": counts, "tiles": results}
    target = ROOT / "public/data/offline-map-manifest.json"
    target.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"Complete: {manifest['total']:,} tiles; {manifest['bytes'] / 1024 / 1024:.1f} MiB", flush=True)


if __name__ == "__main__":
    main()
