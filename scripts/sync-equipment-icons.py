#!/usr/bin/env python3
"""Snapshot inventory icons by exact equipment Actor ID, with provenance."""

import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import struct
import time
from urllib.parse import quote
from urllib.request import Request, urlopen
import zlib

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "TOTKSheet/TOTKImages"
TREE_URL = f"https://api.github.com/repos/{REPOSITORY}/git/trees/main?recursive=1"


def fetch(url):
    for attempt in range(3):
        try:
            request = Request(url, headers={"User-Agent": "totk-companion-asset-sync"})
            with urlopen(request, timeout=25) as response:
                return response.read()
        except Exception:
            if attempt == 2:
                raise
            time.sleep(attempt + 1)


def png_dimensions(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("Not a PNG")
    offset, dimensions, ended = 8, None, False
    while offset + 12 <= len(data):
        length = struct.unpack(">I", data[offset:offset + 4])[0]
        kind = data[offset + 4:offset + 8]
        payload = data[offset + 8:offset + 8 + length]
        checksum = data[offset + 8 + length:offset + 12 + length]
        if len(checksum) != 4 or zlib.crc32(kind + payload) & 0xFFFFFFFF != struct.unpack(">I", checksum)[0]:
            raise ValueError("Invalid PNG chunk")
        if kind == b"IHDR":
            dimensions = struct.unpack(">II", payload[:8])
        offset += length + 12
        if kind == b"IEND":
            ended = True
            break
    if not ended or not dimensions or not all(0 < value <= 4096 for value in dimensions):
        raise ValueError("Invalid PNG dimensions or incomplete file")
    return dimensions


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tree-file", type=Path, help="Reuse a GitHub recursive tree response")
    args = parser.parse_args()
    commit = json.loads(fetch(f"https://api.github.com/repos/{REPOSITORY}/commits/main"))
    snapshot = commit["sha"]
    tree_snapshot = commit["commit"]["tree"]["sha"]
    tree = json.loads(args.tree_file.read_text() if args.tree_file else fetch(TREE_URL.replace("/main?", f"/{tree_snapshot}?")))
    if tree.get("truncated") or not tree.get("sha"):
        raise ValueError("The upstream image tree is incomplete")
    if tree["sha"] != tree_snapshot:
        raise ValueError("The cached image tree does not match the upstream commit; retry without --tree-file")
    blobs = {entry["path"]: entry["sha"] for entry in tree["tree"] if entry["path"].endswith(".png")}
    items = json.loads((ROOT / "public/data/equipment.json").read_text())["items"]
    assignments = []
    for item in items:
        matches = [path for path in blobs if path.endswith("/" + item["id"] + ".png")]
        if len(matches) != 1:
            raise ValueError(f"Expected a unique icon for {item['id']}: {matches}")
        assignments.append((item["id"], matches[0]))
    directory = ROOT / "public/images/equipment"
    directory.mkdir(parents=True, exist_ok=True)

    def download(assignment):
        actor_id, source_path = assignment
        url = f"https://raw.githubusercontent.com/{REPOSITORY}/{snapshot}/{quote(source_path)}"
        data = fetch(url)
        git_blob = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        if git_blob != blobs[source_path]:
            raise ValueError(f"Downloaded icon does not match its Git blob: {source_path}")
        width, height = png_dimensions(data)
        filename = actor_id + ".png"
        (directory / filename).write_bytes(data)
        return {"id": actor_id, "file": f"/images/equipment/{filename}", "sourcePath": source_path,
                "width": width, "height": height, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}

    with ThreadPoolExecutor(max_workers=8) as pool:
        icons = list(pool.map(download, assignments))
    manifest = {"schemaVersion": 1, "source": {"name": REPOSITORY,
                "url": f"https://github.com/{REPOSITORY}", "snapshot": snapshot, "treeSnapshot": tree["sha"],
                "checkedAt": datetime.now(timezone.utc).isoformat(),
                "verification": "Exact Actor ID and unique path; Git blob SHA, PNG chunks, dimensions, and SHA-256 checked"},
                "total": len(icons), "icons": icons}
    (ROOT / "public/data/equipment-icons-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
    print(f"Saved {len(icons)} verified PNGs ({sum(icon['bytes'] for icon in icons):,} bytes), snapshot {snapshot}")


if __name__ == "__main__":
    main()
