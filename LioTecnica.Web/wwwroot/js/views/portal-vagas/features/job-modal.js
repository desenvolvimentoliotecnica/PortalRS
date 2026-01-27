(function () {
  if (window.PortalVagasJobModal) return;

  function init(options) {
    const {
      jobModal,
      jobModalApplyBtn,
      grid,
      buildSummary,
      formatMoney,
      onApply
    } = options || {};

    if (!jobModal || !grid) return;

    function openJobModal(item) {
      document.getElementById("jobModalLabel").textContent = item.dataset.title;
      document.getElementById("jobModalCompany").textContent = item.dataset.company;

      document.getElementById("jobModalMode").textContent = item.dataset.mode;
      document.getElementById("jobModalType").textContent = item.dataset.type;
      document.getElementById("jobModalLevel").textContent = item.dataset.level;
      document.getElementById("jobModalArea").textContent = item.dataset.area;

      document.getElementById("jobModalLocation").textContent = item.dataset.location;

      const min = Number(item.dataset.salaryMin) || 0;
      const max = Number(item.dataset.salaryMax) || 0;
      document.getElementById("jobModalSalary").textContent = max ? formatMoney(min, max) : "A combinar";

      const tagsWrap = document.getElementById("jobModalTags");
      tagsWrap.innerHTML = "";
      (item.dataset.tags || "")
        .split(",")
        .map(x => x.trim())
        .filter(Boolean)
        .forEach(tag => {
          const span = document.createElement("span");
          span.className = "badge text-bg-light border";
          span.textContent = tag;
          tagsWrap.appendChild(span);
        });

      document.getElementById("jobModalSummary").textContent = buildSummary(item);

      const ul = document.getElementById("jobModalResp");
      ul.innerHTML = "";
      [
        "Atuar em colaboração com times parceiros.",
        "Executar atividades alinhadas ao escopo da vaga.",
        "Cumprir prazos e padrões de qualidade definidos."
      ].forEach(r => {
        const li = document.createElement("li");
        li.textContent = r;
        ul.appendChild(li);
      });

      const anchor = document.getElementById("jobModalAnchor");
      anchor.href = "#" + item.dataset.id;

      jobModal.show();
      return item;
    }

    grid.addEventListener("click", (ev) => {
      const link = ev.target.closest("a.job-link");
      if (!link) return;
      ev.preventDefault();
      const jobItem = ev.target.closest(".job-item");
      if (!jobItem) return;
      const current = openJobModal(jobItem);
      if (options.onOpen) options.onOpen(current);
    });

    if (jobModalApplyBtn) {
      jobModalApplyBtn.addEventListener("click", () => {
        if (typeof onApply === "function") onApply();
      });
    }
  }

  window.PortalVagasJobModal = { init };
})();
