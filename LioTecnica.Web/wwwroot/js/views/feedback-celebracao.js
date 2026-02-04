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

    let currentPage = 1;
    let totalCount = 0;
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

    function showFeedLoading(show) {
        if (feedLoading) feedLoading.classList.toggle("d-none", !show);
    }

    async function loadFeed(page) {
        if (page === 1) {
            showFeedLoading(true);
            currentPage = 1;
        }
        try {
            const data = await apiGet(`${API_BASE}/feed?page=${page}&pageSize=${PAGE_SIZE}`);
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
        } catch (e) {
            console.error(e);
            if (feedList) feedList.innerHTML = "<div class=\"text-danger\">Erro ao carregar o feed.</div>";
        } finally {
            showFeedLoading(false);
        }
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

    updateCharCount();
    loadFeed(1);
})();
