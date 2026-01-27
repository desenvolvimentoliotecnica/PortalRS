(() => {
  const g = window;

  g.$ = (sel, root = document) => root.querySelector(sel);
  g.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  g.clamp = (n, min, max) => Math.max(min, Math.min(max, n));

  g.uid = () => {
    if (g.crypto && g.crypto.randomUUID) return g.crypto.randomUUID();
    return "id-" + Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
  };

  g.escapeHtml = (str) => {
    return (str ?? "").toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  };

  const normalizeEnumCode = (code) => (code ?? "").toString().trim().toLowerCase();

  g.getEnumOptions = (key) => {
    const data = g.__enumData || {};
    const list = data[key];
    return Array.isArray(list) ? list : [];
  };

  g.getEnumText = (key, code, fallback = "") => {
    const list = g.getEnumOptions(key);
    const target = normalizeEnumCode(code);
    const opt = list.find(o => normalizeEnumCode(o.code) === target);
    return opt ? opt.text : (fallback || code || "");
  };

  g.buildOption = (code, text, selected = false) => {
    const opt = document.createElement("option");
    opt.value = code ?? "";
    opt.textContent = text ?? "";
    if (selected) opt.selected = true;
    return opt;
  };

  g.fillSelectFromEnum = (select, key, selectedCode) => {
    if (!select) return;
    select.replaceChildren();
    const list = g.getEnumOptions(key);
    const selectedKey = normalizeEnumCode(selectedCode);
    const hasSelected = selectedKey.length > 0;
    list.forEach(opt => {
      const isSelected = hasSelected && normalizeEnumCode(opt.code) === selectedKey;
      select.appendChild(g.buildOption(opt.code, opt.text, isSelected));
    });
  };

  g.applyEnumSelects = (root = document) => {
    g.$$(`select[data-enum]`, root).forEach(select => {
      const key = select.dataset.enum;
      if (!key) return;
      const selected = select.dataset.selected ?? select.value ?? "";
      g.fillSelectFromEnum(select, key, selected);
    });
  };

  g.ensureEnumData = async () => {
    if (g.__enumDataLoaded && g.__enumData) return g.__enumData;
    if (g.__enumDataPromise) return g.__enumDataPromise;
    const url = g.__enumsUrl || "/api/lookup/enums";
    g.__enumDataPromise = fetch(url, { headers: { "Accept": "application/json" }, credentials: "same-origin" })
      .then(res => {
        if (res.status === 401) {
          const returnUrl = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/Account/Login?returnUrl=${returnUrl}`;
          throw new Error("Unauthorized");
        }
        if (!res.ok) throw new Error(`Falha ao buscar enums: ${res.status}`);
        return res.json();
      })
      .then(data => {
        g.__enumData = data || {};
        g.__enumDataLoaded = true;
        g.applyEnumSelects();
        return g.__enumData;
      })
      .catch(err => {
        console.error("Falha ao carregar enums da API:", err);
        g.__enumData = g.__enumData || {};
        g.__enumDataLoaded = true;
        return g.__enumData;
      })
      .finally(() => {
        g.__enumDataPromise = null;
      });

    return g.__enumDataPromise;
  };

  g.cloneTemplate = (id) => {
    const tpl = document.getElementById(id);
    if (!tpl) return null;
    return tpl.content.firstElementChild.cloneNode(true);
  };

  g.cloneTemplateContent = (id) => {
    const tpl = document.getElementById(id);
    return tpl ? tpl.content.cloneNode(true) : document.createDocumentFragment();
  };

  g.bindText = (root, key, value, fallback = "") => {
    if (!root) return;
    const text = value ?? fallback;
    root.querySelectorAll(`[data-text="${key}"]`).forEach(el => {
      el.textContent = text;
    });
  };

  g.bindValue = (root, key, value) => {
    if (!root) return;
    root.querySelectorAll(`[data-value="${key}"]`).forEach(el => {
      el.value = value ?? "";
    });
  };

  g.toggleRole = (root, key, show) => {
    if (!root) return;
    root.querySelectorAll(`[data-role="${key}"]`).forEach(el => {
      el.classList.toggle("d-none", !show);
    });
  };

  g.fmtDate = (iso) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  g.initials = (name, fallback = "—") => {
    const parts = (name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return fallback;
    const a = parts[0][0] || "";
    const b = parts.length > 1 ? (parts[parts.length - 1][0] || "") : "";
    return (a + b).toUpperCase();
  };

  g.normalizeText = (s) => {
    return (s || "")
      .toString()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9#+\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  };

  g.toast = (msg, title = "Portal RH") => {
    const toastEl = document.getElementById("appToast");
    if (!toastEl || !g.bootstrap) return;
    const titleEl = document.getElementById("toastTitle");
    const whenEl = document.getElementById("toastTime") || document.getElementById("toastWhen");
    const msgEl = document.getElementById("toastBody") || document.getElementById("toastMsg");
    if (titleEl) titleEl.textContent = title || "Portal RH";
    if (msgEl) msgEl.textContent = msg ?? "";
    if (whenEl) whenEl.textContent = "agora";
    g.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: 2400 }).show();
  };

  g.setYear = () => {
    const yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", g.setYear, { once: true });
  } else {
    g.setYear();
  }
})();

(() => {
  const overlay = document.getElementById("globalLoading");
  if (!overlay) return;

  const MIN_DURATION = 750;
  const NAV_KEY = "lt_nav_start";
  let activeCount = 0;
  let shownAt = 0;
  let hideTimer = null;
  const hasSilentHeader = (input, init) => {
    if (init?.headers?.["X-LT-Silent"] || init?.headers?.["x-lt-silent"]) return true;
    if (input && typeof input !== "string" && input.headers) {
      return input.headers.get?.("X-LT-Silent") === "1";
    }
    return false;
  };

  const shouldTrack = (input, init) => {
    if (hasSilentHeader(input, init)) return false;
    const url = typeof input === "string" ? input : input?.url;
    if (!url) return true;
    return !url.includes("/api/health");
  };

  const setActive = (on) => {
    overlay.classList.toggle("active", on);
    overlay.setAttribute("aria-hidden", on ? "false" : "true");
  };

  const begin = (startAt) => {
    if (activeCount === 0) {
      shownAt = typeof startAt === "number" ? startAt : Date.now();
      setActive(true);
    }
    activeCount += 1;
    if (hideTimer) {
      clearTimeout(hideTimer);
      hideTimer = null;
    }
  };

  const end = () => {
    if (activeCount === 0) return;
    activeCount -= 1;
    if (activeCount > 0) return;
    const elapsed = Date.now() - shownAt;
    const remaining = Math.max(0, MIN_DURATION - elapsed);
    hideTimer = setTimeout(() => {
      if (activeCount === 0) setActive(false);
    }, remaining);
  };

  const navStart = Number(sessionStorage.getItem(NAV_KEY));
  if (!Number.isNaN(navStart) && navStart > 0) {
    sessionStorage.removeItem(NAV_KEY);
    begin(navStart);
  } else {
    begin(Date.now());
  }
  window.addEventListener("load", end);

  document.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;
    if (link.hasAttribute("download")) return;
    if (link.target && link.target !== "_self") return;
    const href = link.getAttribute("href");
    if (!href || href.startsWith("#") || href.startsWith("javascript:")) return;
    sessionStorage.setItem(NAV_KEY, String(Date.now()));
    begin();
  }, true);

  document.addEventListener("submit", (event) => {
    if (!(event.target instanceof HTMLFormElement)) return;
    sessionStorage.setItem(NAV_KEY, String(Date.now()));
    begin();
  }, true);

  if (window.fetch) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (...args) => {
      const input = args[0];
      let init = args[1] || {};
      const url = typeof input === "string" ? input : input?.url;
      if (url && url.startsWith(window.location.origin)) {
        const nextInit = { ...init, credentials: "include", mode: "same-origin" };
        if (input instanceof Request) {
          args[0] = new Request(input, nextInit);
        } else {
          args[1] = nextInit;
        }
      }
      const track = shouldTrack(args[0], args[1]);
      if (track) begin();
      return originalFetch(...args).then((res) => {
        if (track) end();
        return res;
      }).catch((err) => {
        if (track) end();
        throw err;
      });
    };
  }

  const originalOpen = XMLHttpRequest.prototype.open;
  const originalSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(...args) {
    const url = args[1];
    this._ltTrack = shouldTrack(url);
    return originalOpen.apply(this, args);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    if (this._ltTrack) {
      begin();
      this.addEventListener("loadend", end, { once: true });
    }
    return originalSend.apply(this, args);
  };

  window.LioTecnicaLoading = { begin, end };
})();

(() => {
  const STORAGE_KEY = "lt_sidebar_scroll";
  const STORAGE_KEY_MOBILE = "lt_sidebar_scroll_mobile";
  const desktopScroll = document.querySelector(".sidebar .sidebar-scroll");
  const mobileScroll = document.querySelector("#offcanvasSidebar .sidebar-scroll");

  const restoreScroll = (el, key) => {
    if (!el) return;
    const raw = sessionStorage.getItem(key);
    const value = raw ? Number(raw) : 0;
    if (!Number.isFinite(value) || value <= 0) return;
    requestAnimationFrame(() => {
      el.scrollTop = value;
    });
  };

  const bindScroll = (el, key) => {
    if (!el) return;
    el.addEventListener("scroll", () => {
      sessionStorage.setItem(key, String(el.scrollTop));
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      restoreScroll(desktopScroll, STORAGE_KEY);
      restoreScroll(mobileScroll, STORAGE_KEY_MOBILE);
      bindScroll(desktopScroll, STORAGE_KEY);
      bindScroll(mobileScroll, STORAGE_KEY_MOBILE);
    }, { once: true });
  } else {
    restoreScroll(desktopScroll, STORAGE_KEY);
    restoreScroll(mobileScroll, STORAGE_KEY_MOBILE);
    bindScroll(desktopScroll, STORAGE_KEY);
    bindScroll(mobileScroll, STORAGE_KEY_MOBILE);
  }
})();

(() => {
  const root = document.getElementById("footerHealth");
  if (!root) return;

  const apiDot = root.querySelector('[data-health="api"]');
  const dbDot = root.querySelector('[data-health="db"]');
  const url = window.__healthUrl || "/api/health";
  const statusClasses = ["status-ok", "status-warn", "status-down", "status-unknown"];

  const normalize = (value) => (value ?? "").toString().trim().toLowerCase();
  const mapStatus = (value) => {
    const text = normalize(value);
    if (text === "healthy") return "status-ok";
    if (text === "degraded") return "status-warn";
    if (text === "unhealthy") return "status-down";
    return "status-unknown";
  };

  const setDot = (dot, status, label) => {
    if (!dot) return;
    statusClasses.forEach(cls => dot.classList.remove(cls));
    dot.classList.add(status);
    if (label) dot.title = label;
  };

  const update = async () => {
    try {
      const res = await fetch(url, { headers: { "Accept": "application/json" }, credentials: "same-origin" });
      const data = await res.json().catch(() => null);
      if (!res.ok && !data) throw new Error(`health ${res.status}`);
      const apiStatus = data?.status ?? "unknown";
      setDot(apiDot, mapStatus(apiStatus), `API: ${apiStatus}`);

      const checks = Array.isArray(data?.checks) ? data.checks : [];
      const dbCheck = checks.find(c => normalize(c?.name) === "database");
      const dbStatus = dbCheck?.status ?? "unknown";
      setDot(dbDot, mapStatus(dbStatus), `DB: ${dbStatus}`);
    } catch (err) {
      setDot(apiDot, "status-down", "API: down");
      setDot(dbDot, "status-down", "DB: down");
    }
  };

  update();
  setInterval(update, 30000);
})();

(() => {
  const getCellValue = (row, index) => {
    const cell = row.children[index];
    if (!cell) return "";
    const value = cell.getAttribute("data-sort-value");
    if (value !== null) return value;
    return (cell.textContent || "").trim();
  };

  const isNumericColumn = (rows, index) => {
    return rows.every(row => {
      const value = getCellValue(row, index);
      if (!value) return true;
      const normalized = value.replace(/\./g, "").replace(",", ".");
      return !Number.isNaN(Number(normalized));
    });
  };

  const normalizeValue = (value, numeric) => {
    if (!numeric) return value.toLowerCase();
    if (!value) return Number.NEGATIVE_INFINITY;
    const normalized = value.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
  };

  const sortTable = (table, index, direction) => {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const rows = Array.from(tbody.rows);
    if (!rows.length) return;
    const numeric = isNumericColumn(rows, index);

    rows.sort((a, b) => {
      const av = normalizeValue(getCellValue(a, index), numeric);
      const bv = normalizeValue(getCellValue(b, index), numeric);
      if (numeric) return direction === "asc" ? av - bv : bv - av;
      return direction === "asc"
        ? av.localeCompare(bv, "pt-BR")
        : bv.localeCompare(av, "pt-BR");
    });

    tbody.replaceChildren(...rows);
  };

  const applySortState = (table, th, direction) => {
    table.querySelectorAll("th.sortable").forEach(cell => {
      cell.classList.remove("asc", "desc");
    });
    th.classList.add(direction);
  };

  const enableSort = (table) => {
    if (!table.tHead || !table.tBodies.length) return;
    const headers = Array.from(table.tHead.rows[0]?.cells || []);
    if (!headers.length) return;

    table.classList.add("table-sortable");
    headers.forEach((th, index) => {
      if (th.dataset.sort === "none") return;
      th.classList.add("sortable");
      th.addEventListener("click", () => {
        const current = th.classList.contains("asc") ? "asc" : th.classList.contains("desc") ? "desc" : null;
        const direction = current === "asc" ? "desc" : "asc";
        sortTable(table, index, direction);
        applySortState(table, th, direction);
      });
    });

    const runDefaultSort = () => {
      const first = headers.find(th => th.dataset.sort !== "none");
      if (!first) return;
      sortTable(table, headers.indexOf(first), "asc");
      applySortState(table, first, "asc");
    };

    const tbody = table.tBodies[0];
    if (tbody.rows.length) {
      runDefaultSort();
    } else {
      const observer = new MutationObserver(() => {
        if (tbody.rows.length) {
          runDefaultSort();
          observer.disconnect();
        }
      });
      observer.observe(tbody, { childList: true });
    }
  };

  const init = () => {
    document.querySelectorAll("table").forEach(enableSort);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();

(() => {
  const url = window.__notificationsUrl;
  if (!url) return;

  const badge = document.querySelector('[data-role="notif-count"]');
  const dropdownList = document.querySelector('[data-role="notif-dropdown-list"]');
  const pageList = document.querySelector('[data-role="notif-page-list"]');

  const levelToBadge = (level) => {
    const norm = (level || "").toString().toLowerCase();
    if (norm === "danger" || norm === "error" || norm === "critical") return "text-bg-danger";
    if (norm === "warning" || norm === "warn") return "text-bg-warning";
    if (norm === "success" || norm === "ok") return "text-bg-success";
    return "text-bg-primary";
  };

  const renderEmpty = (root, text) => {
    if (!root) return;
    const wrap = document.createElement("div");
    wrap.className = root === dropdownList
      ? "px-3 py-3 text-muted small"
      : "empty";
    wrap.textContent = text || "Sem notificacoes no momento.";
    root.replaceChildren(wrap);
  };

  const buildDropdownItem = (item) => {
    const a = document.createElement("a");
    a.className = "list-group-item list-group-item-action notif-item";
    a.href = item.url || "/Notificacoes";

    const title = item.title || "Notificacao";
    const msg = item.message || "";
    const when = window.fmtDate ? window.fmtDate(item.createdAt) : "";

    a.innerHTML = `
      <div class="d-flex justify-content-between">
        <div class="fw-semibold">${window.escapeHtml(title)}</div>
        <span class="text-muted small">${window.escapeHtml(when)}</span>
      </div>
      <div class="small text-muted">${window.escapeHtml(msg)}</div>
    `;
    return a;
  };

  const buildPageItem = (item) => {
    const a = document.createElement("a");
    a.className = "card-soft p-3 text-decoration-none";
    a.href = item.url || "/Notificacoes";

    const title = item.title || "Notificacao";
    const msg = item.message || "";
    const when = window.fmtDate ? window.fmtDate(item.createdAt) : "";
    const badgeClass = levelToBadge(item.level);

    a.innerHTML = `
      <div class="d-flex align-items-start justify-content-between gap-2">
        <div>
          <div class="fw-semibold">${window.escapeHtml(title)}</div>
          <div class="text-muted small">${window.escapeHtml(msg)}</div>
        </div>
        <span class="badge ${badgeClass}">${window.escapeHtml(when)}</span>
      </div>
    `;
    return a;
  };

  const updateBadge = (count) => {
    if (!badge) return;
    const value = Number(count || 0);
    badge.textContent = String(value);
    badge.classList.toggle("d-none", value <= 0);
  };

  const renderLists = (items) => {
    if (dropdownList) {
      if (!items.length) {
        renderEmpty(dropdownList, "Sem notificacoes recentes.");
      } else {
        dropdownList.replaceChildren(...items.slice(0, 5).map(buildDropdownItem));
      }
    }
    if (pageList) {
      if (!items.length) {
        renderEmpty(pageList, "Sem notificacoes no momento.");
      } else {
        pageList.replaceChildren(...items.map(buildPageItem));
      }
    }
  };

  const load = async () => {
    try {
      const res = await fetch(url, {
        headers: { "Accept": "application/json", "X-LT-Silent": "1" },
        credentials: "same-origin"
      });
      if (res.status === 401) return;
      if (!res.ok) throw new Error(`notifications ${res.status}`);
      const data = await res.json();
      const items = Array.isArray(data?.items) ? data.items : [];
      updateBadge(data?.unreadCount ?? items.length);
      renderLists(items);
    } catch (err) {
      renderLists([]);
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
