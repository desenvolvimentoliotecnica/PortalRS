(function () {
    "use strict";

    const API_MINE = "/Feedback/_api/items/mine";
    const API_ALL = "/Feedback/_api/items/all";
    const PAGE_SIZE = 20;
    let pageReceived = 1;
    let pageSent = 1;
    let pageAll = 1;
    let totalReceived = 0;
    let totalSent = 0;
    let totalAll = 0;

    const listReceived = document.getElementById("listReceived");
    const emptyReceived = document.getElementById("emptyReceived");
    const loadMoreReceived = document.getElementById("loadMoreReceived");
    const btnLoadMoreReceived = document.getElementById("btnLoadMoreReceived");
    const listSent = document.getElementById("listSent");
    const emptySent = document.getElementById("emptySent");
    const loadMoreSent = document.getElementById("loadMoreSent");
    const btnLoadMoreSent = document.getElementById("btnLoadMoreSent");
    const listAll = document.getElementById("listAll");
    const emptyAll = document.getElementById("emptyAll");
    const loadMoreAll = document.getElementById("loadMoreAll");
    const btnLoadMoreAll = document.getElementById("btnLoadMoreAll");
    const btnRefresh = document.getElementById("btnRefresh");

    async function apiGet(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.json();
    }

    function escapeHtml(s) {
        if (!s) return "";
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
    }

    function formatDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    function renderRow(item) {
        return `
            <div class="border-bottom pb-2 mb-2">
                <div class="d-flex justify-content-between align-items-start">
                    <div>
                        <span class="fw-semibold">${escapeHtml(item.fromUserFullName || "")}</span>
                        <span class="text-muted"> → </span>
                        <span class="fw-semibold">${escapeHtml(item.toUserFullName || "")}</span>
                        ${item.tipo ? `<span class="badge bg-secondary ms-1">${escapeHtml(item.tipo)}</span>` : ""}
                    </div>
                    <span class="text-muted small">${formatDate(item.createdAtUtc)}</span>
                </div>
                <div class="mt-1 text-break">${escapeHtml(item.content || "")}</div>
            </div>`;
    }

    async function loadReceived(append) {
        if (!append) {
            pageReceived = 1;
            if (listReceived) listReceived.innerHTML = "";
            if (emptyReceived) emptyReceived.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_MINE}?filter=received&page=${pageReceived}&pageSize=${PAGE_SIZE}`);
            totalReceived = data.totalCount || 0;
            (data.items || []).forEach(item => {
                if (listReceived) listReceived.insertAdjacentHTML("beforeend", renderRow(item));
            });
            if (!append && totalReceived === 0 && emptyReceived) emptyReceived.classList.remove("d-none");
            if (loadMoreReceived) loadMoreReceived.classList.toggle("d-none", pageReceived * PAGE_SIZE >= totalReceived);
        } catch (e) {
            console.error(e);
            if (listReceived && !append) listReceived.innerHTML = "<div class=\"text-danger\">Erro ao carregar.</div>";
        }
    }

    async function loadSent(append) {
        if (!append) {
            pageSent = 1;
            if (listSent) listSent.innerHTML = "";
            if (emptySent) emptySent.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_MINE}?filter=sent&page=${pageSent}&pageSize=${PAGE_SIZE}`);
            totalSent = data.totalCount || 0;
            (data.items || []).forEach(item => {
                if (listSent) listSent.insertAdjacentHTML("beforeend", renderRow(item));
            });
            if (!append && totalSent === 0 && emptySent) emptySent.classList.remove("d-none");
            if (loadMoreSent) loadMoreSent.classList.toggle("d-none", pageSent * PAGE_SIZE >= totalSent);
        } catch (e) {
            console.error(e);
            if (listSent && !append) listSent.innerHTML = "<div class=\"text-danger\">Erro ao carregar.</div>";
        }
    }

    async function loadAll(append) {
        if (!append) {
            pageAll = 1;
            if (listAll) listAll.innerHTML = "";
            if (emptyAll) emptyAll.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_ALL}?page=${pageAll}&pageSize=${PAGE_SIZE}`);
            totalAll = data.totalCount || 0;
            (data.items || []).forEach(item => {
                if (listAll) listAll.insertAdjacentHTML("beforeend", renderRow(item));
            });
            if (!append && totalAll === 0 && emptyAll) emptyAll.classList.remove("d-none");
            if (loadMoreAll) loadMoreAll.classList.toggle("d-none", pageAll * PAGE_SIZE >= totalAll);
        } catch (e) {
            console.error(e);
            if (listAll && !append) listAll.innerHTML = "<div class=\"text-danger\">Erro ao carregar. Verifique permissão.</div>";
        }
    }

    if (btnLoadMoreReceived) btnLoadMoreReceived.addEventListener("click", function () { pageReceived++; loadReceived(true); });
    if (btnLoadMoreSent) btnLoadMoreSent.addEventListener("click", function () { pageSent++; loadSent(true); });
    if (btnLoadMoreAll) btnLoadMoreAll.addEventListener("click", function () { pageAll++; loadAll(true); });
    if (btnRefresh) btnRefresh.addEventListener("click", function () { loadReceived(false); loadSent(false); loadAll(false); });

    document.getElementById("tab-received")?.addEventListener("shown.bs.tab", () => { if (pageReceived === 1 && listReceived && listReceived.children.length === 0) loadReceived(false); });
    document.getElementById("tab-sent")?.addEventListener("shown.bs.tab", () => { if (pageSent === 1 && listSent && listSent.children.length === 0) loadSent(false); });
    document.getElementById("tab-all")?.addEventListener("shown.bs.tab", () => { if (pageAll === 1 && listAll && listAll.children.length === 0) loadAll(false); });

    loadReceived(false);
})();
