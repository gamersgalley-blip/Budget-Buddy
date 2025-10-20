/* ============================================================
   Saavr App v3.6 - Core Logic
   Author: Bradley Allen Ebbert II
   ============================================================ */

/************ STORAGE KEYS & GLOBAL STATE ************/
const STORAGE = {
  cats: "saavr_v3_4_categories",
  income: "saavr_v3_4_income",
  login: "saavr_v3_4_login",
  tx: "saavr_v3_4_transactions",
  month: "saavr_v3_4_month"
};

const PRESETS = [
  { name: "Food & Dining", color: "#6EE7B7" },
  { name: "Rent / Mortgage", color: "#60A5FA" },
  { name: "Transportation", color: "#FBBF24" },
  { name: "Utilities", color: "#F87171" },
  { name: "Subscriptions", color: "#C084FC" },
  { name: "Health & Fitness", color: "#34D399" },
  { name: "Work / Education", color: "#A78BFA" },
  { name: "Entertainment", color: "#F472B6" },
  { name: "Shopping", color: "#FACC15" },
  { name: "Savings", color: "#4ADE80" },
];

const INCOME_COLOR = "#50C3A3"; // Mint green for deposits

let categories = [];
let transactions = [];
let incomes = [];
let selectedMonth = "";
let editingId = null;

/************ HELPERS ************/
const $ = s => document.querySelector(s);
const uid = () => Math.random().toString(36).slice(2, 9);
const pad2 = n => String(n).padStart(2, "0");

function ymFromDateStr(d) { return d ? d.slice(0, 7) : ""; }
function getCurrentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function income() { return Number(localStorage.getItem(STORAGE.income) || 0); }

function mixMuted(hex, alpha) {
  const bg = { r: 42, g: 50, b: 55 };
  const c = parseInt(hex.replace("#", ""), 16);
  const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
  return `rgb(${Math.round(r * alpha + bg.r * (1 - alpha))}, ${Math.round(g * alpha + bg.g * (1 - alpha))}, ${Math.round(b * alpha + bg.b * (1 - alpha))})`;
}

function monthLabel(ym) {
  if (!ym) return "";
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString(undefined, { month: "long", year: "numeric" });
}

function formatLongDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

/************ INITIAL LOAD & SAVE ************/
function load() {
  try { categories = JSON.parse(localStorage.getItem(STORAGE.cats) || "[]"); } catch { categories = []; }
  try { transactions = JSON.parse(localStorage.getItem(STORAGE.tx) || "[]"); } catch { transactions = []; }
  try { incomes = JSON.parse(localStorage.getItem("saavr_v3_4_incomes") || "[]"); } catch { incomes = []; }
  selectedMonth = getCurrentYM();
  localStorage.setItem(STORAGE.month, selectedMonth);
}

function save() {
  localStorage.setItem(STORAGE.cats, JSON.stringify(categories));
  localStorage.setItem(STORAGE.tx, JSON.stringify(transactions));
  renderAll();
}

/************ FILTERS & TOTALS ************/
function txForMonth(ym) { return transactions.filter(t => ymFromDateStr(t.date) === ym); }
function actualByCategory(catId, ym) { return txForMonth(ym).filter(t => t.categoryId === catId).reduce((s, t) => s + (Number(t.amount) || 0), 0); }
function totalActual(ym) { return categories.reduce((s, c) => s + actualByCategory(c.id, ym), 0); }
function totalReceivedIncome(ym) { return txForMonth(ym).filter(t => t.categoryId === "income").reduce((s, t) => s + (Number(t.amount) || 0), 0); }
function totalBudget() { return categories.reduce((s, c) => s + (Number(c.budget) || 0), 0); }

/************ LOGIN & NAVIGATION ************/
function initLogin() {
  const loginSection = $("#login");
  const dashSection = $("#dashboard");

  if (sessionStorage.getItem(STORAGE.login) === "1") {
    loginSection.classList.add("hidden");
    dashSection.classList.remove("hidden");
  }

  $("#login-btn").addEventListener("click", () => {
    const u = $("#u").value.trim(), p = $("#p").value.trim();
    if (u === "admin" && p === "1234") {
      sessionStorage.setItem(STORAGE.login, "1");
      showPage("dashboard");
      $("#login-err").classList.add("hidden");
    } else {
      $("#login-err").classList.remove("hidden");
    }
  });
}

function showPage(id) {
  ["login", "dashboard", "budget", "accounts"].forEach(pid => {
    const s = document.getElementById(pid);
    if (!s) return;
    pid === id ? s.classList.remove("hidden") : s.classList.add("hidden");
  });

  document.querySelectorAll("nav").forEach(nav => {
    nav.querySelectorAll("button").forEach(btn => {
      const match = btn.getAttribute("onclick")?.includes(id);
      btn.classList.toggle("active", match);
    });
  });

  const dm = $("#dash-month");
  if (dm) dm.textContent = " — " + monthLabel(selectedMonth);

  if (id === "budget") {
    selectedMonth = getCurrentYM();
    localStorage.setItem(STORAGE.month, selectedMonth);
    updateMonthDisplay();
    renderIncomeProgress();
  }

  drawDonuts();
  renderDashboardProgress();
  renderBudgetProgress();
  renderTxList();
}

/************ MONTH PICKER ************/
function changeMonth(offset) {
  const [y, m] = selectedMonth.split("-").map(Number);
  const newDate = new Date(y, m - 1 + offset, 1);
  const newYM = `${newDate.getFullYear()}-${pad2(newDate.getMonth() + 1)}`;
  if (newYM > getCurrentYM()) return; // block future
  selectedMonth = newYM;
  localStorage.setItem(STORAGE.month, selectedMonth);
  updateMonthDisplay();
  renderAll();
}

function updateMonthDisplay() {
  const md = $("#month-display");
  if (md) md.textContent = monthLabel(selectedMonth);
  const nextBtn = $("#next-month");
  if (nextBtn) nextBtn.disabled = selectedMonth >= getCurrentYM();
}

/************ CATEGORY MANAGEMENT ************/
function addCategory() {
  const msg = $("#add-error");
  msg.classList.add("hidden");

  const name = $("#cat-select").value;
  const budget = Number($("#cat-amount").value);
  const inc = Number(localStorage.getItem(STORAGE.income) || 0);

  if (!name || !(budget > 0)) return showError(msg, "Choose a category and enter a positive budget.");
  if (!(inc > 0)) return showError(msg, "Please set your monthly income first.");

  const totalBudget = categories.reduce((s, c) => s + (Number(c.budget) || 0), 0);
  if (totalBudget + budget > inc)
    return showError(msg, `Total budget exceeds your monthly income of $${inc.toLocaleString()}.`);

  const p = PRESETS.find(p => p.name === name) || PRESETS[0];
  const existing = categories.find(c => c.name === name);
  existing ? (existing.budget = budget, existing.color = p.color)
           : categories.push({ id: uid(), name, budget, color: p.color });

  $("#cat-amount").value = "";
  save();
}

function showError(el, msg) { el.textContent = msg; el.classList.remove("hidden"); }
function clearAll() { if (confirm("Remove all categories and transactions?")) { categories = []; transactions = []; save(); } }

/************ TRANSACTIONS ************/
function openTxModal() {
  $("#tx-name").value = "";
  $("#tx-amount").value = "";
  const today = new Date();
  $("#tx-date").value = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;
  populateTxCategoryDropdown();
  $("#tx-modal").classList.remove("hidden");
}

function closeTxModal() { $("#tx-modal").classList.add("hidden"); }

function saveTx() {
  const name = $("#tx-name").value.trim();
  const amt = Number($("#tx-amount").value);
  const d = $("#tx-date").value;
  const cat = $("#tx-category").value || "";
  if (!name || !(amt > 0) || !d) return alert("Enter a name, positive amount, and date.");
  transactions.push({ id: uid(), name, amount: amt, categoryId: cat || null, date: d });
  closeTxModal();
  save();
  renderIncomeProgress();
}

function populateTxCategoryDropdown() {
  const sel = $("#tx-category");
  if (!sel) return;
  sel.innerHTML = "";
  const opts = [
    { value: "", text: "Uncategorized" },
    { value: "income", text: "Income (Deposit)" },
    ...categories.map(c => ({ value: c.id, text: c.name }))
  ];
  opts.forEach(o => {
    const opt = document.createElement("option");
    opt.value = o.value; opt.textContent = o.text;
    sel.appendChild(opt);
  });
}

function renderTxList() {
  const list = $("#tx-list"), empty = $("#no-tx");
  if (!list) return;
  list.innerHTML = "";
  if (!transactions.length) return empty?.classList.remove("hidden");
  empty?.classList.add("hidden");

  transactions.forEach(t => {
    const row = document.createElement("div");
    row.className = "cat-item";

    let catLabel = "Uncategorized", color = "#3c464c";
    if (t.categoryId === "income") { catLabel = "Income (Deposit)"; color = INCOME_COLOR; }
    else {
      const cat = categories.find(c => c.id === t.categoryId);
      if (cat) { catLabel = `Category: ${cat.name}`; color = cat.color; }
    }

    const sw = Object.assign(document.createElement("div"), { className: "swatch", style: `background:${color}` });
    const mid = document.createElement("div");
    mid.innerHTML = `<div class="cat-name">${t.name}</div><div style="color:var(--muted);font-size:12px;">${catLabel} • ${formatLongDate(t.date)}</div>`;

    const right = document.createElement("div");
    right.innerHTML = `<div class="cat-amount">$${(t.amount || 0).toLocaleString()}</div>`;
    const sel = document.createElement("select");
    const del = Object.assign(document.createElement("button"), { className: "btn ghost small", textContent: "🗑️ Delete" });
    del.onclick = () => deleteTx(t.id);

    populateTxCategoryDropdown();
    sel.value = t.categoryId || "";
    sel.onchange = e => setTxCategory(t.id, e.target.value);

    const actions = document.createElement("div");
    actions.className = "cat-actions";
    actions.append(sel, del);
    right.appendChild(actions);

    row.append(sw, mid, right);
    list.appendChild(row);
  });
}

function setTxCategory(id, catId) {
  transactions = transactions.map(t => t.id === id ? { ...t, categoryId: catId || null } : t);
  save();
}
function deleteTx(id) { transactions = transactions.filter(t => t.id !== id); save(); }

/************ INCOME SOURCES ************/
function openIncomeModal() {
  $("#income-name").value = "";
  $("#income-amount").value = "";
  $("#income-modal").classList.remove("hidden");
}
function closeIncomeModal() { $("#income-modal").classList.add("hidden"); }

function saveIncome() {
  const name = $("#income-name").value.trim();
  const amt = Number($("#income-amount").value);
  if (!name || !(amt > 0)) return alert("Enter a name and positive amount.");
  incomes.push({ id: uid(), name, amount: amt });
  localStorage.setItem("saavr_v3_4_incomes", JSON.stringify(incomes));
  closeIncomeModal();
  renderTotalIncome(); renderIncomeProgress();
}

function renderTotalIncome() {
  const total = incomes.reduce((s, i) => s + (Number(i.amount) || 0), 0);
  $("#income-total").textContent = `$${total.toLocaleString()}`;
  localStorage.setItem(STORAGE.income, total);
  drawDonuts(); renderDashboardProgress(); renderBudgetProgress();
}

function renderIncomeProgress() {
  const target = income(), received = totalReceivedIncome(selectedMonth);
  const bar = $("#income-progress"), lbl = $("#income-progress-label");
  if (target <= 0) {
    bar.style.width = "0%"; bar.style.opacity = "0.35";
    lbl.textContent = "Set your monthly income to track progress"; return;
  }
  const pct = Math.min(100, Math.round((received / target) * 100));
  bar.style.width = pct + "%"; bar.style.background = "var(--mint)"; bar.style.opacity = "1";
  lbl.textContent = `${pct}% of income received ($${received.toLocaleString()} / $${target.toLocaleString()})`;
}

/************ DONUT & PROGRESS ************/
function drawDonuts() {
  const currentYM = getCurrentYM();
  drawDonutForMonth("dash-donut", "dash-center", currentYM);
  drawDonutForMonth("budget-donut", "budget-center", selectedMonth);
}

function drawDonutForMonth(svgId, centerId, ym) {
  const svg = document.getElementById(svgId), center = document.getElementById(centerId);
  while (svg.firstChild) svg.removeChild(svg.firstChild);
  const cx = 130, cy = 130, r = 100, stroke = 30;
  let inc = income(), safeInc = inc > 0 ? inc : 1;
  const spent = totalActual(ym), rem = inc - spent;
  center.textContent = `$${Math.round(rem).toLocaleString()}`;
  center.classList.toggle("center-positive", rem >= 0);
  center.classList.toggle("center-negative", rem < 0);

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  bg.setAttribute("cx", cx); bg.setAttribute("cy", cy); bg.setAttribute("r", r);
  bg.setAttribute("fill", "none"); bg.setAttribute("stroke", "var(--ringbg)");
  bg.setAttribute("stroke-width", stroke); svg.appendChild(bg);

  let angle = 0;
  categories.forEach(c => {
    const share = (Number(c.budget) || 0) / safeInc;
    if (share <= 0) return;
    const start = angle * 360, end = (angle + share) * 360;
    const base = document.createElementNS("http://www.w3.org/2000/svg", "path");
    base.setAttribute("d", arcPath(cx, cy, r, start, end));
    base.setAttribute("stroke", mixMuted(c.color, 0.4));
    base.setAttribute("stroke-width", stroke);
    base.setAttribute("fill", "none");
    svg.appendChild(base);
    angle += share;
  });

  if (angle < 1) {
    const remPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
    remPath.setAttribute("d", arcPath(cx, cy, r, angle * 360, 360));
    remPath.setAttribute("stroke", "#2F3940");
    remPath.setAttribute("stroke-width", stroke);
    remPath.setAttribute("fill", "none");
    svg.appendChild(remPath);
  }
}

function polarToXY(cx, cy, r, a) {
  const rad = (a - 90) * Math.PI / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function arcPath(cx, cy, r, start, end) {
  const p1 = polarToXY(cx, cy, r, end), p2 = polarToXY(cx, cy, r, start);
  const large = end - start <= 180 ? 0 : 1;
  return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 0 ${p2.x} ${p2.y}`;
}

/************ XP SYSTEM ************/
let xp = 350, level = 1, xpForNext = 500;
function renderXP() {
  const bar = $("#xp-bar"), lbl = $("#xp-label"), lvl = $("#user-level");
  const pct = Math.min(100, Math.round((xp / xpForNext) * 100));
  bar.style.width = pct + "%"; lbl.textContent = `${xp} / ${xpForNext} XP`; lvl.textContent = level;
}

/************ SETTINGS DROPDOWN ************/
function initSettingsDropdown() {
  const btn = $("#settings-btn"), menu = $("#settings-dropdown");
  if (!btn || !menu) return;
  btn.addEventListener("click", e => { e.stopPropagation(); menu.classList.toggle("hidden"); });
  document.addEventListener("click", e => { if (!menu.contains(e.target) && e.target !== btn) menu.classList.add("hidden"); });
}

/************ APPEARANCE PANEL ************/
function initAppearancePanel() {
  const openBtn = $("#open-appearance"), backBtn = $("#back-to-main");
  const mainPanel = $("#main-settings"), appearancePanel = $("#appearance-panel");
  const choices = document.querySelectorAll(".theme-choice");

  if (!openBtn || !backBtn) return;
  openBtn.onclick = () => { mainPanel.classList.add("hidden"); appearancePanel.classList.remove("hidden"); };
  backBtn.onclick = () => { appearancePanel.classList.add("hidden"); mainPanel.classList.remove("hidden"); };

  choices.forEach(choice => {
    choice.onclick = () => {
      const theme = choice.dataset.theme;
      applyTheme(theme);
      localStorage.setItem("saavr_theme", theme);
      updateThemeCheckmark(theme);
    };
  });

  const saved = localStorage.getItem("saavr_theme") || "dark";
  applyTheme(saved); updateThemeCheckmark(saved);
}

function applyTheme(mode) {
  document.body.classList.toggle("light-mode", mode === "light");
}

function updateThemeCheckmark(theme) {
  document.querySelectorAll(".theme-choice .checkmark").forEach(c => c.classList.add("hidden"));
  document.querySelector(`.theme-choice[data-theme="${theme}"] .checkmark`)?.classList.remove("hidden");
}

/************ RENDER ALL ************/
function renderAll() {
  const addSel = $("#cat-select");
  if (addSel) {
    addSel.innerHTML = "";
    PRESETS.forEach(p => {
      const o = document.createElement("option");
      o.value = p.name; o.textContent = p.name;
      addSel.appendChild(o);
    });
  }
  renderXP(); renderTxList(); drawDonuts(); renderDashboardProgress(); renderBudgetProgress(); renderIncomeProgress();
}

/************ PROGRESS BARS ************/
function renderDashboardProgress() {
  const inc = income(), spent = totalActual(selectedMonth);
  const pct = inc > 0 ? Math.min(100, Math.round((spent / inc) * 100)) : 0;
  const bar = $("#dash-progress"), lbl = $("#dash-progress-label");
  bar.style.width = pct + "%"; bar.classList.toggle("danger", spent > inc);
  lbl.textContent = `$${spent.toLocaleString()} / $${inc.toLocaleString()} spent`;
}

function renderBudgetProgress() {
  const inc = income(), spent = totalActual(selectedMonth);
  const pct = inc > 0 ? Math.min(100, Math.round((spent / inc) * 100)) : 0;
  const bar = $("#budget-progress"), lbl = $("#budget-progress-label");
  bar.style.width = pct + "%"; bar.classList.toggle("danger", spent > inc);
  lbl.textContent = `$${spent.toLocaleString()} / $${inc.toLocaleString()} spent`;
}

/************ INIT ************/
window.addEventListener("DOMContentLoaded", () => {
  load(); initLogin(); initSettingsDropdown(); initAppearancePanel();
  $("#add-income-btn")?.addEventListener("click", openIncomeModal);
  $("#add-cat")?.addEventListener("click", addCategory);
  $("#prev-month")?.addEventListener("click", () => changeMonth(-1));
  $("#next-month")?.addEventListener("click", () => changeMonth(1));
  updateMonthDisplay();
  sessionStorage.getItem(STORAGE.login) === "1" ? showPage("dashboard") : showPage("login");
  renderAll();
});
