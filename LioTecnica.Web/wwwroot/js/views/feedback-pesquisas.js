(function () {
    "use strict";

    const API = "/api/feedback/surveys";
    const listEl = document.getElementById("pesquisasList");
    const btnNova = document.getElementById("btnNovaPesquisa");
    const filtro = document.getElementById("pesquisaFiltro");

    async function apiGet(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.json();
    }

    async function apiPost(url, payload) {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res;
    }

    function renderItem(s) {
        return `<tr>
            <td>${escapeHtml(s.title)}</td>
            <td>${formatDate(s.createdAtUtc)}</td>
            <td>${s.endAtUtc ? formatDate(s.endAtUtc) : "-"}</td>
            <td>-</td>
            <td>${s.responsesCount}</td>
            <td>-</td>
            <td>-</td>
            <td><a href="/Feedback/Pesquisas/${s.id}" class="btn btn-sm btn-ghost">Ver</a></td>
        </tr>`;
    }

    function escapeHtml(s) {
        if (!s) return "";
        const d = document.createElement("div");
        d.textContent = s;
        return d.innerHTML;
    }

    function formatDate(v) {
        if (!v) return "";
        try {
            const d = new Date(v);
            return d.toLocaleString("pt-BR");
        } catch { return v; }
    }

    async function load() {
        try {
            const data = await apiGet(API + "?page=1&pageSize=50");
            const items = data.items || [];
            if (!listEl) return;
            if (items.length === 0) {
                listEl.innerHTML = `<tr><td colspan="8" class="text-center text-muted">Nenhum registro encontrado</td></tr>`;
                return;
            }
            listEl.innerHTML = items.map(renderItem).join("");
        } catch (e) {
            console.error("pesquisas load:", e);
        }
    }

    async function createPrompt() {
        const title = prompt("Título da pesquisa:");
        if (!title) return;
        const type = prompt("Tipo (ex: Rapida, Super, Engajamento):", "Rapida") || "Rapida";
        await apiPost(API, { title, type });
        await load();
    }

    if (btnNova) btnNova.addEventListener("click", (e) => { e.preventDefault(); createPrompt(); });
    if (filtro) filtro.addEventListener("input", load);

    load();
})();

