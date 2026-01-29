(function () {
  if (window.PortalVagasJobsData) return;
  const S = window.PortalVagasStrings;

  const state = {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    isLoading: false
  };

  async function loadJobs(options) {
    const {
      apiBase,
      tenantId,
      showAppAlert,
      setGridLoading,
      grid,
      gridLoading,
      buildSection,
      getSectionInfo,
      buildQuery,
      render
    } = options || {};

    if (!apiBase) {
      showAppAlert?.("danger", S.jobs.loadFail);
      setGridLoading?.(false);
      if (grid) grid.replaceChildren();
      return;
    }
    if (!tenantId) {
      showAppAlert?.("danger", S.apply.tenantMissing);
      setGridLoading?.(false);
      if (grid) grid.replaceChildren();
      return;
    }
    if (state.isLoading) return;

    const reset = options.reset === true;

    if (reset) {
      state.currentPage = 1;
      state.totalPages = 1;
      state.totalItems = 0;
      if (gridLoading && grid) {
        grid.replaceChildren(gridLoading);
      } else if (grid) {
        grid.replaceChildren();
      }
    }

    state.isLoading = true;
    setGridLoading?.(true);

    try {
      const query = buildQuery(state.currentPage);
      const url = `${apiBase}/api/public/vagas?tenantId=${encodeURIComponent(tenantId)}&${query}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();

      const items = Array.isArray(data.items) ? data.items : [];
      state.totalItems = data.total ?? items.length;
      state.totalPages = data.totalPages ?? 1;

      const groups = new Map();
      items.forEach(job => {
        const key = (job.area || S.jobs.areaFallback).toString();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(job);
      });

      if (grid) grid.replaceChildren();
      let offset = 0;
      groups.forEach((jobs, area) => {
        const info = getSectionInfo(area || S.jobs.areaFallback);
        const section = buildSection(info, jobs, offset);
        offset += jobs.length;
        if (grid) grid.appendChild(section);
      });

      render?.();
    } catch (err) {
      console.error(err);
      showAppAlert?.("danger", S.jobs.loadFailGeneric);
    } finally {
      setGridLoading?.(false);
      state.isLoading = false;
    }
  }

  function getState() {
    return { ...state };
  }

  function setState(next) {
    if (!next) return;
    if (typeof next.currentPage === "number") state.currentPage = next.currentPage;
    if (typeof next.totalPages === "number") state.totalPages = next.totalPages;
    if (typeof next.totalItems === "number") state.totalItems = next.totalItems;
    if (typeof next.isLoading === "boolean") state.isLoading = next.isLoading;
  }

  window.PortalVagasJobsData = { loadJobs, getState, setState, _state: state };
})();
