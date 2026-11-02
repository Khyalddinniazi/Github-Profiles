const API_URL = "https://api.github.com/users/";
const DEFAULT_USER = "khyalddinniazi";
const REPOS_PER_PAGE = 10;
const HISTORY_SIZE = 5;
const HISTORY_KEY = "gh-profiles:history";
const THEME_KEY = "gh-profiles:theme";

const LANG_COLORS = {
    JavaScript: "#f1e05a",
    TypeScript: "#3178c6",
    Python: "#3572a5",
    HTML: "#e34c26",
    CSS: "#563d7c",
    SCSS: "#c6538c",
    Java: "#b07219",
    "C++": "#f34b7d",
    C: "#555555",
    "C#": "#178600",
    Go: "#00add8",
    Rust: "#dea584",
    Ruby: "#701516",
    PHP: "#4f5d95",
    Swift: "#f05138",
    Kotlin: "#a97bff",
    Dart: "#00b4ab",
    Shell: "#89e051",
    Vue: "#41b883",
    "Jupyter Notebook": "#da5b0b",
};

const SORTERS = {
    stars: (a, b) => b.stargazers_count - a.stargazers_count,
    updated: (a, b) => new Date(b.pushed_at) - new Date(a.pushed_at),
    name: (a, b) => a.name.localeCompare(b.name),
};

const COMPARE_STATS = [
    ["Followers", (p) => p.user.followers],
    ["Public repos", (p) => p.user.public_repos],
    ["Total stars", (p) => totalStars(p.repos)],
    ["Gists", (p) => p.user.public_gists],
];

const main = document.getElementById("main");
const form = document.getElementById("form");
const search = document.getElementById("search");
const compareSearch = document.getElementById("compare-search");
const compareToggle = document.getElementById("compare-toggle");
const themeToggle = document.getElementById("theme-toggle");
const recent = document.getElementById("recent");

// Repos of the profile currently shown, so sorting/filtering never refetches
const state = { repos: [], sort: "stars", language: "all", shown: REPOS_PER_PAGE };
let compareMode = false;
let requestId = 0;

/* ---------- API ---------- */

class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.status = status;
    }
}

async function fetchJSON(url) {
    let resp;
    try {
        resp = await fetch(url);
    } catch {
        throw new ApiError("Network error. Check your connection and try again.");
    }

    if (resp.status === 403 || resp.status === 429) {
        const reset = resp.headers.get("X-RateLimit-Reset");
        const when = reset
            ? ` Try again at ${new Date(reset * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.`
            : "";
        throw new ApiError(`GitHub API rate limit reached.${when}`, resp.status);
    }
    if (!resp.ok) throw new ApiError(`GitHub returned an error (${resp.status}).`, resp.status);

    return resp.json();
}

async function fetchProfile(username) {
    const path = API_URL + encodeURIComponent(username);
    try {
        const [user, repos] = await Promise.all([
            fetchJSON(path),
            fetchJSON(`${path}/repos?per_page=100&sort=updated`),
        ]);
        return { user, repos };
    } catch (err) {
        if (err.status === 404) err.message = `No profile found for "${username}".`;
        throw err;
    }
}

/* ---------- Helpers ---------- */

function escapeHTML(value) {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return String(value ?? "").replace(/[&<>"']/g, (c) => entities[c]);
}

const compactNumber = new Intl.NumberFormat("en", { notation: "compact" });
const formatNumber = (n) => compactNumber.format(n ?? 0);

const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function timeAgo(dateStr) {
    const seconds = (new Date(dateStr) - Date.now()) / 1000;
    const units = [
        ["year", 31536000],
        ["month", 2592000],
        ["week", 604800],
        ["day", 86400],
        ["hour", 3600],
        ["minute", 60],
    ];
    for (const [unit, size] of units) {
        if (Math.abs(seconds) >= size) return relativeTime.format(Math.round(seconds / size), unit);
    }
    return "just now";
}

function formatJoinDate(dateStr) {
    return new Date(dateStr).toLocaleDateString("en", { month: "short", year: "numeric" });
}

function normalizeUrl(url) {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
}

const langColor = (lang) => LANG_COLORS[lang] || "#8b8b8b";
const totalStars = (repos) => repos.reduce((sum, r) => sum + r.stargazers_count, 0);

// [language, repoCount] pairs, most used first
function languageStats(repos) {
    const counts = {};
    repos.forEach((r) => {
        if (r.language) counts[r.language] = (counts[r.language] || 0) + 1;
    });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

/* ---------- Rendering ---------- */

function renderLoading() {
    main.innerHTML = `
        <div class="loader" role="status">
            <span class="spinner"></span>
            Loading…
        </div>
    `;
}

function renderError(message) {
    main.innerHTML = `
        <div class="card error-card">
            <span class="error-icon">😕</span>
            <p>${escapeHTML(message)}</p>
        </div>
    `;
}

function profileHTML(user, { showCounts = true } = {}) {
    const name = escapeHTML(user.name || user.login);
    const profileUrl = escapeHTML(user.html_url);

    const meta = [
        user.location && `<li>📍 ${escapeHTML(user.location)}</li>`,
        user.company && `<li>🏢 ${escapeHTML(user.company)}</li>`,
        user.blog &&
            `<li>🔗 <a href="${escapeHTML(normalizeUrl(user.blog))}" target="_blank" rel="noopener">${escapeHTML(
                user.blog.replace(/^https?:\/\//i, "")
            )}</a></li>`,
        user.twitter_username &&
            `<li>🐦 <a href="https://x.com/${encodeURIComponent(user.twitter_username)}" target="_blank" rel="noopener">@${escapeHTML(
                user.twitter_username
            )}</a></li>`,
        `<li>📅 Joined ${formatJoinDate(user.created_at)}</li>`,
    ]
        .filter(Boolean)
        .join("");

    const counts = showCounts
        ? `
            <ul class="info">
                <li><strong>${formatNumber(user.followers)}</strong>Followers</li>
                <li><strong>${formatNumber(user.following)}</strong>Following</li>
                <li><strong>${formatNumber(user.public_repos)}</strong>Repos</li>
            </ul>
        `
        : "";

    return `
        <div class="profile">
            <a href="${profileUrl}" target="_blank" rel="noopener" class="avatar-link">
                <img class="avatar" src="${escapeHTML(user.avatar_url)}" alt="${name}'s avatar" />
            </a>
            <div class="user-info">
                <h2>${name}</h2>
                <a class="login" href="${profileUrl}" target="_blank" rel="noopener">@${escapeHTML(user.login)}</a>
                ${user.bio ? `<p class="bio">${escapeHTML(user.bio)}</p>` : ""}
                <ul class="meta">${meta}</ul>
                ${counts}
            </div>
        </div>
    `;
}

function languagesHTML(repos) {
    const stats = languageStats(repos);
    if (!stats.length) return "";

    const total = stats.reduce((sum, [, count]) => sum + count, 0);
    const top = stats.slice(0, 6);
    const otherCount = stats.slice(6).reduce((sum, [, count]) => sum + count, 0);
    if (otherCount) top.push(["Other", otherCount]);

    const segments = top
        .map(([lang, count]) => {
            const pct = ((count / total) * 100).toFixed(1);
            return `<span style="width: ${pct}%; background: ${langColor(lang)}" title="${escapeHTML(lang)} ${pct}%"></span>`;
        })
        .join("");

    const legend = top
        .map(([lang, count]) => {
            const pct = Math.round((count / total) * 100);
            return `<li><span class="dot" style="background: ${langColor(lang)}"></span>${escapeHTML(lang)} <small>${pct}%</small></li>`;
        })
        .join("");

    return `
        <section class="languages">
            <h3>Top languages</h3>
            <div class="lang-bar">${segments}</div>
            <ul class="lang-legend">${legend}</ul>
        </section>
    `;
}

function repoCardHTML(repo) {
    return `
        <a class="repo" href="${escapeHTML(repo.html_url)}" target="_blank" rel="noopener">
            <span class="repo-name">
                ${escapeHTML(repo.name)}
                ${repo.fork ? `<span class="badge">fork</span>` : ""}
            </span>
            ${repo.description ? `<p class="repo-desc">${escapeHTML(repo.description)}</p>` : ""}
            <span class="repo-stats">
                ${
                    repo.language
                        ? `<span><span class="dot" style="background: ${langColor(repo.language)}"></span>${escapeHTML(repo.language)}</span>`
                        : ""
                }
                <span>⭐ ${formatNumber(repo.stargazers_count)}</span>
                <span>🍴 ${formatNumber(repo.forks_count)}</span>
                <span>Updated ${timeAgo(repo.pushed_at)}</span>
            </span>
        </a>
    `;
}

function renderProfile({ user, repos }) {
    Object.assign(state, { repos, sort: "stars", language: "all", shown: REPOS_PER_PAGE });

    const languageOptions = languageStats(repos)
        .map(([lang]) => `<option value="${escapeHTML(lang)}">${escapeHTML(lang)}</option>`)
        .join("");

    const reposSection = repos.length
        ? `
            <section class="repos-section">
                <div class="repo-controls">
                    <h3>Repositories</h3>
                    <label>
                        Sort
                        <select id="sort">
                            <option value="stars">Most stars</option>
                            <option value="updated">Recently updated</option>
                            <option value="name">Name</option>
                        </select>
                    </label>
                    <label>
                        Language
                        <select id="language">
                            <option value="all">All</option>
                            ${languageOptions}
                        </select>
                    </label>
                </div>
                <div class="repo-list" id="repo-list"></div>
                <button type="button" id="show-more" class="btn">Show more</button>
            </section>
        `
        : `<p class="empty">No public repositories yet.</p>`;

    main.innerHTML = `
        <article class="card">
            ${profileHTML(user)}
            ${languagesHTML(repos)}
            ${reposSection}
        </article>
    `;

    if (!repos.length) return;

    document.getElementById("sort").addEventListener("change", (e) => {
        state.sort = e.target.value;
        state.shown = REPOS_PER_PAGE;
        renderRepos();
    });
    document.getElementById("language").addEventListener("change", (e) => {
        state.language = e.target.value;
        state.shown = REPOS_PER_PAGE;
        renderRepos();
    });
    document.getElementById("show-more").addEventListener("click", () => {
        state.shown += REPOS_PER_PAGE;
        renderRepos();
    });

    renderRepos();
}

function renderRepos() {
    const filtered =
        state.language === "all" ? state.repos : state.repos.filter((r) => r.language === state.language);
    const sorted = [...filtered].sort(SORTERS[state.sort]);

    document.getElementById("repo-list").innerHTML =
        sorted.slice(0, state.shown).map(repoCardHTML).join("") || `<p class="empty">No repositories match.</p>`;
    document.getElementById("show-more").hidden = sorted.length <= state.shown;
}

function compareCardHTML(profile, other) {
    const rows = COMPARE_STATS.map(([label, getValue]) => {
        const mine = getValue(profile);
        const theirs = getValue(other);
        return `
            <li class="${mine > theirs ? "winner" : ""}">
                <span>${label}</span>
                <strong>${formatNumber(mine)}</strong>
            </li>
        `;
    }).join("");

    return `
        <article class="card compare-card">
            ${profileHTML(profile.user, { showCounts: false })}
            <ul class="compare-stats">${rows}</ul>
            ${languagesHTML(profile.repos)}
        </article>
    `;
}

function renderCompare(a, b) {
    main.innerHTML = `
        <div class="compare-grid">
            ${compareCardHTML(a, b)}
            ${compareCardHTML(b, a)}
        </div>
    `;
}

/* ---------- Search ---------- */

// fromUrl: the search came from page load / back-forward, so don't push history or remember it
async function searchUsers(user, vs, { fromUrl = false } = {}) {
    const id = ++requestId;
    if (!fromUrl) updateUrl(user, vs);
    renderLoading();

    try {
        const profiles = await Promise.all([user, vs].filter(Boolean).map(fetchProfile));
        if (id !== requestId) return; // a newer search started while this one was loading

        if (profiles.length === 2) renderCompare(...profiles);
        else renderProfile(profiles[0]);

        document.title = `${profiles.map((p) => p.user.login).join(" vs ")} · Profile Explorer`;
        if (!fromUrl) profiles.forEach((p) => addToHistory(p.user.login));
    } catch (err) {
        if (id !== requestId) return;
        renderError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    }
}

function updateUrl(user, vs) {
    const params = new URLSearchParams({ user });
    if (vs) params.set("vs", vs);
    const query = `?${params}`;
    if (location.search !== query) history.pushState(null, "", query);
}

function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    const vs = params.get("vs");
    setCompareMode(Boolean(vs));
    searchUsers(params.get("user") || DEFAULT_USER, vs, { fromUrl: true });
}

function setCompareMode(on) {
    compareMode = on;
    compareSearch.hidden = !on;
    compareToggle.setAttribute("aria-pressed", String(on));
    compareToggle.textContent = on ? "✕ Compare" : "⇄ Compare";
}

/* ---------- Recent searches ---------- */

function getHistory() {
    try {
        return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [];
    } catch {
        return [];
    }
}

function addToHistory(login) {
    const list = [login, ...getHistory().filter((u) => u.toLowerCase() !== login.toLowerCase())].slice(
        0,
        HISTORY_SIZE
    );
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    } catch {}
    renderHistory();
}

function renderHistory() {
    const list = getHistory();
    recent.hidden = !list.length;
    recent.innerHTML =
        `<span class="recent-label">Recent:</span>` +
        list
            .map((u) => `<button type="button" class="chip" data-user="${escapeHTML(u)}">${escapeHTML(u)}</button>`)
            .join("");
}

/* ---------- Theme ---------- */

function renderThemeToggle() {
    const theme = document.documentElement.dataset.theme;
    const next = theme === "dark" ? "light" : "dark";
    themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    themeToggle.setAttribute("aria-label", `Switch to ${next} theme`);
    themeToggle.title = `Switch to ${next} theme`;
}

/* ---------- Events ---------- */

form.addEventListener("submit", (e) => {
    e.preventDefault();

    const user = search.value.trim();
    const vs = compareMode ? compareSearch.value.trim() : "";

    if (!user) return search.focus();
    if (compareMode && !vs) return compareSearch.focus();

    searchUsers(user, vs || null);
    search.value = "";
    compareSearch.value = "";
});

compareToggle.addEventListener("click", () => {
    setCompareMode(!compareMode);
    (compareMode ? compareSearch : search).focus();
});

recent.addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    setCompareMode(false);
    searchUsers(chip.dataset.user);
});

themeToggle.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
        localStorage.setItem(THEME_KEY, next);
    } catch {}
    renderThemeToggle();
});

window.addEventListener("popstate", loadFromUrl);

renderThemeToggle();
renderHistory();
loadFromUrl();
