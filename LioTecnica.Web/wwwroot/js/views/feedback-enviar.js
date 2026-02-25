(function () {
    "use strict";

    const API_ITEMS = "/Feedback/_api/items";
    const API_USERS = "/Feedback/_api/users";

    // DOM refs
    const toUserId = document.getElementById("toUserId");
    const content = document.getElementById("content");
    const templateSelect = document.getElementById("templateSelect");
    const charCount = document.getElementById("charCount");
    const formEnviar = document.getElementById("formEnviar");
    const btnEnviar = document.getElementById("btnEnviar");
    const isPresencial = document.getElementById("isPresencial");
    const internalNotes = document.getElementById("internalNotes");
    const toastEl = document.getElementById("toastSuccess");

    // ── Feedback template models ──
    const TEMPLATES = {
        "": "",
        "parar-continuar-comecar":
            "Você deve parar de:\n\n(descreva o que seu colega deve parar de fazer)\n\n\nVocê deve continuar fazendo:\n\n(descreva a sugestão que o seu colega faz bem e deve continuar fazendo)\n\n\nVocê deve começar a fazer:\n\n(descreva algo que seu colega ainda não faz mas você sugere que ele deva fazer)",
        "sci":
            "Descreva a situação específica em que algo ocorreu:\n\n\nExplique o comportamento dessa pessoa naquela situação:\n\n\nDescreva qual impacto o comportamento gerou:",
        "cnv":
            "Primeiro passo: observar o que ocorre sem julgar. Falar os fatos.\n\n\nSegundo passo: Expressar seu sentimento de acordo com o ocorrido.\n\n\nTerceiro passo: Identificar sua necessidade e deixar a pessoa ciente do que você esperava naquela situação.\n\n\nQuarto passo: fazer um pedido para que suas expectativas sejam atendidas.",
        "1on1":
            "Pontos conversados\n\nQual sua visão de futuro aqui na equipe?\nO que você mais gosta de fazer e o que menos gosta?\nQual sua maior dificuldade?\nComo gestor, como consigo te ajudar no seu dia-a-dia?\n\nPlano de ação\n\nRealizar o curso X\nRealizar as atividades Y e Z\n\nPontos que ficaram para o próximo encontro\n\nAssunto X ...",
        "otimas-ideias":
            "Muito legal! Você tem ajudado a equipe com suas ideias e sugestões de melhorias, continue assim!",
        "boa-reuniao":
            "Muito legal! Você tem ajudado a equipe com suas ideias e sugestões de melhorias, continue assim!",
        "presencial": ""
    };

    // ── Star rating logic ──
    function initStarRatings() {
        document.querySelectorAll(".star-rating").forEach(container => {
            const stars = container.querySelectorAll("i");
            let selected = 0;

            function render(highlightUpTo) {
                stars.forEach((s, i) => {
                    if (i < highlightUpTo) {
                        s.className = "bi bi-star-fill star-active";
                    } else {
                        s.className = "bi bi-star";
                    }
                });
            }

            stars.forEach(star => {
                star.addEventListener("mouseenter", () => {
                    const val = parseInt(star.dataset.value);
                    render(val);
                });

                star.addEventListener("click", () => {
                    const val = parseInt(star.dataset.value);
                    selected = selected === val ? 0 : val;
                    container.dataset.selected = selected;
                    render(selected);
                });
            });

            container.addEventListener("mouseleave", () => {
                render(selected);
            });
        });
    }

    // ── Char count ──
    function updateCharCount() {
        const len = (content && content.value) ? content.value.length : 0;
        if (charCount) charCount.textContent = len;
    }

    // ── Template selector ──
    function onTemplateChange() {
        if (!templateSelect || !content) return;
        const key = templateSelect.value;
        const tmpl = TEMPLATES[key];
        if (tmpl !== undefined) {
            content.value = tmpl;
            updateCharCount();
        }
        // Auto-check presencial for the "presencial" template
        if (key === "presencial" && isPresencial) {
            isPresencial.checked = true;
        }
    }

    // ── Load users ──
    async function loadUsers() {
        try {
            const res = await fetch(API_USERS, { headers: { Accept: "application/json" } });
            if (!res.ok) throw new Error("Falha: " + res.status);
            const users = await res.json();
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
            if (toUserId) toUserId.innerHTML = '<option value="">Erro ao carregar colaboradores</option>';
        }
    }

    // ── Collect star ratings ──
    function collectRatings() {
        const ratings = [];
        document.querySelectorAll(".star-rating").forEach(container => {
            const selected = parseInt(container.dataset.selected || "0");
            if (selected > 0) {
                ratings.push({
                    itemName: container.dataset.item,
                    stars: selected
                });
            }
        });
        return ratings;
    }

    // ── Submit ──
    if (formEnviar) {
        formEnviar.addEventListener("submit", async function (e) {
            e.preventDefault();
            const toId = toUserId && toUserId.value ? toUserId.value.trim() : "";
            const text = content && content.value ? content.value.trim() : "";
            if (!toId) {
                toUserId.focus();
                toUserId.classList.add("is-invalid");
                return;
            }
            if (!text) {
                content.focus();
                content.classList.add("is-invalid");
                return;
            }
            toUserId.classList.remove("is-invalid");
            content.classList.remove("is-invalid");

            btnEnviar.disabled = true;
            btnEnviar.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Enviando...';

            try {
                const payload = {
                    toUserId: toId,
                    content: text,
                    tipo: null,
                    isPresencial: isPresencial ? isPresencial.checked : false,
                    internalNotes: internalNotes && internalNotes.value ? internalNotes.value.trim() : null,
                    ratings: collectRatings()
                };
                const res = await fetch(API_ITEMS, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Accept: "application/json" },
                    body: JSON.stringify(payload)
                });
                if (!res.ok) throw new Error("Falha: " + res.status);

                // Reset form
                content.value = "";
                if (templateSelect) templateSelect.value = "";
                if (internalNotes) internalNotes.value = "";
                if (isPresencial) isPresencial.checked = false;
                updateCharCount();

                // Reset stars
                document.querySelectorAll(".star-rating").forEach(c => {
                    c.dataset.selected = "0";
                    c.querySelectorAll("i").forEach(s => { s.className = "bi bi-star"; });
                });

                // Show toast
                if (toastEl && typeof bootstrap !== "undefined") {
                    const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
                    toast.show();
                }
            } catch (err) {
                console.error(err);
                alert("Erro ao enviar feedback. Tente novamente.");
            } finally {
                btnEnviar.disabled = false;
                btnEnviar.innerHTML = '<i class="bi bi-send me-2"></i>Enviar feedback';
            }
        });
    }

    // ── Event listeners ──
    if (content) content.addEventListener("input", updateCharCount);
    if (content) content.addEventListener("input", () => content.classList.remove("is-invalid"));
    if (toUserId) toUserId.addEventListener("change", () => toUserId.classList.remove("is-invalid"));
    if (templateSelect) templateSelect.addEventListener("change", onTemplateChange);

    // ── Init ──
    updateCharCount();
    loadUsers();
    initStarRatings();
})();
