// 站点配置：研究方向、快捷入口等。修改后 push 即自动生效。
window.WB_CONFIG = {
  siteName: "电催化工作台",
  userName: "DobeShadow",
  tagline: "Electrocatalysis Synthesis Workbench",
  // 研究方向卡片（仪表盘展示）
  directions: [
    { name: "CO₂ 电还原", detail: "Cu 基 / 单原子合金催化剂，C₁/C₂ 产物选择性", color: "#2563eb" },
    { name: "乙炔电还原半加氢", detail: "C₂H₂ → C₂H₄ 选择性与法拉第效率", color: "#0891b2" },
    { name: "气相扩散电极", detail: "气体扩散层、三相界面与传质", color: "#7c3aed" },
    { name: "碱性 HER/HOR", detail: "阳离子效应、双电层与 OH⁻ 传输", color: "#d97706" }
  ],
  // 快捷入口
  quickLinks: [
    { label: "Google Scholar", url: "https://scholar.google.com/" },
    { label: "Web of Science", url: "https://www.webofscience.com/" },
    { label: "Zotero 网页版", url: "https://www.zotero.org/" },
    { label: "echemdb 文献电化学数据库", url: "https://www.echemdb.org/" },
    { label: "本站 GitHub 仓库", url: "https://github.com/DobeShadow/echem-workbench" }
  ]
};
