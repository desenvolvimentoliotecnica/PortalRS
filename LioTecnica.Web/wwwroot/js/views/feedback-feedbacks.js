(function () {
    "use strict";

    const API_MINE = "/Feedback/_api/items/mine";
    const PAGE_SIZE = 20;

    // DOM refs
    const filterFrom = document.getElementById("filterFrom");
    const filterTo = document.getElementById("filterTo");
    const btnFilter = document.getElementById("btnFilter");
    const btnClearFilter = document.getElementById("btnClearFilter");
    const searchBox = document.getElementById("searchBox");

    const kpiReceived = document.getElementById("kpiReceived");
    const kpiSent = document.getElementById("kpiSent");
    const countReceived = document.getElementById("countReceived");
    const countSent = document.getElementById("countSent");

    const listReceived = document.getElementById("listReceived");
    const emptyReceived = document.getElementById("emptyReceived");
    const loadMoreReceived = document.getElementById("loadMoreReceived");
    const btnLoadMoreReceived = document.getElementById("btnLoadMoreReceived");

    const listSent = document.getElementById("listSent");
    const emptySent = document.getElementById("emptySent");
    const loadMoreSent = document.getElementById("loadMoreSent");
    const btnLoadMoreSent = document.getElementById("btnLoadMoreSent");

    const starsUserAlinhamento = document.getElementById("starsUserAlinhamento");
    const starsUserFoco = document.getElementById("starsUserFoco");

    let pageReceived = 1;
    let pageSent = 1;
    let totalReceivedCount = 0;
    let totalSentCount = 0;

    // All loaded items (for client-side filtering)
    let allReceived = [];
    let allSent = [];

    // ── Defaults: 3 months ago to today ──
    function setDefaultDates() {
        const today = new Date();
        const threeMonthsAgo = new Date(today);
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        if (filterTo) filterTo.value = today.toISOString().slice(0, 10);
        if (filterFrom) filterFrom.value = threeMonthsAgo.toISOString().slice(0, 10);
    }

    // ── Helpers ──
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
        return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    function getInitials(name) {
        return (name || "").split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
    }

    async function apiGet(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.json();
    }

    // ── Date filter ──
    function isInDateRange(isoDate) {
        if (!filterFrom || !filterTo) return true;
        const from = filterFrom.value;
        const to = filterTo.value;
        if (!from && !to) return true;
        const d = new Date(isoDate);
        if (Number.isNaN(d.getTime())) return true;
        if (from && d < new Date(from + "T00:00:00")) return false;
        if (to && d > new Date(to + "T23:59:59")) return false;
        return true;
    }

    // ── Search filter ──
    function matchesSearch(item) {
        if (!searchBox || !searchBox.value.trim()) return true;
        const q = searchBox.value.trim().toLowerCase();
        const fields = [
            item.fromUserFullName, item.toUserFullName, item.content, item.tipo
        ].filter(Boolean).join(" ").toLowerCase();
        return fields.includes(q);
    }

    // ── Render a feedback row ──
    function renderRow(item) {
        const fromName = escapeHtml(item.fromUserFullName || "");
        const toName = escapeHtml(item.toUserFullName || "");
        const content = escapeHtml(item.content || "");
        const date = formatDate(item.createdAtUtc);
        const tipo = item.tipo ? `<span class="badge bg-light text-dark ms-2">${escapeHtml(item.tipo)}</span>` : "";
        const presencial = item.isPresencial ? `<span class="badge bg-info text-white ms-1"><i class="bi bi-person-check me-1"></i>Presencial</span>` : "";

        const avatarHtml = `<div class="initials-badge">${getInitials(fromName)}</div>`;

        // Star ratings
        let ratingsHtml = "";
        if (item.ratings && item.ratings.length > 0) {
            ratingsHtml = '<div class="mt-2 d-flex gap-3 flex-wrap">';
            item.ratings.forEach(r => {
                ratingsHtml += `<span class="small text-muted">${escapeHtml(r.itemName)}: `;
                for (let i = 1; i <= 5; i++) {
                    ratingsHtml += i <= r.stars
                        ? '<i class="bi bi-star-fill star-filled"></i>'
                        : '<i class="bi bi-star text-muted"></i>';
                }
                ratingsHtml += `</span>`;
            });
            ratingsHtml += '</div>';
        }

        return `
            <div class="fb-row item mb-2 p-3">
                <div class="d-flex align-items-start gap-3">
                    <div class="flex-shrink-0">${avatarHtml}</div>
                    <div class="flex-grow-1">
                        <div class="d-flex justify-content-between align-items-start flex-wrap gap-1">
                            <div>
                                <span class="fw-semibold">${fromName}</span>
                                <span class="text-muted"> → </span>
                                <span class="fw-semibold">${toName}</span>
                                ${tipo}${presencial}
                            </div>
                            <div class="text-muted small">${date}</div>
                        </div>
                        <div class="mt-2 text-break">${content}</div>
                        ${ratingsHtml}
                    </div>
                </div>
            </div>`;
    }

    // ── Compute star averages for items ──
    function computeItemAverages(items) {
        const buckets = {};
        items.forEach(item => {
            if (!item.ratings) return;
            item.ratings.forEach(r => {
                const name = r.itemName || "";
                if (!buckets[name]) buckets[name] = { sum: 0, count: 0 };
                buckets[name].sum += r.stars;
                buckets[name].count++;
            });
        });
        return buckets;
    }

    function renderStarsAvg(avg) {
        if (!avg || avg === 0) return '<span class="text-muted small">Sem feedbacks relacionados ao item</span>';
        let html = "";
        for (let i = 1; i <= 5; i++) {
            if (i <= Math.floor(avg)) {
                html += '<i class="bi bi-star-fill star-filled"></i>';
            } else if (i - 0.5 <= avg) {
                html += '<i class="bi bi-star-half star-filled"></i>';
            } else {
                html += '<i class="bi bi-star text-muted"></i>';
            }
        }
        html += `<span class="small fw-bold ms-1">${avg.toFixed(1)}</span>`;
        return html;
    }

    function updateItemSummaries() {
        const avgs = computeItemAverages(allReceived);
        if (starsUserAlinhamento) {
            const bucket = avgs["Alinhamento Cultural"];
            const avg = bucket ? bucket.sum / bucket.count : 0;
            starsUserAlinhamento.innerHTML = renderStarsAvg(avg);
        }
        if (starsUserFoco) {
            const bucket = avgs["Foco no Cliente"];
            const avg = bucket ? bucket.sum / bucket.count : 0;
            starsUserFoco.innerHTML = renderStarsAvg(avg);
        }
    }

    // ── Load received ──
    async function loadReceived(append) {
        if (!append) {
            pageReceived = 1;
            if (listReceived) listReceived.innerHTML = "";
            if (emptyReceived) emptyReceived.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_MINE}?filter=received&page=${pageReceived}&pageSize=${PAGE_SIZE}`);
            totalReceivedCount = data.totalCount || 0;

            const items = (data.items || []);
            if (!append) allReceived = items; else allReceived = allReceived.concat(items);

            // Apply client-side filters
            const filtered = items.filter(i => isInDateRange(i.createdAtUtc) && matchesSearch(i));
            filtered.forEach(item => {
                if (listReceived) listReceived.insertAdjacentHTML("beforeend", renderRow(item));
            });

            // Update counters
            const displayCount = allReceived.filter(i => isInDateRange(i.createdAtUtc) && matchesSearch(i)).length;
            if (kpiReceived) kpiReceived.textContent = displayCount;
            if (countReceived) countReceived.textContent = displayCount;

            if (!append && displayCount === 0 && emptyReceived) emptyReceived.classList.remove("d-none");
            if (loadMoreReceived) loadMoreReceived.classList.toggle("d-none", pageReceived * PAGE_SIZE >= totalReceivedCount);

            updateItemSummaries();
        } catch (e) {
            console.error("loadReceived:", e);
            if (listReceived && !append) listReceived.innerHTML = '<div class="text-danger">Erro ao carregar.</div>';
        }
    }

    // ── Load sent ──
    async function loadSent(append) {
        if (!append) {
            pageSent = 1;
            if (listSent) listSent.innerHTML = "";
            if (emptySent) emptySent.classList.add("d-none");
        }
        try {
            const data = await apiGet(`${API_MINE}?filter=sent&page=${pageSent}&pageSize=${PAGE_SIZE}`);
            totalSentCount = data.totalCount || 0;

            const items = (data.items || []);
            if (!append) allSent = items; else allSent = allSent.concat(items);

            const filtered = items.filter(i => isInDateRange(i.createdAtUtc) && matchesSearch(i));
            filtered.forEach(item => {
                if (listSent) listSent.insertAdjacentHTML("beforeend", renderRow(item));
            });

            const displayCount = allSent.filter(i => isInDateRange(i.createdAtUtc) && matchesSearch(i)).length;
            if (kpiSent) kpiSent.textContent = displayCount;
            if (countSent) countSent.textContent = displayCount;

            if (!append && displayCount === 0 && emptySent) emptySent.classList.remove("d-none");
            if (loadMoreSent) loadMoreSent.classList.toggle("d-none", pageSent * PAGE_SIZE >= totalSentCount);
        } catch (e) {
            console.error("loadSent:", e);
            if (listSent && !append) listSent.innerHTML = '<div class="text-danger">Erro ao carregar.</div>';
        }
    }

    // ── Re-render from cached data (after filter/search change) ──
    function rerender() {
        if (listReceived) {
            listReceived.innerHTML = "";
            const filtered = allReceived.filter(i => isInDateRange(i.createdAtUtc) && matchesSearch(i));
            filtered.forEach(item => listReceived.insertAdjacentHTML("beforeend", renderRow(item)));
            if (kpiReceived) kpiReceived.textContent = filtered.length;
            if (countReceived) countReceived.textContent = filtered.length;
            if (emptyReceived) emptyReceived.classList.toggle("d-none", filtered.length > 0);
        }
        if (listSent) {
            listSent.innerHTML = "";
            const filtered = allSent.filter(i => isInDateRange(i.createdAtUtc) && matchesSearch(i));
            filtered.forEach(item => listSent.insertAdjacentHTML("beforeend", renderRow(item)));
            if (kpiSent) kpiSent.textContent = filtered.length;
            if (countSent) countSent.textContent = filtered.length;
            if (emptySent) emptySent.classList.toggle("d-none", filtered.length > 0);
        }
        updateItemSummaries();
    }

    // ── Load more ──
    if (btnLoadMoreReceived) btnLoadMoreReceived.addEventListener("click", () => { pageReceived++; loadReceived(true); });
    if (btnLoadMoreSent) btnLoadMoreSent.addEventListener("click", () => { pageSent++; loadSent(true); });

    // ── Filter / search events ──
    if (btnFilter) btnFilter.addEventListener("click", rerender);
    if (btnClearFilter) btnClearFilter.addEventListener("click", () => {
        setDefaultDates();
        if (searchBox) searchBox.value = "";
        rerender();
    });

    let searchDebounce = null;
    if (searchBox) searchBox.addEventListener("input", () => {
        clearTimeout(searchDebounce);
        searchDebounce = setTimeout(rerender, 300);
    });

    // ── Tab lazy load ──
    document.getElementById("tab-sent")?.addEventListener("shown.bs.tab", () => {
        if (allSent.length === 0) loadSent(false);
    });

    // ── Persist tab ──
    (function persistTab() {
        try {
            const tabs = document.getElementById("fbTabs");
            if (!tabs) return;
            const links = Array.from(tabs.querySelectorAll(".nav-link"));
            const saved = localStorage.getItem("fbSelectedTab");
            if (saved) {
                const btn = document.getElementById(saved);
                if (btn && typeof bootstrap !== "undefined") {
                    new bootstrap.Tab(btn).show();
                }
            }
            links.forEach(btn => {
                btn.addEventListener("shown.bs.tab", () => {
                    try { localStorage.setItem("fbSelectedTab", btn.id); } catch (e) { }
                });
            });
        } catch (e) { console.warn("persistTab error", e); }
    })();

    // ── Init ──
    setDefaultDates();
    loadReceived(false);
    // Sent tab loads lazily on first show
})();
