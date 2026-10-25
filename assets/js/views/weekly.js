// 周报生成：按课题组周报模板（一~七节）自动汇总本周文献/实验/任务/想法

import { S, nav } from "../state.js";
import { all } from "../store.js";
import { parseSections, sectionBody, stripCitations, citationLine } from "../md.js";
import { esc, weekRange, thisMondayISO, inRange, fmtDate, todayISO, copyText, download, toast, dateISO } from "../util.js";

const LS_KEY = (week) => "wb-weekly-" + week;

export async function render(el, ctx) {
  const weekStart = normalizeMonday(ctx.params.get("week") || thisMondayISO());
  const range = weekRange(weekStart);

  const papers = (S.index ? S.index.papers : []).filter((p) => inRange(p.date, range));
  const exps = (await all("experiments")).filter((x) => inRange(x.date, range) || inRange(x.updatedAt, range));
  const tasksDone = (await all("tasks")).filter((t) => t.status === "done" && inRange(t.doneAt, range));
  const tasksOpen = (await all("tasks")).filter((t) => t.status !== "done");
  const ideas = (await all("ideas")).filter((i) => inRange(i.createdAt, range));
  if (ctx.seq !== nav.seq) return;

  const draft = JSON.parse(localStorage.getItem(LS_KEY(weekStart)) || "{}");
  const picked = draft.picked || papers.map((p) => p.slug);
  const focus = draft.focus || (papers[0] ? papers[0].slug : "");

  el.innerHTML = `
    <div class="page">
      <div class="page-head"><h1>周报生成</h1>
        <p class="muted">统计周期：${fmtDate(weekStart)} ~ ${fmtDate(dateISO(range.end))} · 模板对应《研究生文献阅读周报》一~七节</p></div>

      <div class="toolbar">
        <button id="weekPrev" class="btn">← 上一周</button>
        <input id="weekPick" class="input" type="date" value="${esc(weekStart)}">
        <button id="weekNext" class="btn">下一周 →</button>
      </div>

      <div class="grid-2">
        <section class="card">
          <h2>二 · 本周阅读概览</h2>
          <p class="small">阅读 <b>${papers.length}</b> 篇（精读 <b>${papers.length}</b>）· 实验 <b>${exps.length}</b> 条 · 完成任务 <b>${tasksDone.length}</b> 项 · 新想法 <b>${ideas.length}</b> 条</p>
          <label>本周关键词</label>
          <input id="wKeywords" class="input" value="${esc(draft.keywords || "")}" placeholder="例：CO₂RR，Cu 单原子，FE 选择性">
        </section>
        <section class="card">
          <h2>三 · 文献清单（勾选纳入周报）</h2>
          <div id="wPapers" class="checklist">
            ${papers.length ? papers.map((p) => `
              <label class="check-item">
                <input type="checkbox" data-slug="${esc(p.slug)}" ${picked.includes(p.slug) ? "checked" : ""}>
                <span class="small">${esc(p.title)}<br><span class="muted">${esc(p.journal || "")} ${esc(p.year || "")}</span></span>
              </label>`).join("") : '<p class="muted small">本周暂无新收录精读卡</p>'}
          </div>
          <label>重点精读文献</label>
          <select id="wFocus" class="input">
            ${papers.length ? papers.map((p) => `<option value="${esc(p.slug)}" ${focus === p.slug ? "selected" : ""}>${esc(p.title.slice(0, 60))}</option>`).join("") : "<option>（本周无精读卡）</option>"}
          </select>
        </section>
      </div>

      <section class="card">
        <h2>六 · 本周综合思考</h2>
        <div class="form-row form-row-2">
          <div><label>形成的认识</label><textarea id="wInsight" class="input" rows="2">${esc(draft.insight || "")}</textarea></div>
          <div><label>与课题的联系</label><textarea id="wLink" class="input" rows="2">${esc(draft.link || "")}</textarea></div>
        </div>
        <div class="form-row form-row-2">
          <div><label>可借鉴内容（方法/表征/写作）</label><textarea id="wBorrow" class="input" rows="2">${esc(draft.borrow || "")}</textarea></div>
          <div><label>下周阅读主题与目标文献</label><textarea id="wNextRead" class="input" rows="2">${esc(draft.nextRead || "")}</textarea></div>
        </div>
        <label>重点文献「选择理由」</label>
        <textarea id="wReason" class="input" rows="2" placeholder="为什么这篇值得精读？与本课题（如 CO₂RR 选择性 / 扩散电极）的关系">${esc(draft.reason || "")}</textarea>
      </section>

      <div class="toolbar">
        <button id="wGenerate" class="btn btn-primary">⚡ 生成周报 Markdown</button>
        <button id="wCopy" class="btn">复制</button>
        <button id="wDownload" class="btn">下载 .md</button>
      </div>
      <section class="card">
        <textarea id="wOut" class="input mono" rows="22" placeholder="点「生成周报」后，这里会出现按模板组织好的周报，可直接修改后复制。"></textarea>
      </section>
    </div>`;

  const $ = (id) => el.querySelector(id);
  const collectDraft = () => ({
    keywords: $("#wKeywords").value,
    picked: [...el.querySelectorAll("#wPapers input:checked")].map((i) => i.dataset.slug),
    focus: $("#wFocus").value,
    insight: $("#wInsight").value, link: $("#wLink").value,
    borrow: $("#wBorrow").value, nextRead: $("#wNextRead").value,
    reason: $("#wReason").value,
  });
  const saveDraft = () => localStorage.setItem(LS_KEY(weekStart), JSON.stringify(collectDraft()));
  ["wKeywords", "wInsight", "wLink", "wBorrow", "wNextRead", "wReason"].forEach((id) =>
    $("#" + id).addEventListener("change", saveDraft));
  $("#wFocus").addEventListener("change", saveDraft);

  const jump = (w) => { location.hash = "#/weekly?week=" + w; };
  $("#weekPrev").addEventListener("click", () => jump(shiftWeek(weekStart, -7)));
  $("#weekNext").addEventListener("click", () => jump(shiftWeek(weekStart, 7)));
  $("#weekPick").addEventListener("change", (e) => jump(normalizeMonday(e.target.value)));

  $("#wGenerate").addEventListener("click", async () => {
    saveDraft();
    const d = collectDraft();
    const chosen = papers.filter((p) => d.picked.includes(p.slug));
    const focusEntry = papers.find((p) => p.slug === d.focus) || chosen[0];

    const lines = [];
    lines.push(`# 研究生文献阅读周报`);
    lines.push("");
    lines.push(`- **统计周期：** ${fmtDate(weekStart)} 至 ${fmtDate(dateISO(range.end))}`);
    lines.push(`- **提交日期：** ${todayISO()}`);
    lines.push(`- **阅读篇数：** ${chosen.length} 篇（精读 ${chosen.length} 篇）`);
    lines.push(`- **本周关键词：** ${d.keywords || "（待填）"}`);
    lines.push("");
    lines.push(`## 三、文献清单`);
    lines.push("");
    if (chosen.length) {
      lines.push(`| 序号 | 完整题录 | 类型 | 阅读程度 |`);
      lines.push(`|---|---|---|---|`);
      chosen.forEach((p, i) => {
        lines.push(`| ${i + 1} | ${citationLine(p)} | 论文 | 精读 |`);
      });
    } else lines.push("（本周无）");
    lines.push("");

    if (focusEntry) {
      lines.push(`## 四、重点文献精读`);
      lines.push("");
      lines.push(`**完整题录：** ${citationLine(focusEntry)}`);
      lines.push("");
      lines.push(`**选择理由：** ${d.reason || "（待填）"}`);
      lines.push("");
      try {
        const r = await fetch(`content/papers/${focusEntry.slug}/paper-card.md`);
        const secs = parseSections(await r.text());
        const putSection = (label, num) => {
          const body = stripCitations(sectionBody(secs, num));
          lines.push(`**${label}：** ${body || "（精读卡中未记录）"}`, "");
        };
        putSection("研究问题", "03");
        putSection("核心概念与思想", "06");
        putSection("研究方法", "07");
        putSection("主要发现与结论", "11");
        putSection("证据对应", "10");
        putSection("局限与边界（作者承认的局限）", "12");
        putSection("批判性分析", "13");
        putSection("可迁移知识", "14");
      } catch {
        lines.push("（精读卡内容加载失败，请通过 HTTP 访问）", "");
      }
    }

    lines.push(`## 五、实验进展`);
    lines.push("");
    lines.push(exps.length ? exps.map((x) =>
      `- **${x.title || "未命名"}**（${fmtDate(x.date)}，${x.status || ""}）：${(x.performance || x.conclusion || "进行中").split("\n")[0]}`).join("\n") : "（本周无实验记录）");
    lines.push("");

    lines.push(`## 六、本周综合思考`);
    lines.push("");
    lines.push(`- **形成的认识：** ${d.insight || "（待填）"}`);
    lines.push(`- **与课题的联系：** ${d.link || "（待填）"}`);
    lines.push(`- **可借鉴内容：** ${d.borrow || "（待填）"}`);
    if (ideas.length) lines.push(`- **本周新想法：** ${ideas.map((i) => i.text.slice(0, 60)).join("；")}`);
    lines.push("");

    lines.push(`## 七、下周计划`);
    lines.push("");
    if (d.nextRead) lines.push(`- **阅读主题与目标文献：** ${d.nextRead}`);
    lines.push(tasksOpen.length
      ? tasksOpen.slice(0, 10).map((t) => `- [ ] ${t.title}`).join("\n")
      : "- [ ] （从看板添加下周任务）");
    lines.push("");
    $("#wOut").value = lines.join("\n");
    toast("周报已生成，可直接编辑后复制");
  });

  $("#wCopy").addEventListener("click", async () => {
    const text = $("#wOut").value;
    if (!text) { toast("请先生成周报", "warn"); return; }
    await copyText(text);
    toast("已复制到剪贴板");
  });
  $("#wDownload").addEventListener("click", () => {
    const text = $("#wOut").value;
    if (!text) { toast("请先生成周报", "warn"); return; }
    download(`文献阅读周报_${weekStart}.md`, text, "text/markdown;charset=utf-8");
  });
}

function normalizeMonday(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d)) return thisMondayISO();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dateISO(d);
}

function shiftWeek(iso, days) {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return dateISO(d);
}
