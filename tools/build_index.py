#!/usr/bin/env python3
"""构建脚本：扫描精读卡 → 生成索引 → 组装 dist/ 部署目录。

1. 扫描 content/papers/<slug>/paper-card.md，解析 frontmatter 与精读卡 16 节结构
2. 生成 content/index.json（本地预览用）与 dist/content/index.json（部署用）
3. dist/ 只包含公开内容：
   - private: true        → 整篇排除，不进索引、不进部署目录
   - hide_sections: [N..] → 部署副本中剔除对应章节（如 16 研究设想）
   - source_bundle.json / audit-report.json 等本地溯源文件不进部署目录
用法：python tools/build_index.py
"""
from __future__ import annotations

import json
import re
import shutil
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAPERS_DIR = ROOT / "content" / "papers"
DIST = ROOT / "dist"
IMAGE_DIRS = ["figures", "rendered-pages", "si-rendered-pages"]
IMG_EXT = {".png", ".jpg", ".jpeg", ".webp", ".gif"}

FM_RE = re.compile(r"\A---\s*\n(.*?)\n---\s*\n?", re.S)
H1_RE = re.compile(r"^#\s+(.+)$", re.M)
SEC_RE = re.compile(r"^##\s+(\d{2})\s+(.+)$", re.M)
FIELD_RES = {
    "authors": re.compile(r"^\s*-\s*\*\*作者：?\*\*\s*(.+)$", re.M),
    "journal": re.compile(r"^\s*-\s*\*\*期刊：?\*\*\s*(.+)$", re.M),
    "keywords": re.compile(r"^\s*-\s*\*\*关键词：?\*\*\s*(.+)$", re.M),
}
DOI_RE = re.compile(r"(10\.\d{4,9}/[^\s\]\)），。；]+)")
CITE_LINK_RE = re.compile(r"\[([^\]]*)\]\([^)]*\)")


def parse_frontmatter(text: str):
    meta = {}
    m = FM_RE.match(text)
    if m:
        for line in m.group(1).splitlines():
            if ":" not in line:
                continue
            k, v = line.split(":", 1)
            k, v = k.strip(), v.strip()
            if v.startswith("[") and v.endswith("]"):
                v = [x.strip().strip("\"'") for x in v[1:-1].split(",") if x.strip()]
            elif v.lower() in ("true", "false"):
                v = v.lower() == "true"
            meta[k] = v
        text = text[m.end():]
    return meta, text


def strip_sections(text: str, hide_nums) -> str:
    for num in hide_nums:
        pattern = re.compile(rf"^##\s*{re.escape(num)}\s+.*?(?=^##\s|\Z)", re.M | re.S)
        text = pattern.sub("", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"


def section_bodies(body: str) -> dict:
    out = {}
    matches = list(SEC_RE.finditer(body))
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(body)
        out[m.group(1)] = body[m.end():end].strip()
    return out


def list_images(d: Path, sub: str):
    p = d / sub
    if not p.exists():
        return []
    return sorted(f.name for f in p.iterdir() if f.suffix.lower() in IMG_EXT and f.is_file())


def load_audit(d: Path) -> dict:
    p = d / "audit-report.json"
    if not p.exists():
        return {}
    try:
        a = json.loads(p.read_text(encoding="utf-8"))
        s = a.get("summary", {})
        return {
            "status": s.get("status"),
            "passes": s.get("passes"),
            "warnings": s.get("warnings"),
            "errors": s.get("errors"),
            "locator_mode": a.get("metrics", {}).get("locator_mode"),
        }
    except (json.JSONDecodeError, OSError):
        return {}


def collect_paper(d: Path) -> dict | None:
    card = d / "paper-card.md"
    if not d.is_dir() or not card.exists():
        return None
    meta, body = parse_frontmatter(card.read_text(encoding="utf-8"))
    if meta.get("private") is True:
        print(f"  [skip] {d.name}（private，不进索引与部署）")
        return None

    h1 = H1_RE.search(body)
    title = meta.get("title") or (
        re.sub(r"^精读卡[:：]\s*", "", h1.group(1)).strip() if h1 else d.name
    )

    authors = ""
    am = FIELD_RES["authors"].search(body)
    if am:
        authors = re.sub(r"<[^>]+>", "", am.group(1)).strip().rstrip("。.")

    citation, journal, year = "", "", ""
    jm = FIELD_RES["journal"].search(body)
    if jm:
        line = CITE_LINK_RE.sub(r"\1", jm.group(1)).replace("*", "").strip()
        citation = line
        em = re.match(r"\*?([^*，,；;]+)", line)
        journal = em.group(1).strip() if em else ""
        ym = re.search(r"(19|20)\d{2}", line)
        year = ym.group(0) if ym else ""

    kw = []
    km = FIELD_RES["keywords"].search(body)
    if km:
        kw = [k.strip() for k in re.split(r"[、，,;；]", km.group(1)) if k.strip()]

    doi = meta.get("doi") or ""
    if not doi:
        dm = DOI_RE.search(body)
        doi = dm.group(1) if dm else ""

    secs = [{"num": n, "title": t.strip()} for n, t in SEC_RE.findall(body)]
    s02 = section_bodies(body).get("02", "")
    summary = next((l.strip() for l in s02.splitlines() if l.strip()), "")
    summary = re.sub(r"\[(Paper|External|User|Analysis|Paper-framed)[^\]]*\]", "", summary).strip()

    tags = meta.get("tags", [])
    if isinstance(tags, str):
        tags = [t.strip() for t in re.split(r"[,，]", tags) if t.strip()]

    return {
        "slug": d.name,
        "title": title,
        "authors": authors,
        "citation": citation,
        "journal": journal,
        "year": year,
        "doi": doi,
        "keywords": kw,
        "tags": tags,
        "date": str(meta.get("date") or date.today().isoformat()),
        "summary": summary[:220],
        "sections": secs,
        "audit": load_audit(d),
        "figures": list_images(d, "figures"),
        "pages": {"main": list_images(d, "rendered-pages"), "si": list_images(d, "si-rendered-pages")},
    }


def build_dist(index: dict):
    if DIST.exists():
        shutil.rmtree(DIST)
    DIST.mkdir(parents=True)
    shutil.copy2(ROOT / "index.html", DIST / "index.html")
    shutil.copytree(ROOT / "assets", DIST / "assets")

    content_dist = DIST / "content"
    (content_dist / "papers").mkdir(parents=True)

    for d in sorted(p for p in PAPERS_DIR.iterdir() if p.is_dir()):
        card = d / "paper-card.md"
        if not card.exists():
            continue
        meta, body = parse_frontmatter(card.read_text(encoding="utf-8"))
        if meta.get("private") is True:
            continue
        hide = meta.get("hide_sections", [])
        if isinstance(hide, str):
            hide = [h.strip() for h in re.split(r"[,，\s]+", hide) if h.strip()]
        out = strip_sections(body, hide) if hide else body

        dest = content_dist / "papers" / d.name
        dest.mkdir(parents=True)
        (dest / "paper-card.md").write_text(out, encoding="utf-8")
        for sub in IMAGE_DIRS:
            if (d / sub).exists():
                shutil.copytree(d / sub, dest / sub)

    payload = json.dumps(index, ensure_ascii=False, indent=2)
    (content_dist / "index.json").write_text(payload, encoding="utf-8")
    (ROOT / "content" / "index.json").write_text(payload, encoding="utf-8")


def main() -> int:
    if not PAPERS_DIR.exists():
        print("未找到 content/papers/ 目录", file=sys.stderr)
        return 1
    papers = []
    for d in sorted(PAPERS_DIR.iterdir()):
        entry = collect_paper(d)
        if entry:
            papers.append(entry)
            print(f"  [ok] {entry['slug']}：{entry['title'][:50]}（{len(entry['sections'])} 节）")
    index = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "papers": papers,
    }
    build_dist(index)
    print(f"\n索引完成：{len(papers)} 篇 → content/index.json；部署目录 dist/ 已组装。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
