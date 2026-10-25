// 计算工具：电催化日常计算器（RHE 换算 / 过电位 / 法拉第效率 / ECSA）
// 全部为标准电化学公式，纯本地计算。

import { esc, icon, toast } from "../util.js";

const num = (v) => {
  const x = parseFloat(v);
  return isFinite(x) ? x : NaN;
};
const fmt = (x, d = 3) => (isFinite(x) ? x.toFixed(d) : "—");

export async function render(el) {
  el.innerHTML = `
    <div class="page page-wide">
      <div class="page-head">
        <h1>电化学计算工具</h1>
        <p class="muted">日常数据处理常用换算，输入即时计算（25 °C），数据不上传</p>
      </div>
      <div class="tool-grid">

        <!-- 1. 参比电极 → RHE -->
        <section class="card tool-card" id="toolRhe">
          <div class="tool-head">
            <span class="tool-ico">${icon("link")}</span>
            <div><b>参比电极 → RHE 电位换算</b><small>E(RHE) = E(ref) + E°(ref) + 0.0591 × pH</small></div>
          </div>
          <div class="tool-form">
            <div><label>参比电极类型</label>
              <select class="input" data-t="ref">
                <option value="0.197">Ag/AgCl（饱和 KCl），+0.197 V</option>
                <option value="0.210">Ag/AgCl（3 M KCl），+0.210 V</option>
                <option value="0.241">SCE（饱和甘汞），+0.241 V</option>
                <option value="0.098">Hg/HgO（1 M KOH），+0.098 V</option>
                <option value="custom">自定义参比电位…</option>
              </select>
            </div>
            <div><label>自定义偏移（V vs. SHE）</label><input class="input" data-t="custom" type="number" step="0.001" placeholder="仅自定义时生效" disabled></div>
            <div><label>实测电位 E vs. 参比（V）</label><input class="input" data-t="eref" type="number" step="0.001" placeholder="例：-0.65"></div>
            <div><label>电解液 pH</label><input class="input" data-t="ph" type="number" step="0.1" value="13"></div>
            <div class="tool-result" data-t="out">—</div>
            <p class="tool-hint">Nernst 斜率按 25 °C 取 0.0591 V/pH；Hg/HgO 电位随 KOH 浓度略有差异，建议以实验室实测校准值为准。</p>
          </div>
        </section>

        <!-- 2. 过电位 -->
        <section class="card tool-card" id="toolEta">
          <div class="tool-head">
            <span class="tool-ico">${icon("zap")}</span>
            <div><b>过电位 η</b><small>η = E(RHE) − E<sub>eq</sub></small></div>
          </div>
          <div class="tool-form">
            <div><label>电位 E vs. RHE（V）</label><input class="input" data-t="e" type="number" step="0.001" placeholder="例：1.52"></div>
            <div><label>反应</label>
              <select class="input" data-t="rxn">
                <option value="0">HER，E_eq = 0.000 V vs. RHE</option>
                <option value="1.23">OER，E_eq = 1.230 V vs. RHE</option>
                <option value="custom">自定义平衡电位…</option>
              </select>
            </div>
            <div><label>自定义 E_eq（V vs. RHE）</label><input class="input" data-t="custom" type="number" step="0.001" placeholder="仅自定义时生效" disabled></div>
            <div class="tool-result" data-t="out">—</div>
            <p class="tool-hint">约定 η = E − E<sub>eq</sub>：OER（阳极）取正值，HER（阴极）常为负值，比较活性时通常报告 |η|，如 η₁₀（10 mA cm⁻² 下的过电位）。</p>
          </div>
        </section>

        <!-- 3. 法拉第效率 -->
        <section class="card tool-card" id="toolFe">
          <div class="tool-head">
            <span class="tool-ico">${icon("chart")}</span>
            <div><b>法拉第效率 FE</b><small>FE = z·F·n / Q × 100%</small></div>
          </div>
          <div class="tool-form">
            <div><label>电子转移数 z</label><input class="input" data-t="z" type="number" step="1" placeholder="例：CO 取 2"></div>
            <div><label>产物量 n（μmol）</label><input class="input" data-t="n" type="number" step="0.01" placeholder="例：12.5"></div>
            <div><label>通过电量 Q（C）</label><input class="input" data-t="q" type="number" step="0.01" placeholder="例：96.5"></div>
            <div><label>或由电流×时间算 Q</label>
              <div class="form-row">
                <input class="input" data-t="i" type="number" step="0.1" placeholder="电流 mA">
                <input class="input" data-t="t" type="number" step="0.01" placeholder="时间 h">
              </div>
            </div>
            <div><label>气体体积换算（25 °C，1 atm）</label>
              <div class="form-row">
                <input class="input" data-t="v" type="number" step="0.01" placeholder="体积 mL">
                <button class="btn" data-t="vfill" type="button">换算并填入 n</button>
              </div>
            </div>
            <div class="tool-result" data-t="out">—</div>
            <p class="tool-hint">Q = I × t（1 mA × 1 h = 3.6 C）；1 mL 理想气体（25 °C）≈ 40.9 μmol。z 常见取值：CO / HCOO⁻ 取 2，CH₄ 取 8，C₂H₄ 取 12，H₂ 取 2。</p>
          </div>
        </section>

        <!-- 4. ECSA -->
        <section class="card tool-card" id="toolEcsa">
          <div class="tool-head">
            <span class="tool-ico">${icon("db")}</span>
            <div><b>ECSA 电化学活性面积</b><small>ECSA = C<sub>dl</sub> / C<sub>s</sub></small></div>
          </div>
          <div class="tool-form">
            <div><label>双电层电容 C<sub>dl</sub>（mF）</label><input class="input" data-t="cdl" type="number" step="0.001" placeholder="例：0.85"></div>
            <div><label>比电容 C<sub>s</sub>（mF cm⁻²）</label><input class="input" data-t="cs" type="number" step="0.001" value="0.040"></div>
            <div><label>电极几何面积 A<sub>geo</sub>（cm²）</label><input class="input" data-t="a" type="number" step="0.001" placeholder="例：0.196"></div>
            <div class="tool-result" data-t="out">—</div>
            <p class="tool-hint">C<sub>s</sub> 一般取 0.040 mF cm⁻²（1 M KOH 中的常用估计值，不同文献取 0.020–0.060，需保持组内一致）；粗糙度 RF = ECSA / A<sub>geo</sub>。</p>
          </div>
        </section>

      </div>
    </div>`;

  // —— 事件绑定：直接绑到每个输入框，输入即时计算 ——
  const rhe = el.querySelector("#toolRhe");
  const eta = el.querySelector("#toolEta");
  const fe = el.querySelector("#toolFe");
  const ecsa = el.querySelector("#toolEcsa");
  const bind = (toolId, calc) => {
    const card = el.querySelector("#" + toolId);
    card.querySelectorAll("input,select").forEach((inp) => inp.addEventListener("input", calc));
    calc();
  };

  // 1. RHE 换算
  bind("toolRhe", () => {
    const get = (t) => rhe.querySelector(`[data-t="${t}"]`);
    const refSel = get("ref");
    get("custom").disabled = refSel.value !== "custom";
    const offset = refSel.value === "custom" ? num(get("custom").value) : parseFloat(refSel.value);
    const e = num(get("eref").value), ph = num(get("ph").value);
    const out = get("out");
    if (!isFinite(e) || !isFinite(ph) || !isFinite(offset)) { out.innerHTML = "—"; return; }
    const erhe = e + offset + 0.0591 * ph;
    out.innerHTML = `E vs. RHE = ${fmt(erhe)} V<small>= ${fmt(e)} V vs. 参比 + ${fmt(offset)} V + 0.0591 × ${fmt(ph, 1)}（pH）</small>`;
  });

  // 2. 过电位
  bind("toolEta", () => {
    const get = (t) => eta.querySelector(`[data-t="${t}"]`);
    const sel = get("rxn");
    get("custom").disabled = sel.value !== "custom";
    const eeq = sel.value === "custom" ? num(get("custom").value) : parseFloat(sel.value);
    const e = num(get("e").value);
    const out = get("out");
    if (!isFinite(e) || !isFinite(eeq)) { out.innerHTML = "—"; return; }
    const etaV = e - eeq;
    out.innerHTML = `η = ${fmt(etaV)} V（${fmt(etaV * 1000, 0)} mV）<small>E(RHE) ${fmt(e)} V − E<sub>eq</sub> ${fmt(eeq)} V ｜ |η| = ${fmt(Math.abs(etaV) * 1000, 0)} mV</small>`;
  });

  // 3. 法拉第效率
  const F = 96485;
  const feCalc = () => {
    const get = (t) => fe.querySelector(`[data-t="${t}"]`);
    const z = num(get("z").value);
    const n = num(get("n").value);         // μmol
    let q = num(get("q").value);           // C
    const i = num(get("i").value), t = num(get("t").value);
    const qFromIT = isFinite(i) && isFinite(t) ? (i * t * 3.6) : NaN;
    if (!isFinite(q) && isFinite(qFromIT)) {
      q = qFromIT;
      get("q").placeholder = `由 I×t ≈ ${q.toFixed(2)} C`;
    }
    const out = get("out");
    if (!isFinite(z) || !isFinite(n) || !isFinite(q) || q <= 0) { out.innerHTML = "—"; return; }
    const nMol = n * 1e-6;
    const chargeUsed = z * F * nMol;
    const eff = (chargeUsed / q) * 100;
    out.innerHTML = `FE = ${fmt(eff, 1)} %<small>产物耗电 ${fmt(chargeUsed, 2)} C / 总电量 ${fmt(q, 2)} C${isFinite(qFromIT) ? `（Q = ${fmt(i)} mA × ${fmt(t)} h × 3.6）` : ""}</small>`;
  };
  bind("toolFe", feCalc);
  fe.querySelector('[data-t="vfill"]').addEventListener("click", () => {
    const v = num(fe.querySelector('[data-t="v"]').value);
    if (!isFinite(v)) { toast("请先填写气体体积 mL", "warn"); return; }
    fe.querySelector('[data-t="n"]').value = ((v / 24.465) * 1000).toFixed(1);
    feCalc();
    toast("已按 25 °C 理想气体换算填入");
  });

  // 4. ECSA
  bind("toolEcsa", () => {
    const get = (t) => ecsa.querySelector(`[data-t="${t}"]`);
    const cdl = num(get("cdl").value), cs = num(get("cs").value), a = num(get("a").value);
    const out = get("out");
    if (!isFinite(cdl) || !isFinite(cs) || cs <= 0) { out.innerHTML = "—"; return; }
    const ecsaVal = cdl / cs;
    const rf = isFinite(a) && a > 0 ? ecsaVal / a : NaN;
    out.innerHTML = `ECSA = ${fmt(ecsaVal, 2)} cm²${isFinite(rf) ? ` ｜ 粗糙度 RF = ${fmt(rf, 1)}` : ""}<small>C<sub>dl</sub> ${fmt(cdl)} mF ÷ C<sub>s</sub> ${fmt(cs)} mF cm⁻²${isFinite(rf) ? `，几何面积 ${fmt(a)} cm²` : ""}</small>`;
  });
}
