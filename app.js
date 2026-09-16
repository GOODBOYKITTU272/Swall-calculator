(() => {
  "use strict";

  const SECTOR_LABELS = {
    all: "All",
    tech: "Tech",
    biotech: "Biotech",
    non_tech: "Non-tech",
  };

  const CONTACT_LABELS = {
    all: "All",
    known: "Known contact",
    unknown: "Unknown contact",
    not_checked: "Not checked",
  };

  const CONTACT_BADGE = {
    known: "Known",
    unknown: "Unknown",
    not_checked: "Not checked",
  };

  const state = {
    companies: [],
    summary: null,
    filters: {
      sector: "all",
      contact: "all",
      search: "",
      website: "",
      code: "",
      state: "",
    },
    selectedCin: null,
  };

  const el = {
    kpiRow: document.getElementById("kpiRow"),
    sourcePill: document.getElementById("sourcePill"),
    headerMeta: document.getElementById("headerMeta"),
    sectorChips: document.getElementById("sectorChips"),
    contactChips: document.getElementById("contactChips"),
    searchInput: document.getElementById("searchInput"),
    websiteSelect: document.getElementById("websiteSelect"),
    codeSelect: document.getElementById("codeSelect"),
    stateSelect: document.getElementById("stateSelect"),
    resetFilters: document.getElementById("resetFilters"),
    resultsCount: document.getElementById("resultsCount"),
    resultsHint: document.getElementById("resultsHint"),
    tableBody: document.getElementById("tableBody"),
    cardList: document.getElementById("cardList"),
    emptyState: document.getElementById("emptyState"),
    emptyCopy: document.getElementById("emptyCopy"),
    drawer: document.getElementById("drawer"),
    drawerBackdrop: document.getElementById("drawerBackdrop"),
    drawerTitle: document.getElementById("drawerTitle"),
    drawerCin: document.getElementById("drawerCin"),
    drawerBody: document.getElementById("drawerBody"),
    drawerClose: document.getElementById("drawerClose"),
  };

  function escapeHtml(str) {
    return String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatNum(n) {
    return Number(n).toLocaleString("en-IN");
  }

  function displayUrl(url) {
    if (!url) return "";
    try {
      const u = new URL(url.startsWith("http") ? url : `https://${url}`);
      return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : "");
    } catch {
      return url;
    }
  }

  function sectorBadge(sector) {
    const label = SECTOR_LABELS[sector] || sector;
    return `<span class="badge badge-${escapeHtml(sector)}">${escapeHtml(label)}</span>`;
  }

  function contactBadge(status) {
    const label = CONTACT_BADGE[status] || status || "—";
    const cls = status || "empty";
    return `<span class="badge badge-${escapeHtml(cls)}">${escapeHtml(label)}</span>`;
  }

  function websiteBadge(status) {
    if (!status) return `<span class="badge badge-empty">Not checked</span>`;
    const cls = status === "unknown" ? "ws-unknown" : status;
    return `<span class="badge badge-${escapeHtml(cls)}">${escapeHtml(status)}</span>`;
  }

  function codeBadge(signal) {
    if (!signal) return `<span class="badge badge-empty">Not checked</span>`;
    return `<span class="badge badge-${escapeHtml(signal)}">${escapeHtml(signal)}</span>`;
  }

  function computeLiveAndStrong(companies) {
    let live = 0;
    let strong = 0;
    for (const c of companies) {
      if (c.website_status === "live") live += 1;
      if (c.code_signal === "strong") strong += 1;
    }
    return { live, strong };
  }

  function renderKpis() {
    const s = state.summary;
    const { live, strong } = computeLiveAndStrong(state.companies);
    const cards = [
      { label: "Total companies", value: s.total, sub: "STK-7 inventory" },
      { label: "Tech", value: s.by_sector.tech, sub: "Deep-dived" },
      { label: "Biotech", value: s.by_sector.biotech, sub: "Deep-dived" },
      { label: "Non-tech", value: s.by_sector.non_tech, sub: "Not checked" },
      { label: "Known contacts", value: s.known_contacts ?? s.by_contact.known, sub: "Email / phone found" },
      { label: "Deep-dived", value: s.deep_dived, sub: "Tech + biotech" },
      { label: "Live websites", value: live, sub: "Computed from companies" },
      { label: "Strong code", value: strong, sub: "Computed from companies" },
    ];

    el.kpiRow.innerHTML = cards
      .map(
        (c) => `
      <article class="kpi">
        <span class="kpi-label">${escapeHtml(c.label)}</span>
        <div class="kpi-value">${formatNum(c.value)}</div>
        <div class="kpi-sub">${escapeHtml(c.sub)}</div>
      </article>`
      )
      .join("");

    el.sourcePill.textContent = s.strike_off_date
      ? `Strike-off ${s.strike_off_date}`
      : "STK-7";
    el.headerMeta.innerHTML = s.source
      ? escapeHtml(s.source)
      : "";
  }

  function countBy(key, value) {
    if (value === "all") return state.companies.length;
    return state.companies.filter((c) => c[key] === value).length;
  }

  function renderChips() {
    const sectorKeys = ["all", "tech", "biotech", "non_tech"];
    el.sectorChips.innerHTML = sectorKeys
      .map((key) => {
        const count =
          key === "all"
            ? state.companies.length
            : state.summary.by_sector[key] ?? countBy("sector", key);
        const active = state.filters.sector === key ? " active" : "";
        return `<button type="button" class="chip${active}" data-filter="sector" data-value="${key}">
          ${SECTOR_LABELS[key]}<span class="count">${formatNum(count)}</span>
        </button>`;
      })
      .join("");

    const contactKeys = ["all", "known", "unknown", "not_checked"];
    el.contactChips.innerHTML = contactKeys
      .map((key) => {
        const count =
          key === "all"
            ? state.companies.length
            : state.summary.by_contact[key] ?? countBy("contact_status", key);
        const active = state.filters.contact === key ? " active" : "";
        return `<button type="button" class="chip${active}" data-filter="contact" data-value="${key}">
          ${CONTACT_LABELS[key]}<span class="count">${formatNum(count)}</span>
        </button>`;
      })
      .join("");
  }

  function populateStateDropdown() {
    const states = [...new Set(state.companies.map((c) => c.state).filter(Boolean))].sort((a, b) =>
      a.localeCompare(b)
    );
    const opts = ['<option value="">All states</option>']
      .concat(states.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`));
    el.stateSelect.innerHTML = opts.join("");
  }

  function matchesFilters(c) {
    const f = state.filters;

    if (f.sector !== "all" && c.sector !== f.sector) return false;
    if (f.contact !== "all" && c.contact_status !== f.contact) return false;

    if (f.search) {
      const q = f.search.toLowerCase();
      const name = (c.name || "").toLowerCase();
      const cin = (c.cin || "").toLowerCase();
      if (!name.includes(q) && !cin.includes(q)) return false;
    }

    if (f.website) {
      if (f.website === "__empty") {
        if (c.website_status) return false;
      } else if (c.website_status !== f.website) {
        return false;
      }
    }

    if (f.code) {
      if (f.code === "__empty") {
        if (c.code_signal) return false;
      } else if (c.code_signal !== f.code) {
        return false;
      }
    }

    if (f.state && c.state !== f.state) return false;

    return true;
  }

  function filteredCompanies() {
    return state.companies.filter(matchesFilters);
  }

  function websiteCell(c) {
    if (!c.website_url && !c.website_status) {
      return `<span class="muted">—</span>`;
    }
    const badge = websiteBadge(c.website_status);
    if (c.website_url) {
      const href = c.website_url.startsWith("http") ? c.website_url : `https://${c.website_url}`;
      return `${badge} <a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" onclick="event.stopPropagation()">${escapeHtml(displayUrl(c.website_url))}</a>`;
    }
    return badge;
  }

  function renderResults() {
    const rows = filteredCompanies();
    el.resultsCount.textContent = `${formatNum(rows.length)} result${rows.length === 1 ? "" : "s"}`;

    const nonTechNotChecked =
      state.filters.sector === "non_tech" &&
      (state.filters.contact === "not_checked" || state.filters.contact === "all") &&
      (state.filters.website === "__empty" || !state.filters.website);

    if (state.filters.sector === "non_tech") {
      el.resultsHint.textContent =
        "Non-tech companies were not deep-dived — contact/website/code are not checked.";
    } else if (state.filters.contact === "not_checked") {
      el.resultsHint.textContent = "“Not checked” is expected for non-tech (no deep-dive).";
    } else {
      el.resultsHint.textContent = "Filters combine with AND · click a row for details";
    }

    if (rows.length === 0) {
      el.tableBody.innerHTML = "";
      el.cardList.innerHTML = "";
      el.emptyState.classList.remove("hidden");
      if (state.filters.sector === "non_tech" && (state.filters.website === "live" || state.filters.code === "strong")) {
        el.emptyCopy.textContent =
          "Non-tech companies were not deep-dived, so website and code-signal fields are empty. Clear those filters to see non-tech rows.";
      } else {
        el.emptyCopy.textContent =
          "Try widening filters. Non-tech rows were not deep-dived — contact and website fields are “not checked”.";
      }
      return;
    }

    el.emptyState.classList.add("hidden");

    el.tableBody.innerHTML = rows
      .map((c) => {
        const active = c.cin === state.selectedCin ? " active" : "";
        return `<tr class="${active}" data-cin="${escapeHtml(c.cin)}" tabindex="0">
          <td>
            <div class="company-name">${escapeHtml(c.name)}</div>
            <span class="company-cin">${escapeHtml(c.cin)}</span>
          </td>
          <td>${sectorBadge(c.sector)}</td>
          <td>${contactBadge(c.contact_status)}</td>
          <td class="website-cell">${websiteCell(c)}</td>
          <td>${codeBadge(c.code_signal)}</td>
          <td>${escapeHtml(c.state || "—")}</td>
        </tr>`;
      })
      .join("");

    el.cardList.innerHTML = rows
      .map((c) => {
        const active = c.cin === state.selectedCin ? " active" : "";
        const site =
          c.website_url
            ? displayUrl(c.website_url)
            : c.website_status || "Not checked";
        return `<article class="company-card${active}" data-cin="${escapeHtml(c.cin)}" tabindex="0">
          <h3>${escapeHtml(c.name)}</h3>
          <span class="company-cin">${escapeHtml(c.cin)}</span>
          <div class="card-meta">
            ${sectorBadge(c.sector)}
            ${contactBadge(c.contact_status)}
            ${codeBadge(c.code_signal)}
          </div>
          <div class="card-rows">
            <div><strong>Website</strong> ${escapeHtml(site)}</div>
            <div><strong>State</strong> ${escapeHtml(c.state || "—")}</div>
          </div>
        </article>`;
      })
      .join("");

    // unused intentionally keeps hint honest for non-tech empty deep-dive case
    void nonTechNotChecked;
  }

  function detailLink(label, href, text) {
    if (!text && !href) {
      return `<div class="detail-item"><dt>${label}</dt><dd class="muted">—</dd></div>`;
    }
    if (href) {
      return `<div class="detail-item"><dt>${label}</dt><dd><a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text || href)}</a></dd></div>`;
    }
    return `<div class="detail-item"><dt>${label}</dt><dd>${escapeHtml(text)}</dd></div>`;
  }

  function openDrawer(cin) {
    const c = state.companies.find((x) => x.cin === cin);
    if (!c) return;
    state.selectedCin = cin;

    el.drawerTitle.textContent = c.name;
    el.drawerCin.textContent = c.cin;

    const emailHref = c.email ? `mailto:${c.email}` : "";
    const phoneHref = c.phone ? `tel:${c.phone.replace(/\s+/g, "")}` : "";
    const webHref = c.website_url
      ? c.website_url.startsWith("http")
        ? c.website_url
        : `https://${c.website_url}`
      : "";
    const ghHref = c.github_url
      ? c.github_url.startsWith("http")
        ? c.github_url
        : `https://${c.github_url}`
      : "";

    const note =
      c.sector === "non_tech" || c.contact_status === "not_checked"
        ? `<div class="note-box">Deep-dive (website / email / phone / GitHub) was completed for <strong>tech</strong> and <strong>biotech</strong> only. Non-tech companies are marked not checked.</div>`
        : "";

    el.drawerBody.innerHTML = `
      <div class="detail-badges">
        ${sectorBadge(c.sector)}
        ${contactBadge(c.contact_status)}
        ${websiteBadge(c.website_status)}
        ${codeBadge(c.code_signal)}
      </div>
      <dl class="detail-grid">
        ${detailLink("State", null, c.state)}
        ${detailLink("Year", null, c.year)}
        ${detailLink("Entity type", null, c.entity_type)}
        ${detailLink("NIC", null, c.nic)}
        ${detailLink("Coding priority", null, c.coding_priority || "—")}
        ${detailLink("Website", webHref, c.website_url || (c.website_status ? `(${c.website_status})` : ""))}
        ${detailLink("Website status", null, c.website_status || "not checked")}
        ${detailLink("Email", emailHref, c.email)}
        ${detailLink("Phone", phoneHref, c.phone)}
        ${detailLink("GitHub", ghHref, c.github_url)}
        ${detailLink("GitHub repos", null, c.github_repos == null ? "—" : String(c.github_repos))}
        ${detailLink("Code signal", null, c.code_signal || "not checked")}
        ${detailLink("Evidence", null, c.evidence || "—")}
        ${detailLink("CIN", null, c.cin)}
        ${detailLink("Contact status", null, c.contact_status)}
      </dl>
      ${note}
    `;

    el.drawer.classList.remove("hidden");
    el.drawerBackdrop.classList.remove("hidden");
    el.drawerBackdrop.setAttribute("aria-hidden", "false");
    el.drawerClose.focus();

    // refresh active highlights without full re-filter cost for large lists —
    // still cheap at 1607 rows
    document.querySelectorAll("[data-cin].active").forEach((n) => n.classList.remove("active"));
    document.querySelectorAll(`[data-cin="${CSS.escape(cin)}"]`).forEach((n) => n.classList.add("active"));
  }

  function closeDrawer() {
    state.selectedCin = null;
    el.drawer.classList.add("hidden");
    el.drawerBackdrop.classList.add("hidden");
    el.drawerBackdrop.setAttribute("aria-hidden", "true");
    document.querySelectorAll("[data-cin].active").forEach((n) => n.classList.remove("active"));
  }

  function wireEvents() {
    el.sectorChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter=sector]");
      if (!btn) return;
      state.filters.sector = btn.dataset.value;
      renderChips();
      renderResults();
    });

    el.contactChips.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-filter=contact]");
      if (!btn) return;
      state.filters.contact = btn.dataset.value;
      renderChips();
      renderResults();
    });

    let searchTimer = null;
    el.searchInput.addEventListener("input", () => {
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.search = el.searchInput.value.trim();
        renderResults();
      }, 120);
    });

    el.websiteSelect.addEventListener("change", () => {
      state.filters.website = el.websiteSelect.value;
      renderResults();
    });

    el.codeSelect.addEventListener("change", () => {
      state.filters.code = el.codeSelect.value;
      renderResults();
    });

    el.stateSelect.addEventListener("change", () => {
      state.filters.state = el.stateSelect.value;
      renderResults();
    });

    el.resetFilters.addEventListener("click", () => {
      state.filters = {
        sector: "all",
        contact: "all",
        search: "",
        website: "",
        code: "",
        state: "",
      };
      el.searchInput.value = "";
      el.websiteSelect.value = "";
      el.codeSelect.value = "";
      el.stateSelect.value = "";
      renderChips();
      renderResults();
    });

    function onRowActivate(e) {
      const row = e.target.closest("[data-cin]");
      if (!row) return;
      if (e.target.closest("a")) return;
      openDrawer(row.dataset.cin);
    }

    el.tableBody.addEventListener("click", onRowActivate);
    el.cardList.addEventListener("click", onRowActivate);

    el.tableBody.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const row = e.target.closest("[data-cin]");
        if (!row) return;
        e.preventDefault();
        openDrawer(row.dataset.cin);
      }
    });
    el.cardList.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        const row = e.target.closest("[data-cin]");
        if (!row) return;
        e.preventDefault();
        openDrawer(row.dataset.cin);
      }
    });

    el.drawerClose.addEventListener("click", closeDrawer);
    el.drawerBackdrop.addEventListener("click", closeDrawer);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !el.drawer.classList.contains("hidden")) {
        closeDrawer();
      }
    });
  }

  async function init() {
    try {
      const [companiesRes, summaryRes] = await Promise.all([
        fetch("data/companies.json"),
        fetch("data/summary.json"),
      ]);
      if (!companiesRes.ok || !summaryRes.ok) {
        throw new Error(`Failed to load data (${companiesRes.status}/${summaryRes.status})`);
      }
      state.companies = await companiesRes.json();
      state.summary = await summaryRes.json();

      renderKpis();
      renderChips();
      populateStateDropdown();
      wireEvents();
      renderResults();
    } catch (err) {
      el.kpiRow.innerHTML = "";
      el.resultsCount.textContent = "Failed to load data";
      el.emptyState.classList.remove("hidden");
      el.emptyCopy.textContent =
        err.message +
        ". Serve this folder over HTTP (e.g. python3 -m http.server) so relative data/*.json paths work.";
      console.error(err);
    }
  }

  init();
})();
