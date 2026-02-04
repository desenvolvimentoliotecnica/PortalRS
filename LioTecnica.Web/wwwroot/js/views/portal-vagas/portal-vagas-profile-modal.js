(function () {

    const sectionMap = {
        perfil: "tabProfile",
        testes: "tabTests",
        comp: "tabSkills",
        formacao: "tabEdu",
        exp: "tabExperience",
        lgpd: "tabLgpd",
        pref: "tabPref",
        docs: "tabDocs",
        refs: "tabRefs",
        acess: "tabA11y",
        agenda: "tabAgenda",
        hist: "tabApps",
        notif: "tabNotify"
    };

    const sectionsCards = document.getElementById("profileSectionsCards");
    const sectionsContent = document.getElementById("profileSectionsContent");
    const backButtons = Array.from(document.querySelectorAll(".profile-back-to-cards"));

    const leftCol = document.getElementById("profileLeftPanelCol");
    const rightCol = document.getElementById("profileSectionsCol");

    function showCardsView() {
        sectionsCards?.classList.remove("d-none");
        sectionsContent?.classList.add("d-none");
        backButtons.forEach(btn => btn.classList.add("d-none"));
        if (leftCol) leftCol.classList.remove("d-none");
        if (rightCol) {
            rightCol.classList.remove("col-lg-12");
            if (!rightCol.classList.contains("col-lg-7")) rightCol.classList.add("col-lg-7");
        }
    }

    function showSectionView(key) {
        if (!key) return;
        const paneId = sectionMap[key];
        if (!paneId) return;

        const panes = document.querySelectorAll("#profileTabsContent .tab-pane");
        panes.forEach(p => p.classList.remove("show", "active"));
        const target = document.getElementById(paneId);
        if (target) {
            target.classList.add("show", "active");
        }

        sectionsCards?.classList.add("d-none");
        sectionsContent?.classList.remove("d-none");
        backButtons.forEach(btn => btn.classList.remove("d-none"));
        if (leftCol) leftCol.classList.add("d-none");
        if (rightCol) {
            rightCol.classList.remove("col-lg-7");
            if (!rightCol.classList.contains("col-lg-12")) rightCol.classList.add("col-lg-12");
        }

        if (key === "pref" && typeof window.renderPreferences === "function") {
            window.renderPreferences();
        }
        if (key === "lgpd" && typeof window.renderLgpd === "function") {
            window.renderLgpd();
        }
        if (key === "agenda" && typeof window.renderAgenda === "function") {
            window.renderAgenda();
        }
        if (key === "notif" && typeof window.renderNotify === "function") {
            window.renderNotify();
        }
    }




    const TOPICS = [
        { key: "perfil", name: "Perfil", icon: "bi-person" },
        { key: "testes", name: "Testes", icon: "bi-clipboard-check" },
        { key: "comp", name: "CompetÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncias & PortfÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³lio", icon: "bi-lightning-charge" },
        { key: "formacao", name: "FormaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o & EducaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o", icon: "bi-mortarboard" },
        { key: "exp", name: "ExperiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia & Projetos", icon: "bi-briefcase" },
        { key: "lgpd", name: "Privacidade (LGPD)", icon: "bi-shield-lock" },
        { key: "pref", name: "PreferÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncias / Objetivos", icon: "bi-bullseye" },
        { key: "docs", name: "Documentos & Anexos", icon: "bi-paperclip" },
        { key: "refs", name: "ReferÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncias", icon: "bi-people" },
        { key: "acess", name: "Acessibilidade & InclusÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o", icon: "bi-universal-access" },
        { key: "agenda", name: "Disponibilidade & Agenda", icon: "bi-calendar-week" },
        { key: "hist", name: "HistÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rico de Candidaturas", icon: "bi-clock-history" },
        { key: "notif", name: "NotificaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes & ComunicaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o", icon: "bi-bell" },
    ];

    const progressByKey = Object.create(null);
    TOPICS.forEach(t => progressByKey[t.key] = randomPercent());

    let selectedKey = null;
    let rendered = false;
    function classFromPercent(pct) {
        if (pct >= 75) return "is-green";
        if (pct >= 50) return "is-blue";
        if (pct >= 25) return "is-yellow";
        return "is-red";
    }

    function randomPercent() {
        const r = Math.random();
        if (r < 0.08) return 0;
        if (r > 0.92) return 100;
        return Math.floor(10 + Math.random() * 86);
    }

    function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function getCssNumber(varName) {
        const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
        const n = Number(v);
        return Number.isFinite(n) ? n : 0;
    }

    // 0..100 -> matiz (vermelho/laranja -> amarelo -> verde)
    function hueFromPercent(pct) {
        const p = clamp(pct, 0, 100);
        if (p <= 50) {
            const t = p / 50;
            return lerp(getCssNumber("--c-low"), getCssNumber("--c-mid"), t);
        }
        const t = (p - 50) / 50;
        return lerp(getCssNumber("--c-mid"), getCssNumber("--c-high"), t);
    }


    function renderGrid() {
        const grid = document.getElementById("profileTopicsGrid");
        if (!grid) return;

        grid.innerHTML = "";
        TOPICS.forEach(topic => {
            const pct = progressByKey[topic.key];
            const hue = Math.round(hueFromPercent(pct));


            const item = document.createElement("div");
            item.className = "topic-item";

            const card = document.createElement("button");
            card.type = "button";
            card.className = "topic-card";
            card.setAttribute("data-key", topic.key);
            card.setAttribute("data-hue", hue);
            card.style.setProperty("--h", hue);
            card.setAttribute("aria-label", topic.name);

            card.classList.add(classFromPercent(pct));

            const badge = document.createElement("span");
            badge.className = "topic-badge";
            badge.textContent = pct + "%";

            const icon = document.createElement("i");
            icon.className = `topic-icon bi ${topic.icon}`;

            const prog = document.createElement("div");
            prog.className = "topic-progress";
            const fill = document.createElement("span");
            fill.style.width = clamp(pct, 0, 100) + "%";
            prog.appendChild(fill);

            card.appendChild(badge);
            card.appendChild(icon);
            card.appendChild(prog);

            const label = document.createElement("div");
            label.className = "topic-label";
            label.textContent = topic.name;

            const sub = document.createElement("div");
            sub.className = "topic-sub";
            sub.textContent = "";

            item.appendChild(card);
            item.appendChild(label);
            item.appendChild(sub);

            grid.appendChild(item);
        });
    }

    function clearSelected() {
        document.querySelectorAll("#profileTopicsGrid .topic-card.is-selected")
            .forEach(x => x.classList.remove("is-selected"));
    }

    function showDetail(key) {
        const t = TOPICS.find(x => x.key === key);
        if (!t) return;

        selectedKey = key;
        const pct = progressByKey[key];
        const hue = Math.round(hueFromPercent(pct));

        const detailName = document.getElementById("profileDetailName");
        const detailDesc = document.getElementById("profileDetailDesc");
        const detailPercent = document.getElementById("profileDetailPercent");
        const detailBar = document.getElementById("profileDetailBar");
        const btnOpen = document.getElementById("profileBtnOpenSection");
        const btnDone = document.getElementById("profileBtnMarkDone");

        if (detailName) detailName.textContent = t.name;

        if (detailDesc) {
            detailDesc.innerHTML = `
                <div class="mb-2">
                  <span class="pill"><i class="bi ${t.icon}"></i> ${t.name}</span>
                  <span class="pill"><i class="bi bi-percent"></i> ${pct}%</span>
                </div>
                <div class="text-secondary small">
                  Visualize o status de preenchimento desta seÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o e prossiga para completar as informaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes.
                </div>
              `;
        }

        if (detailPercent) detailPercent.textContent = pct + "%";
        if (detailBar) {
            detailBar.style.width = pct + "%";
            detailBar.style.backgroundColor = `hsl(${hue} 70% 45%)`;
        }

        if (btnOpen) btnOpen.disabled = false;
        if (btnDone) btnDone.disabled = false;

        clearSelected();
        const btn = document.querySelector(`#profileTopicsGrid .topic-card[data-key="${CSS.escape(key)}"]`);
        if (btn) btn.classList.add("is-selected");
    }

    function wireEvents() {
        const grid = document.getElementById("profileTopicsGrid");
        if (grid && !grid.__wired) {
            grid.addEventListener("click", (ev) => {
                const btn = ev.target.closest(".topic-card");
                if (!btn) return;
                const key = btn.getAttribute("data-key");
                showDetail(key);
                showSectionView(key);
            });
            grid.__wired = true;
        }


        backButtons.forEach(btn => {
            if (!btn.__wired) {
                btn.addEventListener("click", showCardsView);
                btn.__wired = true;
            }
        });

        const btnRandomize = document.getElementById("profileBtnRandomize");
        if (btnRandomize && !btnRandomize.__wired) {
            btnRandomize.addEventListener("click", () => {
                TOPICS.forEach(t => progressByKey[t.key] = randomPercent());
                renderGrid();
                if (selectedKey) showDetail(selectedKey);
            });
            btnRandomize.__wired = true;
        }

        const btnDone = document.getElementById("profileBtnMarkDone");
        if (btnDone && !btnDone.__wired) {
            btnDone.addEventListener("click", () => {
                if (!selectedKey) return;
                progressByKey[selectedKey] = 100;
                renderGrid();
                showDetail(selectedKey);
            });
            btnDone.__wired = true;
        }

        const btnOpen = document.getElementById("profileBtnOpenSection");
        if (btnOpen && !btnOpen.__wired) {
            btnOpen.addEventListener("click", () => {
                if (!selectedKey) return;

                // Integre aqui com sua navegaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o/rotas reais
                // Ex.: window.location.href = `/candidato/${selectedKey}`;
                // Por enquanto: apenas feedback visual.
                Swal.fire({
                    icon: "info",
                    title: "Abrir seÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o",
                    text: "SeÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o: " + selectedKey,
                    confirmButtonText: S.common.ok
                });
            });
            btnOpen.__wired = true;
        }
    }

    function initIfNeeded() {
        if (rendered) return;
        renderGrid();
        wireEvents();
        rendered = true;
    }

    document.addEventListener("DOMContentLoaded", () => {
        const modalEl = document.getElementById("profileModal");
        if (!modalEl) return;

        // Renderiza quando o modal abrir (evita render desnecessÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rio)
        modalEl.addEventListener("shown.bs.modal", () => {
            initIfNeeded();
            if (sectionsContent?.classList.contains("d-none")) {
                showCardsView();
            }
        });

        modalEl.addEventListener("hidden.bs.modal", () => {
            if (document.querySelector(".modal.show")) return;
            showCardsView();
        });

        // se o modal jÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ estiver visÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­vel por algum motivo
        if (modalEl.classList.contains("show")) initIfNeeded();
    });
})();
