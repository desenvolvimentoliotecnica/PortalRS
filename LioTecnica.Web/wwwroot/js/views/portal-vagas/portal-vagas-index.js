// ===== Seções (cards) dentro do Profile Modal =====
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
            { key: "perfil",   name: "Perfil",                     icon: "bi-person" },
            { key: "testes",   name: "Testes",                     icon: "bi-clipboard-check" },
            { key: "comp",     name: "Competências & Portfólio",   icon: "bi-lightning-charge" },
            { key: "formacao", name: "Formação & Educação",        icon: "bi-mortarboard" },
            { key: "exp",      name: "Experiência & Projetos",     icon: "bi-briefcase" },
            { key: "lgpd",     name: "Privacidade (LGPD)",         icon: "bi-shield-lock" },
            { key: "pref",     name: "Preferências / Objetivos",   icon: "bi-bullseye" },
            { key: "docs",     name: "Documentos & Anexos",        icon: "bi-paperclip" },
            { key: "refs",     name: "Referências",                icon: "bi-people" },
            { key: "acess",    name: "Acessibilidade & Inclusão",  icon: "bi-universal-access" },
            { key: "agenda",   name: "Disponibilidade & Agenda",   icon: "bi-calendar-week" },
            { key: "hist",     name: "Histórico de Candidaturas",  icon: "bi-clock-history" },
            { key: "notif",    name: "Notificações & Comunicação", icon: "bi-bell" },
          ];

          const progressByKey = Object.create(null);
          TOPICS.forEach(t => progressByKey[t.key] = randomPercent());

          let selectedKey = null;
          let rendered = false;
          function classFromPercent(pct){
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
                  Visualize o status de preenchimento desta seção e prossiga para completar as informações.
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

                // Integre aqui com sua navegação/rotas reais
                // Ex.: window.location.href = `/candidato/${selectedKey}`;
                // Por enquanto: apenas feedback visual.
                Swal.fire({
                  icon: "info",
                  title: "Abrir seção",
                  text: "Seção: " + selectedKey,
                  confirmButtonText: "Ok"
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

            // Renderiza quando o modal abrir (evita render desnecessário)
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

            // se o modal já estiver visível por algum motivo
            if (modalEl.classList.contains("show")) initIfNeeded();
          });
        })();
    

        /**
         * Intenção:
         * - Candidatura completa, com validação e upload opcional.
         * - Sem engolir erro: toda falha resulta em alerta visível.
         * - Mantém a seleção da vaga atual para preencher o modal de candidatura.
         */
        (async function () {
          const elAlert = document.getElementById("appAlert");
          const overlay = document.getElementById("loadingOverlay");
          const apiBase = (window.__portalApiUrl || "").replace(/\/$/, "");
          const tenantId = window.__portalTenantId
            || window.__portalTenantFromClaim
            || new URLSearchParams(window.location.search).get("tenantId")
            || new URLSearchParams(window.location.search).get("tenant")
            || "";
          const isAdminUser = (window.__portalIsAdmin || "false") === "true";
          const grid = document.getElementById("jobsGrid");
          const gridLoading = document.getElementById("jobsLoading");
          let items = [];
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

          const applyModalEl = document.getElementById("applyModal");
          const applyModal = new bootstrap.Modal(applyModalEl, { backdrop: "static", keyboard: true }); // static para evitar perda acidental

          const jobModalApplyBtn = document.getElementById("jobModalApplyBtn");

          const newJobModalEl = document.getElementById("newJobModal");
          const newJobForm = document.getElementById("newJobForm");
          const newJobAlert = document.getElementById("newJobAlert");
          const newJobSubmit = document.getElementById("newJobSubmit");
          const newJobLoading = document.getElementById("newJobLoading");
          const newJobModal = newJobModalEl ? new bootstrap.Modal(newJobModalEl, { backdrop: true, keyboard: true }) : null;
          const newJobUf = document.getElementById("newJobUf");
          const newJobCity = document.getElementById("newJobCity");
          const newJobSalaryMin = document.getElementById("newJobSalaryMin");
          const newJobSalaryMax = document.getElementById("newJobSalaryMax");

          const applyForm = document.getElementById("applyForm");
          const applyAlert = document.getElementById("applyAlert");
          const sendBtn = document.getElementById("sendApplicationBtn");
          const sendBtnText = document.getElementById("sendBtnText");
          const sendBtnSpinner = document.getElementById("sendBtnSpinner");

          const attachmentInput = document.getElementById("attachment");
          const attachmentInvalid = document.getElementById("attachmentInvalid");
          const ufSelect = document.getElementById("candidateUf");
          const citySelect = document.getElementById("candidateCity");
          const phoneInput = document.getElementById("phone");
          const fullNameInput = document.getElementById("fullName");
          const salaryInput = document.getElementById("salaryExpectation");
          const emailInput = document.getElementById("email");

          let currentSort = "recent";
          const pageSize = 9999;
          let currentPage = 1;
          let totalPages = 1;
          let totalItems = 0;
          let isLoadingPage = false;

          // Mantém a vaga atual selecionada (para candidatura)
          let currentJob = null;

          const heroGradients = [
            "linear-gradient(135deg, #1e3a8a, #0ea5e9)",
            "linear-gradient(135deg, #0f766e, #22c55e)",
            "linear-gradient(135deg, #7c3aed, #ec4899)",
            "linear-gradient(135deg, #d97706, #f97316)",
            "linear-gradient(135deg, #1d4ed8, #38bdf8)",
            "linear-gradient(135deg, #4f46e5, #6366f1)"
          ];

          function setGridLoading(isLoading) {
            if (!gridLoading) return;
            gridLoading.classList.toggle("d-none", !isLoading);
          }

          function setNewJobAlert(message, type = "danger") {
            if (!newJobAlert) return;
            newJobAlert.className = `alert alert-${type}`;
            newJobAlert.textContent = message;
            newJobAlert.classList.remove("d-none");
          }

          function clearNewJobAlert() {
            if (!newJobAlert) return;
            newJobAlert.textContent = "";
            newJobAlert.classList.add("d-none");
          }

          function toggleNewJobLoading(isLoading) {
            if (!newJobSubmit || !newJobLoading) return;
            newJobSubmit.disabled = isLoading;
            newJobLoading.classList.toggle("d-none", !isLoading);
          }

          function buildAuthHeaders() {
            return { "Accept": "application/json" };
          }

          function renderOptions(select, options, placeholder = "Selecione") {
            if (!select) return;
            select.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = placeholder;
            select.appendChild(opt);
            options.forEach((item) => {
              const option = document.createElement("option");
              option.value = item.value;
              option.textContent = item.text;
              select.appendChild(option);
            });
          }

          function toNumber(value) {
            if (value === "" || value === null || value === undefined) return null;
            const parsed = Number(value);
            return Number.isFinite(parsed) ? parsed : null;
          }

          function digitsOnly(value) {
            return (value || "").replace(/\D/g, "");
          }

          function formatMoneyBR(value) {
            const digits = digitsOnly(value);
            if (!digits) return "";
            const cents = digits.padStart(3, "0");
            const integerPart = cents.slice(0, -2);
            const decimalPart = cents.slice(-2);
            const integerFormatted = Number(integerPart).toLocaleString("pt-BR");
            return `${integerFormatted},${decimalPart}`;
          }

          function parseMoneyBR(value) {
            if (!value) return null;
            const normalized = value.replace(/\./g, "").replace(",", ".");
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
          }

          const newJobCityCache = new Map();
          let newJobCachedUfs = null;

          function setNewJobSelectLoading(select, label, disabled = true) {
            if (!select) return;
            select.disabled = disabled;
            select.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = label;
            select.appendChild(opt);
          }

          async function fetchNewJobUfs() {
            if (newJobCachedUfs) return newJobCachedUfs;
            const res = await fetch(`${LOCATION_BASE}/Ufs`, { credentials: "same-origin" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            newJobCachedUfs = (Array.isArray(data) ? data : [])
              .map((uf) => (uf || "").toString().trim().toUpperCase())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, "pt-BR"));
            return newJobCachedUfs;
          }

          async function fetchNewJobCitiesForUf(uf) {
            const key = (uf || "").trim().toUpperCase();
            if (!key) return [];
            if (newJobCityCache.has(key)) return newJobCityCache.get(key);
            const res = await fetch(`${LOCATION_BASE}/Ufs/${encodeURIComponent(key)}/Cities`, { credentials: "same-origin" });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = (Array.isArray(data) ? data : [])
              .map((city) => (city || "").toString().trim())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, "pt-BR"));
            newJobCityCache.set(key, list);
            return list;
          }

          async function populateNewJobUfSelect(select) {
            if (!select) return;
            setNewJobSelectLoading(select, "Carregando UFs...", true);
            const list = await fetchNewJobUfs();
            select.disabled = false;
            select.innerHTML = '<option value="" selected>Selecione</option>';
            list.forEach((uf) => {
              const opt = document.createElement("option");
              opt.value = uf;
              opt.textContent = uf;
              select.appendChild(opt);
            });
          }

          async function populateNewJobCitySelect(uf, select) {
            if (!select) return;
            if (!uf) {
              setNewJobSelectLoading(select, "Selecione a UF primeiro", true);
              return;
            }
            setNewJobSelectLoading(select, "Carregando municipios...", true);
            const cities = await fetchNewJobCitiesForUf(uf);
            select.disabled = false;
            select.innerHTML = '<option value="" selected>Selecione</option>';
            cities.forEach((city) => {
              const opt = document.createElement("option");
              opt.value = city;
              opt.textContent = city;
              select.appendChild(opt);
            });
          }

          let newJobLookupsLoaded = false;
          async function loadNewJobLookups() {
            if (newJobLookupsLoaded || !isAdminUser) return;

            const headers = buildAuthHeaders();
            const [areasRes, departmentsRes, enumsRes] = await Promise.all([
              fetch(`/api/lookup/areas`, { headers, credentials: "same-origin" }),
              fetch(`/api/lookup/departments`, { headers, credentials: "same-origin" }),
              fetch(`/api/lookup/enums`, { headers, credentials: "same-origin" })
            ]);

            if (!areasRes.ok || !departmentsRes.ok || !enumsRes.ok)
              throw new Error("Nao foi possivel carregar os dados da vaga.");

            const [areas, departments, enums] = await Promise.all([
              areasRes.json(),
              departmentsRes.json(),
              enumsRes.json()
            ]);

            renderOptions(
              document.getElementById("newJobArea"),
              (areas || []).map((item) => ({ value: item.id, text: item.name })),
              "Selecione a area"
            );

            renderOptions(
              document.getElementById("newJobDepartment"),
              (departments || []).map((item) => ({ value: item.id, text: item.name })),
              "Selecione o departamento"
            );

            renderOptions(
              document.getElementById("newJobStatus"),
              (enums?.vagaStatus || []).map((item) => ({ value: item.code, text: item.text })),
              "Selecione o status"
            );

            renderOptions(
              document.getElementById("newJobModalidade"),
              (enums?.vagaModalidade || []).map((item) => ({ value: item.code, text: item.text })),
              "Modalidade"
            );

            renderOptions(
              document.getElementById("newJobSenioridade"),
              (enums?.vagaSenioridade || []).map((item) => ({ value: item.code, text: item.text })),
              "Senioridade"
            );

            renderOptions(
              document.getElementById("newJobTipo"),
              (enums?.vagaTipoContratacao || []).map((item) => ({ value: item.code, text: item.text })),
              "Tipo"
            );

            renderOptions(
              document.getElementById("newJobVisibilidade"),
              (enums?.vagaPublicacaoVisibilidade || []).map((item) => ({ value: item.code, text: item.text })),
              "Visibilidade"
            );

            const statusSelect = document.getElementById("newJobStatus");
            if (statusSelect && !statusSelect.value) statusSelect.value = "Aberta";
            const visSelect = document.getElementById("newJobVisibilidade");
            if (visSelect && !visSelect.value) visSelect.value = "Externa";

            newJobLookupsLoaded = true;
          }

          function showAppAlert(type, message) {
            // type: "success" | "danger"
            elAlert.className = "alert alert-" + type;
            elAlert.textContent = message;
            elAlert.classList.remove("d-none");
          }

          function clearAppAlert() {
            elAlert.textContent = "";
            elAlert.classList.add("d-none");
          }

          function showApplyAlert(message) {
            applyAlert.textContent = message;
            applyAlert.classList.remove("d-none");
          }

          function clearApplyAlert() {
            applyAlert.textContent = "";
            applyAlert.classList.add("d-none");
          }

          function setLoading(isLoading) {
            overlay.setAttribute("aria-hidden", isLoading ? "false" : "true");
          }

          function setSendLoading(isLoading) {
            // Regra: evitar double-submit e dar feedback visual consistente
            sendBtn.disabled = isLoading;
            sendBtnSpinner.classList.toggle("d-none", !isLoading);
            sendBtnText.textContent = isLoading ? "Enviando..." : "Enviar candidatura";
          }

          const LOCATION_BASE = "/PortalVagas/Locations";
          let cachedUfs = null;
          const cityCache = new Map();
          let cachedProfile = null;

          function setUfLoading(label, disabled = true) {
            if (!ufSelect) return;
            ufSelect.disabled = disabled;
            ufSelect.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = label;
            ufSelect.appendChild(opt);
          }

          async function fetchUfs() {
            if (cachedUfs) return cachedUfs;
            const res = await fetch(`${LOCATION_BASE}/Ufs`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = (Array.isArray(data) ? data : [])
              .map(uf => (uf || "").toString().trim().toUpperCase())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, "pt-BR"));
            cachedUfs = list;
            return list;
          }

          async function populateUfSelect(selectedUf = "", lockSelect = false) {
            if (!ufSelect) return;
            setUfLoading("Carregando UFs...", true);
            try {
              const list = await fetchUfs();
              ufSelect.disabled = false;
              ufSelect.innerHTML = '<option value="" selected>Selecione</option>';
              list.forEach(uf => {
                const opt = document.createElement("option");
                opt.value = uf;
                opt.textContent = uf;
                if (uf === selectedUf) opt.selected = true;
                ufSelect.appendChild(opt);
              });
              if (lockSelect) ufSelect.disabled = true;
            } catch (err) {
              console.error(err);
              setUfLoading("Nao foi possivel carregar UFs", true);
            }
          }

          function setCityLoading(label, disabled = true) {
            if (!citySelect) return;
            citySelect.disabled = disabled;
            citySelect.innerHTML = "";
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = label;
            citySelect.appendChild(opt);
          }

          async function fetchCitiesForUf(uf) {
            const key = uf.toUpperCase();
            if (cityCache.has(key)) return cityCache.get(key);
            const res = await fetch(`${LOCATION_BASE}/Ufs/${encodeURIComponent(key)}/Cities`);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const data = await res.json();
            const list = (Array.isArray(data) ? data : [])
              .map(city => (city || "").toString().trim())
              .filter(Boolean)
              .sort((a, b) => a.localeCompare(b, "pt-BR"));
            cityCache.set(key, list);
            return list;
          }

          async function loadCitiesForUf(uf, selectedCity = "", lockSelect = false) {
            if (!uf) {
              setCityLoading("Selecione a UF primeiro", true);
              return;
            }
            setCityLoading("Carregando municipios...", true);
            try {
              const cities = await fetchCitiesForUf(uf);
              citySelect.disabled = false;
              citySelect.innerHTML = '<option value="" selected>Selecione</option>';
              cities.forEach(name => {
                const opt = document.createElement("option");
                opt.value = name;
                opt.textContent = name;
                if (name === selectedCity) opt.selected = true;
                citySelect.appendChild(opt);
              });
              if (lockSelect) citySelect.disabled = true;
            } catch (err) {
              console.error(err);
              setCityLoading("Nao foi possivel carregar cidades", true);
            }
          }

          function digitsOnly(value) {
            return (value || "").replace(/\D/g, "");
          }

          function formatPhone(value) {
            const digits = digitsOnly(value).slice(0, 11);
            if (!digits) return "";
            const ddd = digits.slice(0, 2);
            const part1 = digits.length > 2 ? digits.slice(2, digits.length > 6 ? 7 : 6) : "";
            const part2 = digits.length > 6 ? digits.slice(7) : "";
            if (digits.length <= 6) return `(${ddd}) ${digits.slice(2)}`;
            return `(${ddd}) ${part1}-${part2}`;
          }

          function formatMoneyInput(value) {
            const digits = digitsOnly(value);
            if (!digits) return "";
            const num = Number(digits);
            if (!Number.isFinite(num)) return "";
            return num.toLocaleString("pt-BR");
          }

          function setupApplyMasks() {
            if (phoneInput) {
              phoneInput.addEventListener("input", () => {
                const formatted = formatPhone(phoneInput.value);
                phoneInput.value = formatted;
                const digits = digitsOnly(formatted);
                phoneInput.setCustomValidity(digits.length === 11 ? "" : "Telefone invalido.");
              });
            }

            if (salaryInput) {
              salaryInput.addEventListener("input", () => {
                const digits = digitsOnly(salaryInput.value);
                salaryInput.dataset.raw = digits;
                salaryInput.value = formatMoneyInput(digits);
                salaryInput.setCustomValidity(digits ? "" : "Pretensao invalida.");
              });
            }

            if (emailInput) {
              emailInput.addEventListener("input", () => {
                // Reseta custom validity e deixa o browser validar o formato
                emailInput.setCustomValidity("");
              });
            }
          }

          function scrollToFirstInvalid() {
            const invalid = applyForm.querySelector(":invalid");
            if (!invalid) {
              applyModalEl?.scrollIntoView?.({ behavior: "smooth", block: "start" });
              return;
            }
            invalid.scrollIntoView({ behavior: "smooth", block: "center" });
            invalid.focus({ preventScroll: true });
          }

          function resetApplyLocation() {
            populateUfSelect();
            setCityLoading("Selecione a UF primeiro", true);
          }

          async function loadCandidateProfile() {
            if (cachedProfile) return cachedProfile;
            const response = await fetch("/PortalVagas/Profile", {
              method: "GET",
              headers: { "Accept": "application/json" },
              credentials: "same-origin"
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok) {
              const message = data && data.message ? data.message : "Nao foi possivel carregar seus dados.";
              throw new Error(message);
            }
            cachedProfile = data || {};
            return cachedProfile;
          }

          async function applyProfileToForm() {
            try {
              const profile = await loadCandidateProfile();
              if (fullNameInput) fullNameInput.value = profile.nome || "";
              if (emailInput) emailInput.value = profile.email || "";
              if (phoneInput) {
                phoneInput.value = formatPhone(profile.fone || "");
                const digits = digitsOnly(phoneInput.value);
                phoneInput.setCustomValidity(digits.length === 11 ? "" : "Telefone invalido.");
              }

              const uf = (profile.uf || "").toUpperCase();
              const city = profile.cidade || "";
              await populateUfSelect(uf, true);
              await loadCitiesForUf(uf, city, true);
            } catch (err) {
              console.error(err);
              const message = err && err.message ? err.message : "Nao foi possivel carregar seus dados.";
              showApplyAlert(message);
            }
          }

          function normalize(str) {
            return (str || "").toString().trim().toLowerCase();
          }

          function parseNumber(value) {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
          }

          function parseTags(raw) {
            if (!raw) return [];
            return raw
              .split(/[;,]/)
              .map(x => x.trim())
              .filter(Boolean);
          }

          function buildTags(job) {
            const tags = [
              ...parseTags(job.tagsKeywordsRaw),
              ...parseTags(job.tagsStackRaw),
              ...parseTags(job.tagsResponsabilidadesRaw)
            ];
            return Array.from(new Set(tags));
          }

          function formatLocation(job) {
            const city = (job.cidade || "").trim();
            const uf = (job.uf || "").trim();
            if (city && uf) return `${city}, ${uf}`;
            if (city) return city;
            if (uf) return uf;
            return job.modalidade || "Nao informado";
          }

          function normalizeEnum(value) {
            return value || "Nao informado";
          }

          function closeFiltersDrawer() {
            if (!filtersDrawerEl) return;
            const instance = bootstrap.Offcanvas.getInstance(filtersDrawerEl)
              || new bootstrap.Offcanvas(filtersDrawerEl);
            instance.hide();
          }

          function formatMoney(min, max) {
            const f = (n) => Number(n || 0).toLocaleString("pt-BR");
            return `R$ ${f(min)} - ${f(max)}`;
          }

          function buildJobCard(job, index) {
            const tags = buildTags(job);
            const company = job.tenantName || "Portal RH";
            const location = formatLocation(job);
            const mode = normalizeEnum(job.modalidade);
            const type = normalizeEnum(job.tipoContratacao);
            const level = normalizeEnum(job.senioridade);
            const area = job.area || "Geral";
            const salaryMin = job.salarioMinimo || 0;
            const salaryMax = job.salarioMaximo || 0;
            const createdAt = job.createdAtUtc ? new Date(job.createdAtUtc) : new Date();
            const dateIso = createdAt.toISOString().slice(0, 10);

            const col = document.createElement("div");
            col.className = "col job-item";
            col.dataset.id = job.id;
            col.dataset.title = job.titulo || "Vaga";
            col.dataset.company = company;
            col.dataset.location = location;
            col.dataset.mode = mode;
            col.dataset.type = type;
            col.dataset.level = level;
            col.dataset.area = area;
            col.dataset.tags = tags.join(", ");
            col.dataset.salaryMin = String(salaryMin);
            col.dataset.salaryMax = String(salaryMax);
            col.dataset.date = dateIso;

            const badgeHtml = [mode, type, level]
              .filter(Boolean)
              .map(item => `<span class="badge rounded-pill">${item}</span>`)
              .join("");

            const tagHtml = tags.slice(0, 6)
              .map(tag => `<span class="badge text-bg-light border">${tag}</span>`)
              .join("");

            const salaryLine = salaryMax ? `Faixa: ${formatMoney(salaryMin, salaryMax)}` : "Faixa: a combinar";
            const hero = heroGradients[index % heroGradients.length];

            col.innerHTML = `
              <article class="card job-card h-100">
                <div class="job-hero" style="background-image:${hero};">
                  <h3 class="job-title-on-hero">${col.dataset.title}</h3>
                  <div class="job-badge-row">
                    ${badgeHtml}
                  </div>
                </div>
                <div class="card-body">
                  <div class="text-secondary mb-2">${company}</div>
                  <div class="job-meta text-secondary small mb-3">
                    <span>${location}</span><span class="dot" aria-hidden="true"></span>
                    <span>${area}</span>
                  </div>
                  <div class="d-flex flex-wrap gap-2 mb-2">
                    ${tagHtml || "<span class=\"badge text-bg-light border\">Geral</span>"}
                  </div>
                  <div class="text-secondary small">${salaryLine}</div>
                  <a class="stretched-link job-link" href="#${col.dataset.id}"
                     aria-label="Ver detalhes da vaga ${col.dataset.title}"></a>
                </div>
              </article>`;

            return col;
          }

          const sectionImageMap = [
            { match: "industrial", title: "Industrial & Produ\u00e7\u00e3o", image: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&q=80&w=1600" },
            { match: "qualidade", title: "Qualidade & P&D", image: "https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&q=80&w=1600" },
            { match: "logistica", title: "Log\u00edstica & Supply", image: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&q=80&w=1600" },
            { match: "rh", title: "Administrativo & RH", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600" },
            { match: "administrativo", title: "Administrativo & RH", image: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&q=80&w=1600" },
            { match: "comercial", title: "Vendas & Marketing", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=1600" },
            { match: "marketing", title: "Vendas & Marketing", image: "https://images.unsplash.com/photo-1556761175-5973dc0f32e7?auto=format&fit=crop&q=80&w=1600" }
          ];

          function normalizeKey(value) {
            return (value || "")
              .toString()
              .toLowerCase()
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "");
          }

          function getSectionInfo(area) {
            const key = normalizeKey(area);
            const match = sectionImageMap.find(x => key.includes(x.match));
            if (match) return match;
            return {
              title: area || "Outras oportunidades",
              image: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&q=80&w=1600"
            };
          }

          function buildSection(info, jobs, startIndex) {
            const section = document.createElement("section");
            section.className = "job-section";

            const header = document.createElement("div");
            header.className = "job-section-hero mb-4";
            header.style.backgroundImage = `url('${info.image}')`;
            header.innerHTML = `
              <div class="job-section-title">
                <span>${info.title}</span>
              </div>
              <span class="job-section-count">${jobs.length} vagas</span>
            `;

            const gridEl = document.createElement("div");
            gridEl.className = "row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xxl-4 g-4";

            jobs.forEach((job, idx) => {
              gridEl.appendChild(buildJobCard(job, startIndex + idx));
            });

            section.appendChild(header);
            section.appendChild(gridEl);
            return section;
          }

          async function loadJobs(reset = false) {
            if (!apiBase) {
              showAppAlert("danger", "Nao foi possivel carregar as vagas. URL da API nao configurada.");
              setGridLoading(false);
              grid.replaceChildren();
              return;
            }
            if (!tenantId) {
              showAppAlert("danger", "Tenant nao informado. Use o parametro tenantId na URL.");
              setGridLoading(false);
              grid.replaceChildren();
              return;
            }
            if (isLoadingPage) return;

            if (reset) {
              currentPage = 1;
              totalPages = 1;
              totalItems = 0;
              if (gridLoading) {
                grid.replaceChildren(gridLoading);
              } else {
                grid.replaceChildren();
              }
            }

            isLoadingPage = true;
            setGridLoading(true);
            try {
              const allItems = [];
              let page = 1;
              let apiTotalPages = 1;

              do {
                const query = buildQuery(page);
                const url = `${apiBase}/api/public/vagas?tenantId=${encodeURIComponent(tenantId)}&${query}`;
                const res = await fetch(url, { headers: { "accept": "application/json" } });
                if (!res.ok) {
                  const body = await res.text();
                  throw new Error(`HTTP ${res.status} ${res.statusText} :: ${body}`);
                }
                const data = await res.json();
                if (!data || !Array.isArray(data.items)) {
                  throw new Error("Resposta invalida da API.");
                }
                totalItems = data.totalItems ?? 0;
                apiTotalPages = data.totalPages ?? 1;
                allItems.push(...data.items);
                page += 1;
              } while (page <= apiTotalPages);

              totalPages = apiTotalPages;

              const bySection = new Map();
              allItems.forEach((job) => {
                const info = getSectionInfo(job.area || "Geral");
                if (!bySection.has(info.title)) {
                  bySection.set(info.title, { info, jobs: [] });
                }
                bySection.get(info.title).jobs.push(job);
              });

              if (reset) {
                grid.replaceChildren();
              }

              let offset = (currentPage - 1) * pageSize;
              bySection.forEach(({ info, jobs }) => {
                grid.appendChild(buildSection(info, jobs, offset));
                offset += jobs.length;
              });
              items = Array.from(grid.querySelectorAll(".job-item"));
              render();
            } catch (err) {
              console.error(err);
              const message = err && err.message ? err.message : "Erro desconhecido";
              showAppAlert("danger", `Nao foi possivel carregar as vagas. ${message}`);
            } finally {
              setGridLoading(false);
              isLoadingPage = false;
            }
          }

          function getFilters() {
            const q = normalize(document.getElementById("q").value);
            const location = document.getElementById("location").value.trim();
            const mode = document.getElementById("mode").value.trim();
            const type = document.getElementById("type").value.trim();
            const level = document.getElementById("level").value.trim();
            const area = document.getElementById("area").value.trim();
            const minSalary = parseNumber(document.getElementById("minSalary").value);

            return { q, location, mode, type, level, area, minSalary };
          }

          function buildQuery(page) {
            const filters = getFilters();
            const params = new URLSearchParams();
            if (filters.q) params.set("q", filters.q);
            if (filters.location) params.set("location", filters.location);
            if (filters.mode) params.set("mode", filters.mode);
            if (filters.type) params.set("type", filters.type);
            if (filters.level) params.set("level", filters.level);
            if (filters.area) params.set("area", filters.area);
            if (filters.minSalary !== null) params.set("minSalary", filters.minSalary);
            params.set("sort", currentSort);
            params.set("page", page);
            params.set("pageSize", pageSize);
            return params.toString();
          }

          function matchesFilters(item, f) {
            return true;
          }

          function sortItems(visibleItems) {
            return visibleItems;
          }

          function render(filters) {
            resultsCount.textContent = String(totalItems);
            emptyState.classList.toggle("d-none", totalItems !== 0);
          }

          function resetFilters() {
            filtersForm.reset();
            currentSort = "recent";
          }

          function resetPaging() {
            currentPage = 1;
            totalPages = 1;
            totalItems = 0;
          }

          if (newJobModalEl) {
            newJobModalEl.addEventListener("show.bs.modal", async () => {
              if (!isAdminUser) {
                setNewJobAlert("Acesso nao autorizado.");
                return;
              }
              clearNewJobAlert();
              try {
                await loadNewJobLookups();
                await populateNewJobUfSelect(newJobUf);
                await populateNewJobCitySelect("", newJobCity);
              } catch (err) {
                console.error(err);
                setNewJobAlert("Nao foi possivel carregar os dados da vaga.");
              }
            });
          }

          if (newJobUf && newJobCity) {
            newJobUf.addEventListener("change", async () => {
              await populateNewJobCitySelect(newJobUf.value, newJobCity);
            });
          }

          if (newJobSalaryMin) {
            newJobSalaryMin.addEventListener("input", () => {
              newJobSalaryMin.value = formatMoneyBR(newJobSalaryMin.value);
            });
          }

          if (newJobSalaryMax) {
            newJobSalaryMax.addEventListener("input", () => {
              newJobSalaryMax.value = formatMoneyBR(newJobSalaryMax.value);
            });
          }

          if (newJobForm) {
            newJobForm.addEventListener("submit", async (event) => {
              event.preventDefault();
              if (!isAdminUser) {
                setNewJobAlert("Acesso nao autorizado.");
                return;
              }

              if (!newJobForm.checkValidity()) {
                newJobForm.classList.add("was-validated");
                newJobForm.reportValidity();
                return;
              }

              clearNewJobAlert();
              toggleNewJobLoading(true);
              try {
                const payload = {
                  titulo: document.getElementById("newJobTitle").value.trim(),
                  departmentId: document.getElementById("newJobDepartment").value,
                  areaId: document.getElementById("newJobArea").value,
                  status: document.getElementById("newJobStatus").value,
                  codigo: null,
                  areaTime: null,
                  modalidade: document.getElementById("newJobModalidade").value || null,
                  senioridade: document.getElementById("newJobSenioridade").value || null,
                  quantidadeVagas: toNumber(document.getElementById("newJobQuantidade").value) ?? 1,
                  tipoContratacao: document.getElementById("newJobTipo").value || null,
                  matchMinimoPercentual: toNumber(document.getElementById("newJobMatch").value) ?? 0,
                  weights: null,
                  descricaoInterna: null,
                  codigoInterno: null,
                  codigoCbo: null,
                  motivoAbertura: null,
                  orcamentoAprovado: null,
                  gestorRequisitante: null,
                  recrutadorResponsavel: null,
                  prioridade: null,
                  resumoPitch: null,
                  tagsResponsabilidadesRaw: document.getElementById("newJobTagsResp").value || null,
                  tagsKeywordsRaw: document.getElementById("newJobTagsKeywords").value || null,
                  confidencial: document.getElementById("newJobConfidencial").checked,
                  aceitaPcd: document.getElementById("newJobAceitaPcd").checked,
                  urgente: document.getElementById("newJobUrgente").checked,
                  generoPreferencia: null,
                  vagaAfirmativa: false,
                  linguagemInclusiva: false,
                  publicoAfirmativo: null,
                  observacoesPcd: null,
                  projetoNome: null,
                  projetoClienteAreaImpactada: null,
                  projetoPrazoPrevisto: null,
                  projetoDescricao: null,
                  regime: null,
                  cargaSemanalHoras: null,
                  escala: null,
                  horaEntrada: null,
                  horaSaida: null,
                  intervalo: null,
                  cep: null,
                  logradouro: null,
                  numero: null,
                  bairro: null,
                  cidade: document.getElementById("newJobCity").value || null,
                  uf: document.getElementById("newJobUf").value || null,
                  politicaTrabalho: null,
                  observacoesDeslocamento: null,
                  moeda: null,
                  salarioMinimo: parseMoneyBR(document.getElementById("newJobSalaryMin").value),
                  salarioMaximo: parseMoneyBR(document.getElementById("newJobSalaryMax").value),
                  periodicidade: null,
                  bonusTipo: null,
                  bonusPercentual: null,
                  observacoesRemuneracao: null,
                  escolaridade: null,
                  formacaoArea: null,
                  experienciaMinimaAnos: null,
                  tagsStackRaw: document.getElementById("newJobTagsStack").value || null,
                  tagsIdiomasRaw: null,
                  diferenciais: null,
                  observacoesProcesso: null,
                  visibilidade: document.getElementById("newJobVisibilidade").value || null,
                  dataInicio: null,
                  dataEncerramento: null,
                  canalLinkedIn: document.getElementById("newJobCanalLinkedIn").checked,
                  canalSiteCarreiras: document.getElementById("newJobCanalSite").checked,
                  canalIndicacao: document.getElementById("newJobCanalIndicacao").checked,
                  canalPortaisEmprego: document.getElementById("newJobCanalPortais").checked,
                  descricaoPublica: document.getElementById("newJobResumo").value || null,
                  lgpdSolicitarConsentimentoExplicito: false,
                  lgpdCompartilharCurriculoInternamente: false,
                  lgpdRetencaoAtiva: false,
                  lgpdRetencaoMeses: null,
                  exigeCnh: false,
                  disponibilidadeParaViagens: false,
                  checagemAntecedentes: false,
                  beneficios: [],
                  requisitos: [],
                  etapas: [],
                  perguntasTriagem: []
                };

                const response = await fetch(`/api/vagas`, {
                  method: "POST",
                  headers: {
                    ...buildAuthHeaders(),
                    "Content-Type": "application/json"
                  },
                  credentials: "same-origin",
                  body: JSON.stringify(payload)
                });

                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                  setNewJobAlert(data.message || "Nao foi possivel criar a vaga.");
                  window.Swal?.fire({
                    icon: "error",
                    title: "Falha ao salvar",
                    text: data.message || "Nao foi possivel criar a vaga."
                  });
                  return;
                }

                newJobModal?.hide();
                if (newJobForm) {
                  newJobForm.reset();
                  newJobForm.classList.remove("was-validated");
                }
                await loadJobs(true);
                window.Swal?.fire({
                  icon: "success",
                  title: "Vaga salva",
                  text: "A vaga foi criada com sucesso."
                });
              } catch (err) {
                console.error(err);
                setNewJobAlert("Falha ao criar a vaga.");
                window.Swal?.fire({
                  icon: "error",
                  title: "Erro inesperado",
                  text: "Nao foi possivel criar a vaga."
                });
              } finally {
                toggleNewJobLoading(false);
              }
            });
          }

          if (backToTopBtn) {
            backToTopBtn.addEventListener("click", () => {
              window.scrollTo({ top: 0, behavior: "smooth" });
            });
          }

          function buildSummary(item) {
            const title = item.dataset.title;
            const company = item.dataset.company;
            const tags = (item.dataset.tags || "").split(",").map(x => x.trim()).filter(Boolean);
            if (!tags.length) return `${title} em ${company}.`;
            return `${title} em ${company}, com foco em ${tags.slice(0, 3).join(", ")}.`;
          }

          function openJobModal(item) {
            currentJob = item;

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
          }

          async function openApplyModalFromCurrentJob() {
            if (!currentJob) {
              showAppAlert("danger", "Nao foi possivel iniciar a candidatura. Abra os detalhes de uma vaga e tente novamente.");
              return;
            }

            clearApplyAlert();
            applyForm.classList.remove("was-validated");
            applyForm.reset();
            setSendLoading(false);
            resetApplyLocation();
            if (salaryInput) salaryInput.dataset.raw = "";

            document.getElementById("applyJobTitle").value = currentJob.dataset.title;
            document.getElementById("applyCompany").value = currentJob.dataset.company;
            document.getElementById("applyModalJobLine").textContent =
              `${currentJob.dataset.title} ? ${currentJob.dataset.company} ? ${currentJob.dataset.mode}`;

            attachmentInput.classList.remove("is-invalid");
            attachmentInvalid.textContent = "Arquivo invalido.";

            await applyProfileToForm();
            jobModal.hide();
            applyModal.show();
          }

          grid.addEventListener("click", (ev) => {
            const link = ev.target.closest("a.job-link");
            if (!link) return;
            ev.preventDefault();
            const jobItem = ev.target.closest(".job-item");
            if (!jobItem) return;
            openJobModal(jobItem);
          });

          jobModalApplyBtn.addEventListener("click", async () => {
            await openApplyModalFromCurrentJob();
          });

          function validateAttachment() {
            const file = attachmentInput.files && attachmentInput.files[0] ? attachmentInput.files[0] : null;
            attachmentInput.classList.remove("is-invalid");

            if (!file) return true;

            const maxBytes = 5 * 1024 * 1024; // 5MB
            if (file.size > maxBytes) {
              attachmentInvalid.textContent = "O arquivo excede 5MB. Selecione um arquivo menor.";
              attachmentInput.classList.add("is-invalid");
              return false;
            }

            const allowedExt = [".pdf", ".doc", ".docx"];
            const name = (file.name || "").toLowerCase();
            const okExt = allowedExt.some(ext => name.endsWith(ext));

            if (!okExt) {
              attachmentInvalid.textContent = "Formato nao aceito. Use PDF, DOC ou DOCX.";
              attachmentInput.classList.add("is-invalid");
              return false;
            }

            return true;
          }

          attachmentInput.addEventListener("change", () => {
            try {
              validateAttachment();
            } catch (err) {
              console.error(err);
              showApplyAlert("Nao foi possivel validar o arquivo selecionado.");
            }
          });

          applyForm.addEventListener("submit", async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();

            try {
              clearApplyAlert();
              applyForm.classList.add("was-validated");

              const isFormValid = applyForm.checkValidity();
              const isAttachmentValid = validateAttachment();

              if (!isFormValid || !isAttachmentValid) {
                showApplyAlert("Revise os campos destacados antes de enviar.");
                scrollToFirstInvalid();
                return;
              }

              setSendLoading(true);

              if (!tenantId) {
                showApplyAlert("Tenant nao informado. Recarregue a pagina e tente novamente.");
                setSendLoading(false);
                return;
              }

              const formData = new FormData();
              formData.append("vagaId", currentJob?.dataset?.id || "");
              formData.append("nome", document.getElementById("fullName").value || "");
              formData.append("email", document.getElementById("email").value || "");
              formData.append("fone", document.getElementById("phone").value || "");
              const uf = document.getElementById("candidateUf").value || "";
              const city = document.getElementById("candidateCity").value || "";
              const cidadeUf = (city && uf) ? `${city}, ${uf}` : (city || uf);
              formData.append("cidadeUf", cidadeUf);
              formData.append("linkedin", document.getElementById("linkedin").value || "");
              formData.append("portfolio", document.getElementById("portfolio").value || "");
              formData.append("cargoAtual", document.getElementById("currentRole").value || "");
              formData.append("anosExperiencia", document.getElementById("experienceYears").value || "");

              const obsParts = [];
              const highlights = document.getElementById("highlights").value || "";
              const notes = document.getElementById("recruiterNotes").value || "";
              const salaryRaw = salaryInput?.dataset?.raw || digitsOnly(salaryInput?.value || "");
              const salary = salaryRaw ? `R$ ${Number(salaryRaw).toLocaleString("pt-BR")}` : "";
              const availability = document.getElementById("availability").value || "";

              if (highlights) obsParts.push(`Resumo: ${highlights}`);
              if (notes) obsParts.push(`Info: ${notes}`);
              if (salary) obsParts.push(`Pretensao salarial: ${salary}`);
              if (availability) obsParts.push(`Disponibilidade: ${availability}`);

              formData.append("observacoes", obsParts.join(" | "));

              if (attachmentInput.files?.[0]) {
                formData.append("arquivo", attachmentInput.files[0]);
              }

              const url = `${apiBase}/api/public/candidaturas?tenantId=${encodeURIComponent(tenantId)}`;
              const response = await fetch(url, {
                method: "POST",
                headers: {
                  "X-Tenant-Id": tenantId
                },
                body: formData
              });

              if (!response.ok) {
                const body = await response.text();
                throw new Error(body || `HTTP ${response.status}`);
              }

              applyModal.hide();
              if (window.Swal && typeof window.Swal.fire === "function") {
                window.Swal.fire({
                  icon: "success",
                  title: "Candidatura enviada",
                  text: "Em breve voce recebera um email com uma chave unica para acessar o portal futuramente.",
                  confirmButtonText: "Ok"
                });
              } else {
                showAppAlert("success", "Candidatura enviada com sucesso. Voce recebera um email com uma chave unica para acessar o portal futuramente.");
              }

              document.querySelector("main")?.scrollIntoView({ behavior: "smooth", block: "start" });
            } catch (err) {
              console.error(err);
              showApplyAlert("Ocorreu um erro ao enviar sua candidatura. Tente novamente.");
            } finally {
              setSendLoading(false);
            }
          });

          // Aplicar filtros
          filtersForm.addEventListener("submit", (ev) => {
            ev.preventDefault();
            try {
              setLoading(true);
              (async () => {
                resetPaging();
                await loadJobs(true);
                setLoading(false);
                closeFiltersDrawer();
              })();
            } catch (err) {
              setLoading(false);
              console.error(err);
              showAppAlert("danger", "Ocorreu um erro ao aplicar filtros. Verifique os campos e tente novamente.");
            }
          });

          searchBtn?.addEventListener("click", () => {
            filtersForm.requestSubmit();
          });

          searchClearBtn?.addEventListener("click", () => {
            const qInput = document.getElementById("q");
            if (qInput) qInput.value = "";
            filtersForm.requestSubmit();
          });

          // Limpar filtros
          clearBtn.addEventListener("click", () => {
            try {
              setLoading(true);
              (async () => {
                resetPaging();
                resetFilters();
                await loadJobs(true);
                setLoading(false);
                closeFiltersDrawer();
              })();
            } catch (err) {
              setLoading(false);
              console.error(err);
              showAppAlert("danger", "Ocorreu um erro ao limpar filtros. Recarregue a página e tente novamente.");
            }
          });
          emptyClearBtn.addEventListener("click", () => clearBtn.click());

          // Ordenação
          document.addEventListener("click", (ev) => {
            const btn = ev.target.closest("[data-sort]");
            if (!btn) return;

            try {
              currentSort = btn.getAttribute("data-sort");
              setLoading(true);
              (async () => {
                resetPaging();
                await loadJobs(true);
                setLoading(false);
                closeFiltersDrawer();
              })();
            } catch (err) {
              setLoading(false);
              console.error(err);
              showAppAlert("danger", "Ocorreu um erro ao ordenar os resultados. Tente novamente.");
            }
          });

          if (ufSelect) {
            ufSelect.addEventListener("change", () => {
              loadCitiesForUf(ufSelect.value);
            });
          }

          setupApplyMasks();
          resetApplyLocation();

          // Render inicial
          try {
            await loadJobs(true);
          } catch (err) {
            console.error(err);
            showAppAlert("danger", "Ocorreu um erro ao carregar a página. Recarregue e tente novamente.");
          }
        })();
    
