#!/usr/bin/env python3
"""Build an attributed quest catalogue and attach project-authored offline tutorials."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import hashlib
from html.parser import HTMLParser
import json
from pathlib import Path
import re
import unicodedata
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOT = "1c66ac1a02edf2d73d10b0dc6f0f2de29da7b119"
ORIGIN = f"https://raw.githubusercontent.com/sh0wer1ee/TotkText/{SNAPSHOT}"
CATEGORIES = {
    "main": "https://www.powerpyx.com/zelda-tears-of-the-kingdom-walkthrough-all-quests/",
    "adventure": "https://www.powerpyx.com/zelda-tears-of-the-kingdom-all-side-adventures-guide/",
    "shrine": "https://www.powerpyx.com/zelda-tears-of-the-kingdom-all-shrine-quests/",
    "side": "https://www.powerpyx.com/zelda-tears-of-the-kingdom-all-side-quests-guide/",
}
FILENAMES = {"main": "category-source.html", **{kind: f"category-{kind}.html" for kind in ("adventure", "shrine", "side")}}


class ListItems(HTMLParser):
    def __init__(self):
        super().__init__(); self.li = 0; self.text = ""; self.in_link = False; self.link_text = ""; self.link_url = ""; self.items = []
    def handle_starttag(self, tag, attrs):
        if tag == "li": self.li += 1; self.text = ""
        if tag == "a" and self.li: self.in_link = True; self.link_text = ""; self.link_url = dict(attrs).get("href", "")
    def handle_data(self, value):
        if self.li: self.text += value
        if self.in_link: self.link_text += value
    def handle_endtag(self, tag):
        if tag == "a" and self.in_link: self.items.append((self.link_text.strip(), self.link_url)); self.in_link = False
        if tag == "li" and self.li: self.items.append((self.text.strip(), "")); self.li -= 1


def normalized(text):
    text = re.sub(r"\s*\(Part [0-9]+\)", "", text)
    return re.sub(r"[^a-z0-9!?]", "", unicodedata.normalize("NFKD", text).lower())


def acquire(url, target):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0 (Hyrule Companion data update)"}), timeout=45) as response:
        target.write_bytes(response.read())


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true")
    args = parser.parse_args()
    cache = ROOT / ".cache/quests"
    cache.mkdir(parents=True, exist_ok=True)
    if not args.offline:
        tree_path = cache / "text-tree.json"
        acquire(f"https://api.github.com/repos/sh0wer1ee/TotkText/git/trees/{SNAPSHOT}?recursive=1", tree_path)
        paths = [item["path"] for item in json.loads(tree_path.read_text())["tree"] if item["type"] == "blob" and item["path"].startswith("data/chunks/ChallengeMsg/")]
        tasks = [(f"{ORIGIN}/{path}", cache / (path.split("/")[-2] + ".json")) for path in paths]
        tasks.extend((url, cache / FILENAMES[kind]) for kind, url in CATEGORIES.items())
        with ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(lambda task: acquire(*task), tasks))
    catalogue = {}
    for path in sorted(cache.glob("Info_*.json")):
        data = json.loads(path.read_text())
        assert data["meta"]["version"] == "121"
        title = next(row for row in data["rows"] if row["key"] == "Name")
        key = normalized(title["USen"])
        if key in catalogue: raise ValueError("Quest title normalization collision")
        catalogue[key] = {"id": path.stem.removeprefix("Info_"), "name": title["CNzh"], "originalName": title["USen"],
                          "sourceStageIds": [row["key"] for row in data["rows"] if row["key"] != "Name"], "textSha256": hashlib.sha256(path.read_bytes()).hexdigest()}
    classified = {}
    for kind, filename in FILENAMES.items():
        text = (cache / filename).read_text()
        if kind == "main":
            start = text.index("<h2>All Main Story Quests</h2>")
            text = text[start:text.find("<h2>", start + 1)]
        parser = ListItems(); parser.feed(text)
        for name, url in parser.items:
            key = normalized(name)
            if key in catalogue and key not in classified:
                classified[key] = {"category": kind, "referenceUrl": url if url.startswith("https://www.powerpyx.com/") else CATEGORIES[kind]}
    # Two shrine names are outside linked lists in this published index.
    for name in ("The South Lanayru Sky Crystal", "Rock for Sale"):
        key = normalized(name)
        if key not in classified: classified[key] = {"category": "shrine", "referenceUrl": CATEGORIES["shrine"]}
    classified[normalized("The Ancient City Gorondia!")] = {"category": "side", "referenceUrl": "https://www.powerpyx.com/zelda-tears-of-the-kingdom-the-ancient-city-of-gorondia-walkthrough/"}
    classified[normalized("The Ancient City Gorondia?")] = {"category": "side", "referenceUrl": CATEGORIES["side"]}
    if set(classified) != set(catalogue):
        raise ValueError(f"Unclassified quests: {[value['originalName'] for key,value in catalogue.items() if key not in classified]}")
    guides = json.loads((ROOT / "data/quest-guides.json").read_text())
    by_id = {quest["id"]: quest for quest in catalogue.values()}
    for guide in guides:
        if guide["id"] not in by_id: raise ValueError(f"Guide ID not in game catalogue: {guide['id']}")
    guide_map = {guide["id"]: guide for guide in guides}
    for key, quest in catalogue.items():
        quest.update(classified[key])
        quest.update(guide_map.get(quest["id"], {}))
        quest["guideStatus"] = "tutorial" if quest.get("stages") else "index"
    quests = sorted(catalogue.values(), key=lambda quest: (quest.get("order", 999), quest["category"], quest["name"]))
    counts = {kind: sum(quest["category"] == kind for quest in quests) for kind in CATEGORIES}
    if counts != {"main": 23, "adventure": 60, "shrine": 31, "side": 139}: raise ValueError(f"Quest categories mismatch: {counts}")
    assert all(quest["guideStatus"] == "tutorial" for quest in quests if quest["category"] == "main")
    pack = {"schemaVersion": 1, "updatedAt": datetime.now(timezone.utc).isoformat(), "total": len(quests), "counts": counts,
            "tutorialTotal": len(guides), "sources": {"textSource": "https://github.com/sh0wer1ee/TotkText", "textSnapshot": SNAPSHOT, "textGameVersion": "1.2.1",
            "categories": [{"url": url, "sha256": hashlib.sha256((cache / FILENAMES[kind]).read_bytes()).hexdigest()} for kind,url in CATEGORIES.items()],
            "tutorials": "Project-authored action summaries based on game stage objectives with published walkthrough references and selected cross-checks; no in-game device validation"}, "quests": quests}
    (ROOT / "public/data/quests.json").write_text(json.dumps(pack, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Built {len(quests)} quests, {len(guides)} offline tutorials, categories: {counts}")


if __name__ == "__main__": main()
