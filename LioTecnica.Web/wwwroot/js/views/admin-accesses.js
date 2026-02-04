const state = {
  search: "",
  status: "all"
};

function setKpis() {
  const items = $$(".access-item");
  const total = items.length;
  const selected = items.filter(x => x.dataset.selected === "true").length;
  const roleCount = $("#accessRoleSelect")?.options?.length ? $("#accessRoleSelect").options.length - 1 : 0;
  const custom = items.filter(x => (x.dataset.text || "").includes("users.write")).length;

  $("#kpiAccessMenus").textContent = total;
  $("#kpiAccessSelected").textContent = selected;
  $("#kpiAccessRoles").textContent = Math.max(roleCount, 0);
  $("#kpiAccessCustom").textContent = custom;
}

function applyFilters() {
  const items = $$(".access-item");
  const q = (state.search || "").trim().toLowerCase();

  items.forEach(item => {
    const text = (item.dataset.text || "").toLowerCase();
    const selected = item.dataset.selected === "true";

    if (state.status === "selected" && !selected) {
      item.classList.add("d-none");
      return;
    }
    if (state.status === "unselected" && selected) {
      item.classList.add("d-none");
      return;
    }

    if (q && !text.includes(q)) {
      item.classList.add("d-none");
      return;
    }

    item.classList.remove("d-none");
  });
}

function updateSelected() {
  $$(".access-item").forEach(item => {
    const cb = item.querySelector(".access-check");
    item.dataset.selected = cb?.checked ? "true" : "false";
  });
  setKpis();
  applyFilters();
}

function wireSearch() {
  const input = $("#accessSearch");
  if (!input) return;
  input.addEventListener("input", () => {
    state.search = input.value || "";
    applyFilters();
  });

  const global = $("#globalSearchAccesses");
  if (global) {
    global.addEventListener("input", () => {
      input.value = global.value || "";
      state.search = global.value || "";
      applyFilters();
    });
  }
}

function wireStatus() {
  const sel = $("#accessStatus");
  if (!sel) return;
  sel.addEventListener("change", () => {
    state.status = sel.value;
    applyFilters();
  });
}

function wireSelectButtons() {
  const list = $("#accessList");
  const allBtn = $("#btnAccessSelectAll");
  const clearBtn = $("#btnAccessClear");
  const allInlineBtn = $("#btnAccessSelectAllInline");
  const clearInlineBtn = $("#btnAccessClearInline");

  const handleSelectAll = () => {
    $$(".access-check", list).forEach(cb => { cb.checked = true; });
    updateSelected();
  };
  const handleClearAll = () => {
    $$(".access-check", list).forEach(cb => { cb.checked = false; });
    updateSelected();
  };

  if (allBtn) allBtn.addEventListener("click", handleSelectAll);
  if (allInlineBtn) allInlineBtn.addEventListener("click", handleSelectAll);

  if (clearBtn) clearBtn.addEventListener("click", handleClearAll);
  if (clearInlineBtn) clearInlineBtn.addEventListener("click", handleClearAll);
}

function wireChecks() {
  const list = $("#accessList");
  if (!list) return;
  list.addEventListener("change", (event) => {
    if (!event.target.classList.contains("access-check")) return;
    updateSelected();
  });
}

function wireCardToggle() {
  const list = $("#accessList");
  if (!list) return;
  list.addEventListener("click", (event) => {
    const checkbox = event.target.closest(".access-check");
    if (checkbox) return;
    const card = event.target.closest(".access-card");
    if (!card) return;
    const cb = card.querySelector(".access-check");
    if (!cb) return;
    cb.checked = !cb.checked;
    updateSelected();
  });
  list.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".access-card");
    if (!card) return;
    event.preventDefault();
    const cb = card.querySelector(".access-check");
    if (!cb) return;
    cb.checked = !cb.checked;
    updateSelected();
  });
}

function wireClock() {
  const label = $("#nowLabel");
  if (!label) return;
  const tick = () => {
    const d = new Date();
    label.textContent = d.toLocaleString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };
  tick();
  setInterval(tick, 1000 * 15);
}

(function init() {
  setKpis();
  applyFilters();
  wireSearch();
  wireStatus();
  wireSelectButtons();
  wireChecks();
  wireCardToggle();
  wireClock();
})();
