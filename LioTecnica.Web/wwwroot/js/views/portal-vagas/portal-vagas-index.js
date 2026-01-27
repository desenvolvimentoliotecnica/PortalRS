/**
         * IntenÃ§Ã£o:
         * - Candidatura completa, com validaÃ§Ã£o e upload opcional.
         * - Sem engolir erro: toda falha resulta em alerta visÃ­vel.
         * - MantÃ©m a seleÃ§Ã£o da vaga atual para preencher o modal de candidatura.
         */
        (async function () {
          const ctx = window.PortalVagasIndexContext || {};
          const apiBase = ctx.apiBase || "";
          const tenantId = ctx.tenantId || "";
          const grid = document.getElementById("jobsGrid");
          const gridLoading = document.getElementById("jobsLoading");
          const resultsCount = document.getElementById("resultsCount");
          const emptyState = document.getElementById("emptyState");

          const filtersForm = document.getElementById("filtersForm");
          const clearBtn = document.getElementById("clearBtn");
          const emptyClearBtn = document.getElementById("emptyClearBtn");
          const filtersDrawerEl = document.getElementById("filtersDrawer");
          const searchBtn = document.getElementById("searchBtn");
          const searchClearBtn = document.getElementById("searchClearBtn");
          const backToTopBtn = document.getElementById("backToTopBtn");

          const jobModalEl = document.getElementById("jobModal");
          const jobModal = new bootstrap.Modal(jobModalEl, { backdrop: true, keyboard: true });

          const jobModalApplyBtn = document.getElementById("jobModalApplyBtn");

          let currentSort = "recent";
          const pageSize = 100;
          let totalItems = 0;

          // MantÃ©m a vaga atual selecionada (para candidatura)
          let currentJob = null;

          const jobsUi = window.PortalVagasJobs || {};
          const showAppAlert = ctx.showAppAlert || function () {};
          const setLoading = ctx.setLoading || function () {};

          function setGridLoading(isLoading) {
            if (!gridLoading) return;
            gridLoading.classList.toggle("d-none", !isLoading);
          }
          function closeFiltersDrawer() {
            if (!filtersDrawerEl) return;
            const instance = bootstrap.Offcanvas.getInstance(filtersDrawerEl)
              || new bootstrap.Offcanvas(filtersDrawerEl);
            instance.hide();
          }

          function formatMoney(min, max) {
            if (jobsUi?.formatMoney) return jobsUi.formatMoney(min, max);
            return "";
          }

          function buildJobCard(job, index) {
            if (jobsUi?.buildJobCard) return jobsUi.buildJobCard(job, index);
            return document.createElement("div");
          }

          function getSectionInfo(area) {
            if (jobsUi?.getSectionInfo) return jobsUi.getSectionInfo(area);
            return {
              title: area || "Outras oportunidades",
              image: ""
            };
          }

          function buildSection(info, jobs, startIndex) {
            if (jobsUi?.buildSection) return jobsUi.buildSection(info, jobs, startIndex);
            return document.createElement("section");
          }

          async function loadJobs(reset = false) {
            if (!window.PortalVagasJobsData?.loadJobs) return;
            await window.PortalVagasJobsData.loadJobs({
              apiBase,
              tenantId,
              showAppAlert,
              setGridLoading,
              grid,
              gridLoading,
              buildSection,
              getSectionInfo,
              buildQuery,
              render,
              reset
            });
            if (window.PortalVagasJobsData?._state) {
              totalItems = window.PortalVagasJobsData._state.totalItems ?? totalItems;
            }
          }

          function buildQuery(page) {
            if (window.PortalVagasFilters?.buildQuery) {
              return window.PortalVagasFilters.buildQuery(page, currentSort);
            }
            const params = new URLSearchParams();
            params.set("page", page);
            params.set("pageSize", pageSize);
            return params.toString();
          }


          function render(filters) {
            const state = window.PortalVagasJobsData?.getState?.() || {};
            totalItems = state.totalItems ?? totalItems;
            if (jobsUi?.renderResults) {
              jobsUi.renderResults(resultsCount, emptyState, totalItems);
              return;
            }
            if (resultsCount) resultsCount.textContent = String(totalItems);
            if (emptyState) emptyState.classList.toggle("d-none", totalItems !== 0);
          }

          function resetFilters() {
            filtersForm.reset();
            currentSort = "recent";
          }

          function resetPaging() {
            window.PortalVagasJobsData?.setState?.({ currentPage: 1, totalPages: 1, totalItems: 0 });
          }

          window.PortalVagasJobModal?.init({
            jobModal,
            jobModalApplyBtn,
            grid,
            buildSummary: jobsUi?.buildSummary || ((item) => item.dataset.title || ""),
            formatMoney,
            onApply: async () => {
              if (!currentJob) {
            showAppAlert("danger", S.index.applyInitFail);
                return;
              }
              if (window.PortalVagasApply?.open) {
                await window.PortalVagasApply.open(
                  currentJob,
                  `${currentJob.dataset.title} â€¢ ${currentJob.dataset.company} â€¢ ${currentJob.dataset.mode}`
                );
              }
            },
            onOpen: (item) => {
              currentJob = item;
              if (ctx) ctx.currentJob = item;
            }
          });

          window.PortalVagasFilters?.init({
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
            setSort: (value) => { currentSort = value; }
          });

          // Render inicial
          try {
            await loadJobs(true);
            window.PortalVagasAdminNewJob?.init(loadJobs);
            window.PortalVagasApply?.init(ctx);
          } catch (err) {
            console.error(err);
            showAppAlert("danger", "Ocorreu um erro ao carregar a pÃ¡gina. Recarregue e tente novamente.");
          }
        })();
    

