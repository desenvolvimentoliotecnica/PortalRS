(function () {
  if (window.PortalVagasIndexContext) return;

  const apiMeta = document.querySelector("meta[name='portal-api-base']");
  const tenantMeta = document.querySelector("meta[name='portal-tenant-id']");
  const tenantClaimMeta = document.querySelector("meta[name='portal-tenant-claim']");
  const adminMeta = document.querySelector("meta[name='portal-is-admin']");

  const apiBase = (window.__portalApiUrl || apiMeta?.content || "").replace(/\/$/, "");
  const tenantId = window.__portalTenantId
    || tenantMeta?.content
    || window.__portalTenantFromClaim
    || tenantClaimMeta?.content
    || new URLSearchParams(window.location.search).get("tenantId")
    || new URLSearchParams(window.location.search).get("tenant")
    || "";
  const isAdminUser = ((window.__portalIsAdmin || adminMeta?.content || "false")) === "true";

  const elAlert = document.getElementById("appAlert");
  const overlay = document.getElementById("loadingOverlay");

  function buildAuthHeaders() {
    return { "Accept": "application/json" };
  }

  function showAppAlert(type, message) {
    if (!elAlert) return;
    elAlert.className = "alert alert-" + type;
    elAlert.textContent = message;
    elAlert.classList.remove("d-none");
  }

  function clearAppAlert() {
    if (!elAlert) return;
    elAlert.textContent = "";
    elAlert.classList.add("d-none");
  }

  function setLoading(isLoading) {
    if (!overlay) return;
    overlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
  }


  window.PortalVagasIndexContext = {
    apiBase,
    tenantId,
    isAdminUser,
    elAlert,
    overlay,
    showAppAlert,
    clearAppAlert,
    setLoading,
    buildAuthHeaders
  };
})();
