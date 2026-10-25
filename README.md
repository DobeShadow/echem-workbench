# 电催化工作台（Electrocatalysis Workbench）

面向电催化合成方向研究生的个人科研工作台，纯静态站点，部署于 GitHub Pages：
**https://dobeshadow.github.io/echem-workbench/**

## 功能

| 模块 | 说明 | 数据位置 |
|---|---|---|
| 🏠 仪表盘 | 渐变 Hero、研究方向、统计、待读队列、最近文献/实验 | — |
| 📚 精读卡库 | 浏览/搜索精读卡（16 节结构、术语表、原文页图片、审计徽章） | 仓库（公开） |
| 🔖 文献速录 | 粘贴 DOI 自动抓取题录（Crossref），待读/在读/已读管理、优先级、笔记 | 浏览器 IndexedDB |
| 🧫 实验记录 | 合成实验结构化记录（模板快速填充、图片附件、关联文献 DOI） | 浏览器 IndexedDB |
| 📈 数据绘图 | 上传 CV/LSV/FE 数据 CSV/TXT，多曲线叠加、对数轴、导出 PNG | 浏览器 IndexedDB |
| 🧮 计算工具 | RHE 换算、过电位 η、法拉第效率 FE（含气体体积换算）、ECSA | 即算即用 |
| 🗂️ 看板与想法 | 待办/进行中/已完成看板 + memos 式想法捕捉 | 浏览器 IndexedDB |
| 📝 周报生成 | 按课题组周报模板自动汇总本周精读+泛读+实验+任务，生成 Markdown | 浏览器 |
| ⚙️ 设置 | 一键导出/导入 JSON 备份、清空数据 | 浏览器 |

## 数据与隐私边界

- **实验数据、任务、想法等未发表内容只存在你的浏览器本地（IndexedDB），永不写入公开仓库。**
  清理浏览器数据会丢失，请定期在「设置 → 导出全部数据」备份 JSON 文件（建议每周随周报一起导出）。
- 精读卡内容是**公开**的。如某篇不想公开，见下节 private 标记。

## 添加精读卡

1. 在 `content/papers/` 下新建一个 slug 目录（如 `cu-single-atom-co2rr/`）：
   ```
   content/papers/cu-single-atom-co2rr/
   ├── paper-card.md      # 精读卡（16 节模板）
   ├── audit-report.json  # 可选，审计报告（不部署，仅索引用）
   ├── figures/           # 可选，文献图片
   ├── rendered-pages/    # 可选，主文原文页
   └── si-rendered-pages/ # 可选，SI 原文页
   ```
2. 可在 `paper-card.md` 顶部加 frontmatter（可选）：
   ```yaml
   ---
   date: "2026-10-25"        # 收录日期（缺省用构建日）
   tags: [CO₂RR, 单原子]      # 标签（缺省用 01 节关键词）
   private: true             # 整篇不上线（索引与部署目录均排除）
   hide_sections: [16]       # 部署副本剔除第 16 节（如研究设想）
   ---
   ```
   > 注意：`private` 只保证不出现在网站上；源文件若已 push 到公开仓库，在 GitHub
   > 代码页仍可见。需要彻底保密的笔记请保存在本地，不要提交到本仓库。
3. push 到 main，GitHub Actions 自动构建索引并部署（约 1 分钟）。

标题/作者/期刊/DOI/关键词/一句话概括等信息会自动从卡片的 H1 标题与「01 基本信息」「02 一句话概括」章节解析。

## 本地开发预览

```bash
cd workbench
python tools/build_index.py     # 生成 content/index.json 与 dist/
python -m http.server 8080      # 浏览 http://localhost:8080 （源目录预览）
```
注意必须通过 HTTP 访问（浏览器对 file:// 限制 fetch）。`dist/` 是部署产物（已 gitignore）。

## 技术说明

- 纯静态无构建：原生 ES Modules + 手写 CSS，无 npm 依赖；Chart.js 与 marked 本地内置于 `assets/vendor/`（均为 MIT 许可，随附 LICENSE）。
- 部署：`.github/workflows/deploy.yml` 在每次 push 到 main 时运行 `tools/build_index.py` 组装 `dist/` 并通过官方 Pages 工作流发布。
- 配置（研究方向卡片、快捷入口）：编辑 `assets/config.js`。
- 设计借鉴了 al-folio、grad-research-workbench、memos、ElectroChem 等开源项目的思路，代码为本项目原创。

## 目录结构

```
workbench/
├── index.html              # SPA 入口
├── assets/
│   ├── config.js           # 站点配置（研究方向、快捷入口）
│   ├── css/main.css
│   ├── js/                 # 路由、IndexedDB 封装、markdown 渲染、各视图
│   └── vendor/             # Chart.js、marked（内置）
├── content/
│   ├── index.json          # 构建产物（自动生成，随 push 更新）
│   └── papers/<slug>/      # 精读卡内容
├── tools/build_index.py    # 构建脚本
└── .github/workflows/deploy.yml
```
