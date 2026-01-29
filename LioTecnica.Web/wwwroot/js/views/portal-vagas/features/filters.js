(function () {
  if (window.PortalVagasFilters) return;

  function normalize(str) {
    return (str || "").toString().trim().toLowerCase();
  }

  function parseNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function getFilters() {
    const q = normalize(document.getElementById("q").value);
    const location = document.getElementById("location").value.trim();
    const mode = document.getElementById("mode").value.trim();
    const type = document.getElementById("type").value.trim();
    const level = document.getElementById("level").value.trim();
    const area = document.getElementById("area").value.trim();
    const minSalary = parseNumber(document.getElementById("minSalary").value);

    return { q, location, mode, type, level, area, minSalary };
  }

  function buildQuery(page, currentSort) {
    const filters = getFilters();
    const params = new URLSearchParams();
    if (filters.q) params.set("q", filters.q);
    if (filters.location) params.set("location", filters.location);
    if (filters.mode) params.set("mode", filters.mode);
    if (filters.type) params.set("type", filters.type);
    if (filters.level) params.set("level", filters.level);
    if (filters.area) params.set("area", filters.area);
    if (filters.minSalary !== null) params.set("minSalary", filters.minSalary);
    params.set("sort", currentSort || "recent");
    params.set("page", page);
    params.set("pageSize", 100);
    return params.toString();
  }

  function init(options) {
    const {
      filtersForm,
      clearBtn,
      emptyClearBtn,
      searchBtn,
      searchClearBtn,
      setLoading,
      closeFiltersDrawer,
      resetPaging,
      resetFilters,
      loadJobs,
      setSort,
      getSort
    } = options || {};

    if (!filtersForm) return;

    filtersForm.addEventListener("submit", (ev) => {
      ev.preventDefault();
      try {
        setLoading?.(true);
        (async () => {
          resetPaging?.();
          await loadJobs?.(true);
          setLoading?.(false);
          closeFiltersDrawer?.();
        })();
      } catch (err) {
        setLoading?.(false);
        console.error(err);
      }
    });

    searchBtn?.addEventListener("click", () => {
      filtersForm.requestSubmit();
    });

    searchClearBtn?.addEventListener("click", () => {
      const qInput = document.getElementById("q");
      if (qInput) qInput.value = "";
      filtersForm.requestSubmit();
    });

    clearBtn?.addEventListener("click", () => {
      try {
        setLoading?.(true);
        (async () => {
          resetPaging?.();
          resetFilters?.();
          await loadJobs?.(true);
          setLoading?.(false);
          closeFiltersDrawer?.();
        })();
      } catch (err) {
        setLoading?.(false);
        console.error(err);
      }
    });

    emptyClearBtn?.addEventListener("click", () => clearBtn?.click());

    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-sort]");
      if (!btn) return;

      try {
        setSort?.(btn.getAttribute("data-sort"));
        setLoading?.(true);
        (async () => {
          resetPaging?.();
          await loadJobs?.(true);
          setLoading?.(false);
          closeFiltersDrawer?.();
        })();
      } catch (err) {
        setLoading?.(false);
        console.error(err);
      }
    });
  }

  window.PortalVagasFilters = { init, buildQuery };
})();
