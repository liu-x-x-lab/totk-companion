#!/usr/bin/env python3
"""Build and verify the complete offline APK using an installed Android SDK."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
import math
import os
from pathlib import Path
import re
import secrets
import shutil
import subprocess
import zipfile

ROOT = Path(__file__).resolve().parents[1]
APPLICATION_ID = "app.hyrule.companion"
MIN_API = 26
TARGET_API = 35


def run(args, *, env=None, capture=False):
    print("Running " + Path(str(args[0])).name + " " + str(args[1]) if len(args) > 1 else str(args[0]), flush=True)
    result = subprocess.run([str(arg) for arg in args], cwd=ROOT, env=env, check=True,
                            capture_output=capture, text=True)
    return result.stdout if capture else ""


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_resources(directory):
    manifest = json.loads((directory / "data/offline-map-manifest.json").read_text())
    expected = set()
    for layer in ("Ground", "Sky", "Depths"):
        for level in range(2, 8):
            factor = 2 ** (level - 7)
            columns, rows = math.ceil(24000 * factor / 256), math.ceil(20000 * factor / 256)
            if manifest["counts"][f"{layer}/{level}"] != columns * rows:
                raise ValueError("Offline map level counts do not match native bounds")
            expected.update(f"maps/{layer}/{level}/{x}/{y}.webp" for x in range(columns) for y in range(rows))
    records = {tile["file"].lstrip("/"): tile for tile in manifest["tiles"]}
    if len(records) != 29835 or set(records) != expected or manifest["total"] != 29835:
        raise ValueError("The map package is incomplete")
    for path, tile in records.items():
        data = (directory / path).read_bytes()
        if len(data) != tile["bytes"] or sha(data) != tile["sha256"]:
            raise ValueError(f"Map tile integrity failed: {path}")
    icons = json.loads((directory / "data/equipment-icons-manifest.json").read_text())
    for item in icons["icons"]:
        path = directory / item["file"].lstrip("/")
        if sha(path.read_bytes()) != item["sha256"]:
            raise ValueError(f"Equipment icon integrity failed: {path.name}")
    for filename in ("points.json", "equipment.json", "manifest.json", "map-labels.json", "quests.json", "coordinates.csv", "equipment.csv"):
        if not (directory / "data" / filename).is_file():
            raise ValueError(f"Missing packaged data: {filename}")
    print(f"Verified {len(records):,} local map tiles and {len(icons['icons'])} equipment icons", flush=True)
    quests = json.loads((directory / "data/quests.json").read_text())
    labels = json.loads((directory / "data/map-labels.json").read_text())
    if quests["total"] != 253 or quests["tutorialTotal"] != 35 or labels["total"] != 730:
        raise ValueError("Quest tutorials or Chinese map labels are incomplete")
    return manifest


def verify_apk_assets(apk, directory):
    expected = {"assets/" + path.relative_to(directory).as_posix(): path
                for path in directory.rglob("*") if path.is_file()}
    with zipfile.ZipFile(apk) as archive:
        actual = {name for name in archive.namelist() if name.startswith("assets/") and not name.endswith("/")}
        if actual != set(expected):
            raise ValueError("APK assets do not match the complete production build")
        for name, path in expected.items():
            if sha(archive.read(name)) != sha(path.read_bytes()):
                raise ValueError(f"APK asset changed while packaging: {name}")
        if "classes.dex" not in archive.namelist():
            raise ValueError("APK is missing its native code")
    print(f"Verified {len(expected):,} assets inside the signed APK", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sdk", type=Path, default=Path(os.environ.get("ANDROID_SDK_ROOT", "/home/liuwei/Android/Sdk")))
    args = parser.parse_args()
    sdk = args.sdk
    platform = sdk / f"platforms/android-{TARGET_API}/android.jar"
    build_tools = sdk / "build-tools/34.0.0"
    if not platform.is_file() or not (build_tools / "aapt2").is_file():
        raise RuntimeError("Install Android platform 35 and build-tools 34.0.0, or pass --sdk")
    for program in ("java", "javac", "keytool", "npm"):
        if not shutil.which(program):
            raise RuntimeError(f"Required build program is missing: {program}")
    version = json.loads((ROOT / "package.json").read_text())["version"]
    if not re.fullmatch(r"[0-9]+\.[0-9]+\.[0-9]+", version):
        raise ValueError("Use a numeric release version")
    version_code = int(re.search(r'android:versionCode="([0-9]+)"', (ROOT / "android/AndroidManifest.xml").read_text()).group(1))
    verify_resources(ROOT / "public")
    run(["npm", "run", "build"])
    manifest = verify_resources(ROOT / "dist")
    run(["node", "scripts/verify-offline.mjs"])
    work = ROOT / ".cache/android/build"
    if work.exists():
        shutil.rmtree(work)
    (work / "classes").mkdir(parents=True)
    (work / "dex").mkdir()
    release = ROOT / "releases"
    release.mkdir(exist_ok=True)
    aapt2 = build_tools / "aapt2"
    run([aapt2, "compile", "--dir", ROOT / "android/res", "-o", work / "resources.zip"])
    unsigned = work / "unsigned.apk"
    run([aapt2, "link", "-o", unsigned, "-I", platform, "--manifest", ROOT / "android/AndroidManifest.xml",
         "--version-name", version, "-A", ROOT / "dist", "-0", "webp", "-0", "png", work / "resources.zip"])
    run(["javac", "--release", "8", "-classpath", platform, "-d", work / "classes",
         *sorted((ROOT / "android/src").rglob("*.java"))])
    run([build_tools / "d8", "--release", "--min-api", str(MIN_API), "--lib", platform,
         "--output", work / "dex", *sorted((work / "classes").rglob("*.class"))])
    with zipfile.ZipFile(unsigned, "a") as archive:
        for dex in sorted((work / "dex").glob("*.dex")):
            archive.write(dex, dex.name, compress_type=zipfile.ZIP_STORED)
    aligned = work / "aligned.apk"
    run([build_tools / "zipalign", "-p", "4", unsigned, aligned])
    signing = ROOT / ".cache/android/signing"
    signing.mkdir(parents=True, exist_ok=True)
    password_path = signing / "password"
    if not password_path.exists():
        with os.fdopen(os.open(password_path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), "w") as file:
            file.write(secrets.token_hex(24))
    env = {**os.environ, "TOTK_KEY_PASS": password_path.read_text().strip()}
    key = signing / "offline.p12"
    if not key.exists():
        run(["keytool", "-genkeypair", "-keystore", key, "-storetype", "PKCS12", "-alias", "offline",
             "-keyalg", "RSA", "-keysize", "3072", "-validity", "10000",
             "-storepass:env", "TOTK_KEY_PASS", "-keypass:env", "TOTK_KEY_PASS",
             "-dname", "CN=Hyrule Companion Local Build", "-noprompt"], env=env)
        key.chmod(0o600)
    apk = release / f"hyrule-companion-{version}-android-offline.apk"
    run([build_tools / "apksigner", "sign", "--ks", key, "--ks-key-alias", "offline",
         "--ks-pass", "env:TOTK_KEY_PASS", "--key-pass", "env:TOTK_KEY_PASS", "--out", apk, aligned], env=env)
    signature = run([build_tools / "apksigner", "verify", "--verbose", "--print-certs", apk], capture=True)
    print(signature, flush=True)
    run([build_tools / "zipalign", "-c", "-p", "4", apk])
    badging = run([aapt2, "dump", "badging", apk], capture=True)
    if f"package: name='{APPLICATION_ID}'" not in badging or f"versionCode='{version_code}'" not in badging or f"versionName='{version}'" not in badging or "uses-permission:" in badging:
        raise ValueError("APK package ID or permission scope is incorrect")
    verify_apk_assets(apk, ROOT / "dist")
    (release / "apk-verification.txt").write_text(signature + "\n" + badging, encoding="utf-8")
    bundle = release / f"hyrule-companion-{version}-offline-web.zip"
    with zipfile.ZipFile(bundle, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for path in sorted((ROOT / "dist").rglob("*")):
            if path.is_file():
                archive.write(path, path.relative_to(ROOT / "dist").as_posix())
        archive.write(ROOT / "docs/offline-install.md", "离线使用说明.md")
        for name in ("sources.md", "equipment-sources.md", "quest-sources.md", "ui-assets.md"):
            archive.write(ROOT / "docs" / name, "sources/" + name)
        archive.write(ROOT / "scripts/serve-offline.py", "serve-offline.py")
    shutil.copyfile(ROOT / "docs/offline-install.md", release / "安卓安装说明.md")
    report = {"version": version, "versionCode": version_code, "applicationId": APPLICATION_ID, "builtAt": datetime.now(timezone.utc).isoformat(),
              "minimumAndroidApi": MIN_API, "targetAndroidApi": TARGET_API, "permissions": [],
              "mapTiles": manifest["total"], "mapTileBytes": manifest["bytes"], "mapLevels": manifest["levels"],
              "chineseMapLabels": 730, "questCatalogue": 253, "offlineQuestTutorials": 35,
              "artifacts": [{"file": path.name, "bytes": path.stat().st_size, "sha256": sha(path.read_bytes())}
                            for path in (apk, bundle)]}
    (release / "package-manifest.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    (release / "SHA256SUMS.txt").write_text("".join(f"{item['sha256']}  {item['file']}\n" for item in report["artifacts"]))
    shutil.copyfile(ROOT / ".cache/verification/offline-test.json", release / "offline-test.json")
    apk_record = report["artifacts"][0]
    (release / "index.html").write_text(f'''<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>海拉鲁探险手册 · 安卓下载</title>
<style>*{{box-sizing:border-box}}body{{margin:0;background:#173e37;color:#263e35;font:15px/1.8 system-ui,sans-serif}}main{{max-width:540px;margin:36px auto;padding:30px 24px;background:#f5f0e2;border:1px solid #baa36a;border-radius:8px}}h1{{font:700 25px/1.4 serif;color:#244a3a;margin:0 0 12px}}p{{margin:12px 0}}small{{color:#657461}}.download{{display:block;padding:16px;text-align:center;background:#275e46;color:#f8efce;border:1px solid #b5a871;border-radius:5px;text-decoration:none;font-weight:600;margin:22px 0}}a{{color:#3c7050}}code{{font-size:11px;overflow-wrap:anywhere}}.note{{padding:12px;background:#e5ebdc;border:1px solid #c5ceb5;border-radius:4px}}</style></head>
<body><main><small>王国之泪 · 随身探索助手</small><h1>海拉鲁探险手册</h1><p>三层离线地图、中文地名、装备耐久、阶段任务和防具升级备料。</p>
<p>地图优化：逐帧缩放、高清瓦片预取、加载时保留地形，地名和图标保持固定清晰尺寸。</p>
<a class="download" href="/{apk.name}" download>下载安卓离线 APK · {apk_record['bytes'] / 1024 / 1024:.1f} MiB</a>
<p><small>版本 {version} · Android 8.0 及以上</small></p><div class="note">手机连接同一局域网后下载。直接打开 APK 覆盖安装可保留记录，请保留原应用。首次安装如有提示，允许当前浏览器或文件管理器安装应用。安装后可以开启飞行模式使用。</div>
<p>已通过高分屏手机浏览器、完全断网、签名和包内资源校验；新版没有连接安卓设备复测，手势体验仍需真机确认。</p>
<p><a href="/安卓安装说明.md">安装与备份说明</a> · <a href="/package-manifest.json">包信息</a> · <a href="/SHA256SUMS.txt">文件校验</a></p>
<small>APK SHA-256</small><p><code>{apk_record['sha256']}</code></p></main></body></html>''', encoding="utf-8")
    for item in report["artifacts"]:
        print(f"Ready: releases/{item['file']} ({item['bytes'] / 1024 / 1024:.1f} MiB)", flush=True)


if __name__ == "__main__":
    main()
