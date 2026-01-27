(function () {
  if (window.PortalVagasUi) return;

  function init(options) {
    const { backToTopBtn } = options || {};
    if (!backToTopBtn) return;
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  window.PortalVagasUi = { init };
})();
