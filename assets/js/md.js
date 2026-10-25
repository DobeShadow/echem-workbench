// Markdown 渲染与精读卡结构解析（基于 vendored marked，UMD 全局 marked）

/**
 * 渲染 Markdown 为 DOM 节点。
 * - 为 h2 章节标题生成锚点 id（sec-01 … sec-16 / sec-glossary）
 * - basePath：为相对路径图片补全前缀（SPA 内相对路径以站点根解析）
 * - 外链统一新窗口打开
 */
export function renderMarkdown(text, { basePath = "" } = {}) {
  let md = String(text || "");
  // 源文件可能带 YAML frontmatter（部署副本由构建脚本剥离），渲染前统一去掉
  const fm = md.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  if (fm) md = md.slice(fm[0].length);
  const html = marked.parse(md, { gfm: true });
  const div = document.createElement("div");
  div.className = "md";
  div.innerHTML = html;

  div.querySelectorAll("h2").forEach((h) => {
    const t = h.textContent.trim();
    const m = t.match(/^(\d{2})/);
    if (m) h.id = "sec-" + m[1];
    else if (t.includes("术语表")) h.id = "sec-glossary";
  });

  if (basePath) {
    div.querySelectorAll("img").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (src && !/^(https?:|data:|#|\/)/i.test(src)) img.src = basePath + src;
      img.loading = "lazy";
    });
  }
  div.querySelectorAll('a[href^="http"]').forEach((a) => {
    a.target = "_blank";
    a.rel = "noopener noreferrer";
  });
  return div;
}

/** 解析精读卡为有序章节列表 [{num:"01", title, body}]（术语表不计入） */
export function parseSections(text) {
  const lines = String(text || "").split(/\r?\n/);
  const sections = [];
  let cur = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(\d{2})\s+(.*)$/);
    if (m) {
      cur = { num: m[1], title: m[2].trim(), body: [] };
      sections.push(cur);
    } else if (cur) {
      cur.body.push(line);
    }
  }
  return sections.map((s) => ({ ...s, body: s.body.join("\n").trim() }));
}

export function sectionBody(sections, num) {
  const s = sections.find((x) => x.num === num);
  return s ? s.body : "";
}

/** 去掉 [Paper: …] / [External …] 等引证标记，得到干净正文（用于周报生成） */
export function stripCitations(text) {
  return String(text || "")
    .replace(/\[(Paper|External|User|Analysis|Paper-framed)[^\]]*\]/g, "")
    .replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 把题录行整理成周报用的「作者 题名 期刊 卷期页码 DOI」一行 */
export function citationLine(entry) {
  const parts = [];
  if (entry.authors) parts.push(entry.authors);
  if (entry.title) parts.push(entry.title);
  if (entry.citation) parts.push(entry.citation);
  if (entry.doi) parts.push("DOI: " + entry.doi);
  return parts.filter(Boolean).join(". ");
}
