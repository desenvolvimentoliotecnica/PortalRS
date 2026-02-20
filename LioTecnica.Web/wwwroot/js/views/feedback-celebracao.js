(function () {
    "use strict";

    const API_BASE = "/Feedback/_api/celebrations";
    const PAGE_SIZE = 20;

    const feedList = document.getElementById("feedList");
    const feedEmpty = document.getElementById("feedEmpty");
    const feedLoading = document.getElementById("feedLoading");
    const feedLoadMore = document.getElementById("feedLoadMore");
    const btnLoadMore = document.getElementById("btnLoadMore");
    const postContent = document.getElementById("postContent");
    const btnPost = document.getElementById("btnPost");
    const btnRefresh = document.getElementById("btnRefresh");
    const mentionDropdown = document.getElementById("mentionDropdown");
    const charCount = document.getElementById("charCount");
    const btnFilterAll = document.getElementById("btnFilterAll");
    const btnFilterSent = document.getElementById("btnFilterSent");
    const btnFilterReceived = document.getElementById("btnFilterReceived");
    const filterFrom = document.getElementById("filterFrom");
    const filterTo = document.getElementById("filterTo");
    const btnApplyFilters = document.getElementById("btnApplyFilters");
    const btnClearFilters = document.getElementById("btnClearFilters");

    let currentPage = 1;
    let totalCount = 0;
    let currentFilter = "all";
    let currentFrom = "";
    let currentTo = "";
    let mentionStart = 0;
    let mentionQuery = "";
    let mentionTimeout = null;
    const storedMentions = {}; // fullName -> id

    async function apiGet(url) {
        const res = await fetch(url, { headers: { Accept: "application/json" } });
        if (!res.ok) throw new Error("Falha na API: " + res.status);
        return res.status === 204 ? null : res.json();
    }

    async function apiPost(url, body) {
        const res = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error("Falha na API: " + res.status);
        return res.status === 204 ? null : res.json();
    }

    function formatDate(iso) {
        if (!iso) return "";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        const now = new Date();
        const diffMs = now - d;
        if (diffMs < 60000) return "Agora";
        if (diffMs < 3600000) return Math.floor(diffMs / 60000) + " min atrás";
        if (diffMs < 86400000) return Math.floor(diffMs / 3600000) + " h atrás";
        return d.toLocaleDateString(undefined, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    }

    function renderPost(post) {
        const mentions = (post.mentions || []).map(m => `<span class="badge bg-light text-dark">@${escapeHtml(m.fullName)}</span>`).join(" ");
        return `
            <div class="border-bottom pb-3 mb-3 celebration-post" data-id="${post.id}">
                <div class="d-flex align-items-start gap-2">
                    <div class="rounded-circle bg-primary bg-opacity-25 d-flex align-items-center justify-content-center text-primary fw-bold" style="width:40px;height:40px;">${(post.authorFullName || "").charAt(0).toUpperCase()}</div>
                    <div class="flex-grow-1">
                        <div class="fw-semibold">${escapeHtml(post.authorFullName || "")}</div>
                        <div class="text-muted small">${formatDate(post.createdAtUtc)}</div>
                        <div class="mt-2 text-break">${escapeHtml(post.content)}</div>
                        ${mentions ? `<div class="mt-1 small">${mentions}</div>` : ""}
                        <div class="mt-2">
                            <button type="button" class="btn btn-ghost btn-sm btn-toggle-comments" data-id="${post.id}">
                                <i class="bi bi-chat-left-text me-1"></i>Comentários
                            </button>
                        </div>
                        <div class="comments-panel d-none mt-2" data-post-id="${post.id}">
                            <div class="comments-list small"></div>
                            <div class="text-muted small comments-empty d-none">Nenhum comentário ainda.</div>
                            <div class="text-muted small comments-loading d-none">Carregando...</div>
                            <div class="mt-2 position-relative">
                                <textarea class="form-control form-control-sm comment-content" rows="2" placeholder="Escreva um comentário... Use @nome para marcar"></textarea>
                                <div class="list-group position-absolute shadow d-none comment-mention-dropdown" style="z-index: 1050; max-height: 200px; overflow-y: auto;"></div>
                                <div class="d-flex justify-content-end mt-2">
                                    <button type="button" class="btn btn-brand btn-sm btn-send-comment" data-id="${post.id}">Enviar</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
    }

    function escapeHtml(s) {
        if (!s) return "";
        const div = document.createElement("div");
        div.textContent = s;
        return div.innerHTML;
    }

    function renderComment(c) {
        const mentions = (c.mentions || []).map(m => `<span class="badge bg-light text-dark">@${escapeHtml(m.fullName)}</span>`).join(" ");
        const like = (c.reactions || []).find(r => ((r.type || "").toLowerCase() === "like")) || { count: 0, reactedByMe: false };
        const likeTextClass = like.reactedByMe ? "text-primary" : "text-muted";
        return `
            <div class="py-2 border-top">
                <div class="d-flex justify-content-between gap-2">
                    <div class="fw-semibold">${escapeHtml(c.authorFullName || "")}</div>
                    <div class="text-muted">${formatDate(c.createdAtUtc)}</div>
                </div>
                <div class="mt-1 text-break">${escapeHtml(c.content || "")}</div>
                ${mentions ? `<div class="mt-1">${mentions}</div>` : ""}
                <div class="mt-1 d-flex gap-2 align-items-center">
                    <button type="button" class="btn btn-ghost btn-sm btn-like-comment ${likeTextClass}" data-comment-id="${c.id}">
                        <i class="bi bi-hand-thumbs-up me-1"></i><span class="like-count">${like.count || 0}</span>
                    </button>
                </div>
            </div>`;
    }

    function showFeedLoading(show) {
        if (feedLoading) feedLoading.classList.toggle("d-none", !show);
    }

    function toUtcIsoStartOfDay(dateStr) {
        if (!dateStr) return "";
        // dateStr: YYYY-MM-DD (from <input type="date">). Build UTC ISO.
        return new Date(dateStr + "T00:00:00.000Z").toISOString();
    }

    function toUtcIsoEndOfDay(dateStr) {
        if (!dateStr) return "";
        return new Date(dateStr + "T23:59:59.999Z").toISOString();
    }

    function buildFeedUrl(page) {
        const qs = new URLSearchParams();
        qs.set("page", String(page));
        qs.set("pageSize", String(PAGE_SIZE));
        if (currentFilter && currentFilter !== "all") qs.set("filter", currentFilter);
        if (currentFrom) qs.set("from", toUtcIsoStartOfDay(currentFrom));
        if (currentTo) qs.set("to", toUtcIsoEndOfDay(currentTo));
        return `${API_BASE}/feed?${qs.toString()}`;
    }

    async function loadFeed(page) {
        if (page === 1) {
            showFeedLoading(true);
            currentPage = 1;
        }
        try {
            const data = await apiGet(buildFeedUrl(page));
            if (page === 1) {
                feedList.innerHTML = "";
                if (feedEmpty) feedEmpty.classList.add("d-none");
            }
            (data.items || []).forEach(p => {
                feedList.insertAdjacentHTML("beforeend", renderPost(p));
            });
            totalCount = data.totalCount || 0;
            if (feedLoadMore) {
                const hasMore = page * PAGE_SIZE < totalCount;
                feedLoadMore.classList.toggle("d-none", !hasMore);
            }
            if (page === 1 && (!data.items || data.items.length === 0) && feedEmpty) feedEmpty.classList.remove("d-none");
            currentPage = page;
            bindCommentsHandlers();
        } catch (e) {
            console.error(e);
            if (feedList) feedList.innerHTML = "<div class=\"text-danger\">Erro ao carregar o feed.</div>";
        } finally {
            showFeedLoading(false);
        }
    }

    async function loadComments(postId, panel) {
        if (!postId || !panel) return;
        const list = panel.querySelector(".comments-list");
        const empty = panel.querySelector(".comments-empty");
        const loading = panel.querySelector(".comments-loading");
        if (loading) loading.classList.remove("d-none");
        if (empty) empty.classList.add("d-none");
        try {
            const data = await apiGet(`${API_BASE}/${encodeURIComponent(postId)}/comments?page=1&pageSize=50`);
            if (list) list.innerHTML = "";
            const items = (data && data.items) ? data.items : [];
            items.forEach(c => list && list.insertAdjacentHTML("beforeend", renderComment(c)));
            if (items.length === 0 && empty) empty.classList.remove("d-none");
        } catch (e) {
            console.error(e);
            if (list) list.innerHTML = "<div class=\"text-danger\">Erro ao carregar comentários.</div>";
        } finally {
            if (loading) loading.classList.add("d-none");
        }
    }

    async function submitComment(postId, panel) {
        if (!postId || !panel) return;
        const textarea = panel.querySelector(".comment-content");
        const content = (textarea && textarea.value) ? textarea.value.trim() : "";
        if (!content) return;

        const mentionStore = panel.__mentions || {};
        const regex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
        const ids = new Set();
        let m;
        while ((m = regex.exec(content)) !== null) {
            const fullName = (m[1] || "").trim();
            if (mentionStore[fullName]) ids.add(mentionStore[fullName]);
        }

        const btn = panel.querySelector(".btn-send-comment");
        if (btn) btn.disabled = true;
        try {
            await apiPost(`${API_BASE}/${encodeURIComponent(postId)}/comments`, { content, mentionedUserIds: [...ids] });
            if (textarea) textarea.value = "";
            await loadComments(postId, panel);
        } catch (e) {
            console.error(e);
            alert("Erro ao comentar. Tente novamente.");
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function bindCommentsHandlers() {
        if (!feedList) return;
        feedList.querySelectorAll(".btn-toggle-comments").forEach(btn => {
            if (btn.dataset.bound === "1") return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", async () => {
                const postId = btn.getAttribute("data-id");
                const root = btn.closest(".celebration-post");
                const panel = root ? root.querySelector(`.comments-panel[data-post-id="${postId}"]`) : null;
                if (!panel) return;
                const willShow = panel.classList.contains("d-none");
                panel.classList.toggle("d-none", !willShow);
                if (willShow) {
                    bindCommentMention(panel);
                    await loadComments(postId, panel);
                }
            });
        });
        feedList.querySelectorAll(".btn-send-comment").forEach(btn => {
            if (btn.dataset.bound === "1") return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", async () => {
                const postId = btn.getAttribute("data-id");
                const panel = btn.closest(".comments-panel");
                await submitComment(postId, panel);
            });
        });

        feedList.querySelectorAll(".btn-like-comment").forEach(btn => {
            if (btn.dataset.bound === "1") return;
            btn.dataset.bound = "1";
            btn.addEventListener("click", async () => {
                const commentId = btn.getAttribute("data-comment-id");
                if (!commentId) return;
                btn.disabled = true;
                try {
                    const resp = await apiPost(`${API_BASE}/comments/${encodeURIComponent(commentId)}/reactions`, { type: "like" });
                    const count = resp && typeof resp.count === "number" ? resp.count : null;
                    const reacted = resp && typeof resp.reactedByMe === "boolean" ? resp.reactedByMe : null;
                    const countEl = btn.querySelector(".like-count");
                    if (countEl && count !== null) countEl.textContent = String(count);
                    if (reacted !== null) {
                        btn.classList.toggle("text-primary", reacted);
                        btn.classList.toggle("text-muted", !reacted);
                    }
                } catch (e) {
                    console.error(e);
                    alert("Erro ao reagir. Tente novamente.");
                } finally {
                    btn.disabled = false;
                }
            });
        });
    }

    function bindCommentMention(panel) {
        if (!panel || panel.dataset.mentionBound === "1") return;
        panel.dataset.mentionBound = "1";

        panel.__mentions = panel.__mentions || {};
        const textarea = panel.querySelector(".comment-content");
        const dropdown = panel.querySelector(".comment-mention-dropdown");
        if (!textarea || !dropdown) return;

        let mentionStartLocal = 0;
        let mentionTimeoutLocal = null;

        function showDropdown(users) {
            dropdown.innerHTML = "";
            dropdown.classList.remove("d-none");
            (users || []).forEach(u => {
                const a = document.createElement("a");
                a.href = "#";
                a.className = "list-group-item list-group-item-action";
                a.textContent = u.fullName || u.email || "";
                a.addEventListener("click", function (e) {
                    e.preventDefault();
                    insertMention(u.id, u.fullName || "");
                    dropdown.classList.add("d-none");
                });
                dropdown.appendChild(a);
            });
            if (dropdown.children.length === 0) {
                const empty = document.createElement("div");
                empty.className = "list-group-item text-muted";
                empty.textContent = "Nenhum colaborador encontrado";
                dropdown.appendChild(empty);
            }
        }

        function insertMention(userId, fullName) {
            const before = textarea.value.substring(0, mentionStartLocal);
            const after = textarea.value.substring(textarea.selectionStart || textarea.value.length);
            const insert = "@" + fullName + " ";
            textarea.value = before + insert + after;
            textarea.focus();
            textarea.selectionStart = textarea.selectionEnd = before.length + insert.length;
            panel.__mentions[fullName] = userId;
        }

        async function fetchUsers(q) {
            try {
                const url = `${API_BASE}/mention-users?take=10` + (q ? "&q=" + encodeURIComponent(q) : "");
                const users = await apiGet(url);
                showDropdown(users || []);
            } catch (e) {
                console.error(e);
                showDropdown([]);
            }
        }

        function onInput() {
            const val = textarea.value;
            const cursor = textarea.selectionStart || 0;
            const beforeCursor = val.substring(0, cursor);
            const atIndex = beforeCursor.lastIndexOf("@");
            if (atIndex === -1) {
                dropdown.classList.add("d-none");
                return;
            }
            const afterAt = beforeCursor.substring(atIndex + 1);
            if (/\s/.test(afterAt)) {
                dropdown.classList.add("d-none");
                return;
            }
            mentionStartLocal = atIndex;
            clearTimeout(mentionTimeoutLocal);
            mentionTimeoutLocal = setTimeout(() => fetchUsers(afterAt), 200);
        }

        textarea.addEventListener("input", onInput);
        textarea.addEventListener("keydown", (e) => {
            if (e.key === "Escape") dropdown.classList.add("d-none");
        });
    }

    function updateCharCount() {
        const len = (postContent && postContent.value) ? postContent.value.length : 0;
        if (charCount) charCount.textContent = len;
    }

    function showMentionDropdown(users) {
        if (!mentionDropdown) return;
        mentionDropdown.innerHTML = "";
        mentionDropdown.classList.remove("d-none");
        (users || []).forEach(u => {
            const a = document.createElement("a");
            a.href = "#";
            a.className = "list-group-item list-group-item-action";
            a.textContent = u.fullName || u.email || "";
            a.dataset.id = u.id;
            a.dataset.fullName = u.fullName || "";
            a.addEventListener("click", function (e) {
                e.preventDefault();
                insertMention(u.id, u.fullName || "");
                mentionDropdown.classList.add("d-none");
            });
            mentionDropdown.appendChild(a);
        });
        if (mentionDropdown.children.length === 0) {
            const empty = document.createElement("div");
            empty.className = "list-group-item text-muted";
            empty.textContent = "Nenhum colaborador encontrado";
            mentionDropdown.appendChild(empty);
        }
    }

    function insertMention(userId, fullName) {
        if (!postContent) return;
        const before = postContent.value.substring(0, mentionStart);
        const after = postContent.value.substring(postContent.selectionStart || postContent.value.length);
        const insert = "@" + fullName + " ";
        postContent.value = before + insert + after;
        postContent.focus();
        postContent.selectionStart = postContent.selectionEnd = before.length + insert.length;
        storedMentions[fullName] = userId;
        updateCharCount();
    }

    async function fetchMentionUsers(q) {
        try {
            const url = `${API_BASE}/mention-users?take=10` + (q ? "&q=" + encodeURIComponent(q) : "");
            const users = await apiGet(url);
            showMentionDropdown(users || []);
        } catch (e) {
            console.error(e);
            showMentionDropdown([]);
        }
    }

    function onPostContentInput() {
        updateCharCount();
        const val = postContent.value;
        const cursor = postContent.selectionStart || 0;
        const beforeCursor = val.substring(0, cursor);
        const atIndex = beforeCursor.lastIndexOf("@");
        if (atIndex === -1) {
            mentionDropdown.classList.add("d-none");
            return;
        }
        const afterAt = beforeCursor.substring(atIndex + 1);
        if (/\s/.test(afterAt)) {
            mentionDropdown.classList.add("d-none");
            return;
        }
        mentionStart = atIndex;
        mentionQuery = afterAt;
        clearTimeout(mentionTimeout);
        mentionTimeout = setTimeout(function () {
            fetchMentionUsers(mentionQuery);
        }, 200);
    }

    function collectMentionedIds() {
        const content = postContent.value || "";
        const regex = /@([^@\s]+(?:\s+[^@\s]+)*)/g;
        const ids = new Set();
        let m;
        while ((m = regex.exec(content)) !== null) {
            const fullName = m[1].trim();
            if (storedMentions[fullName]) ids.add(storedMentions[fullName]);
        }
        return [...ids];
    }

    async function submitPost() {
        const content = (postContent.value || "").trim();
        if (!content) return;
        const mentionedUserIds = collectMentionedIds();
        btnPost.disabled = true;
        try {
            await apiPost(API_BASE, { content, mentionedUserIds });
            postContent.value = "";
            Object.keys(storedMentions).forEach(k => delete storedMentions[k]);
            updateCharCount();
            await loadFeed(1);
        } catch (e) {
            console.error(e);
            alert("Erro ao publicar. Tente novamente.");
        } finally {
            btnPost.disabled = false;
        }
    }

    if (postContent) {
        postContent.addEventListener("input", onPostContentInput);
        postContent.addEventListener("keydown", function (e) {
            if (e.key === "Escape") mentionDropdown.classList.add("d-none");
        });
    }
    if (btnPost) btnPost.addEventListener("click", submitPost);
    if (btnRefresh) btnRefresh.addEventListener("click", () => loadFeed(1));
    if (btnLoadMore) btnLoadMore.addEventListener("click", function () {
        currentPage++;
        loadFeed(currentPage);
    });

    function setFilter(filter) {
        currentFilter = filter || "all";
        [btnFilterAll, btnFilterSent, btnFilterReceived].forEach(b => b && b.classList.remove("active"));
        if (currentFilter === "sent") btnFilterSent && btnFilterSent.classList.add("active");
        else if (currentFilter === "received") btnFilterReceived && btnFilterReceived.classList.add("active");
        else btnFilterAll && btnFilterAll.classList.add("active");
    }

    function applyFiltersFromUi() {
        currentFrom = (filterFrom && filterFrom.value) ? filterFrom.value : "";
        currentTo = (filterTo && filterTo.value) ? filterTo.value : "";
        loadFeed(1);
    }

    function clearFilters() {
        setFilter("all");
        currentFrom = "";
        currentTo = "";
        if (filterFrom) filterFrom.value = "";
        if (filterTo) filterTo.value = "";
        loadFeed(1);
    }

    if (btnFilterAll) btnFilterAll.addEventListener("click", () => { setFilter("all"); loadFeed(1); });
    if (btnFilterSent) btnFilterSent.addEventListener("click", () => { setFilter("sent"); loadFeed(1); });
    if (btnFilterReceived) btnFilterReceived.addEventListener("click", () => { setFilter("received"); loadFeed(1); });
    if (btnApplyFilters) btnApplyFilters.addEventListener("click", applyFiltersFromUi);
    if (btnClearFilters) btnClearFilters.addEventListener("click", clearFilters);

    updateCharCount();
    loadFeed(1);
})();
