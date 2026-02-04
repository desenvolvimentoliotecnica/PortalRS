(function () {
    "use strict";

    const API_ITEMS = "/Feedback/_api/items";
    const API_USERS = "/Feedback/_api/users";
    const toUserId = document.getElementById("toUserId");
    const content = document.getElementById("content");
    const tipo = document.getElementById("tipo");
    const charCount = document.getElementById("charCount");
    const formEnviar = document.getElementById("formEnviar");
    const btnEnviar = document.getElementById("btnEnviar");

    async function apiGet(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.json();
    }

    async function apiPost(url, body) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error("Falha: " + res.status);
        return res.status === 204 ? null : res.json();
    }

    function updateCharCount() {
        const len = (content && content.value) ? content.value.length : 0;
        if (charCount) charCount.textContent = len;
    }

    async function loadUsers() {
        try {
            const users = await apiGet(API_USERS);
            if (!toUserId) return;
            toUserId.replaceChildren();
            const opt0 = document.createElement("option");
            opt0.value = "";
            opt0.textContent = "Selecione um colaborador";
            toUserId.appendChild(opt0);
            (users || []).forEach(u => {
                const opt = document.createElement("option");
                opt.value = u.id;
                opt.textContent = (u.fullName || u.email || "").trim() || u.id;
                toUserId.appendChild(opt);
            });
        } catch (e) {
            console.error(e);
            if (toUserId) toUserId.innerHTML = "<option value=\"\">Erro ao carregar colaboradores</option>";
        }
    }

    if (content) content.addEventListener("input", updateCharCount);

    if (formEnviar) {
        formEnviar.addEventListener("submit", async function (e) {
            e.preventDefault();
            const toId = toUserId && toUserId.value ? toUserId.value.trim() : "";
            const text = content && content.value ? content.value.trim() : "";
            if (!toId || !text) return;
            btnEnviar.disabled = true;
            try {
                await apiPost(API_ITEMS, {
                    toUserId: toId,
                    content: text,
                    tipo: (tipo && tipo.value) ? tipo.value : null
                });
                content.value = "";
                if (tipo) tipo.value = "";
                updateCharCount();
                alert("Feedback enviado com sucesso.");
            } catch (err) {
                console.error(err);
                alert("Erro ao enviar. Tente novamente.");
            } finally {
                btnEnviar.disabled = false;
            }
        });
    }

    updateCharCount();
    loadUsers();
})();
