(() => {
  'use strict';

  const M = window.ContactIntelModel;
  const STORAGE = {
    contacts: 'swall.phase2.contacts',
    outreach: 'swall.phase2.outreach',
    notes: 'swall.phase2.notes',
    websites: 'swall.phase2.websites',
    scrolls: 'swall.phase2.scrolls',
  };

  const state = {
    companies: [],
    summary: null,
    contactsByCin: readStore(STORAGE.contacts, {}),
    outreachByCin: readStore(STORAGE.outreach, {}),
    notesByCin: readStore(STORAGE.notes, {}),
    websiteChecksByCin: readStore(STORAGE.websites, {}),
    companyTab: 'contacts',
  };

  const els = {
    content: document.getElementById('appContent'),
    pageTitle: document.getElementById('pageTitle'),
    pageSubtitle: document.getElementById('pageSubtitle'),
    breadcrumb: document.getElementById('breadcrumb'),
    sidebarSourceMeta: document.getElementById('sidebarSourceMeta'),
    exportBtn: document.getElementById('exportBtn'),
    toast: document.getElementById('toast'),
  };

  function readStore(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeStore(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function readSessionStore(key, fallback) {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(key));
      return parsed && typeof parsed === 'object' ? parsed : fallback;
    } catch {
      return fallback;
    }
  }

  function writeSessionStore(key, value) {
    sessionStorage.setItem(key, JSON.stringify(value));
  }

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function attr(value) { return esc(value); }
  function num(value) { return Number(value || 0).toLocaleString('en-IN'); }
  function labelize(value) { return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()); }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function savedContacts(company) { return state.contactsByCin[company.cin] || []; }
  function personCompleteness(company) { return M.personCompleteness(company, savedContacts(company)); }
  function companyCompleteness(company) { return M.companyChannelCompleteness(company); }
  function readiness(company) { return M.contactReadiness(company, savedContacts(company)); }
  function sectorMeta(companyOrKey) {
    const key = typeof companyOrKey === 'string' ? companyOrKey : M.deriveSector(companyOrKey);
    return M.sectorMeta(key);
  }

  function primaryPerson(company) {
    const saved = savedContacts(company);
    if (saved.length) return saved[0];
    if (company.director_name || company.director_email || company.director_phone || company.director_linkedin) {
      return {
        name: company.director_name || '',
        designation: company.director_designation || '',
        email: company.director_email || '',
        phone: company.director_phone || '',
        linkedin: company.director_linkedin || '',
        source: 'Source dataset',
        verified: false,
      };
    }
    return null;
  }

  function websiteCheck(company) {
    const saved = state.websiteChecksByCin[company.cin] || {};
    return {
      status: saved.status || M.normalizeWebsiteStatus(company.website_status),
      checkedAt: saved.checkedAt || '',
      source: saved.source || '',
    };
  }

  function websiteBadge(company) {
    const status = websiteCheck(company).status;
    const tone = { Live: 'green', Dead: 'red', Redirected: 'amber', Unclear: 'purple', 'Not checked': 'gray' }[status] || 'gray';
    return `<span class="badge ${tone}">${esc(status)}</span>`;
  }

  function readinessBadge(company) {
    const r = readiness(company);
    return `<span class="badge ${r.tone || 'gray'}">${esc(r.label)}</span>`;
  }

  function stageBadge(stage) {
    const labels = {
      research: 'Research', channel_found: 'Channel found', person_identified: 'Person identified',
      contacted: 'Contacted', replied: 'Replied', meeting: 'Meeting',
      data_discussion: 'Data / code discussion', mercor_candidate: 'Mercor candidate',
    };
    const colors = {
      research: 'gray', channel_found: 'amber', person_identified: 'blue', contacted: 'amber',
      replied: 'green', meeting: 'green', data_discussion: 'purple', mercor_candidate: 'purple',
    };
    return `<span class="badge ${colors[stage] || 'gray'}">${labels[stage] || labelize(stage)}</span>`;
  }

  function setHeader(title, subtitle, breadcrumb, breadcrumbIsHtml = false) {
    els.pageTitle.textContent = title;
    els.pageSubtitle.textContent = subtitle;
    if (breadcrumbIsHtml) els.breadcrumb.innerHTML = breadcrumb;
    else els.breadcrumb.textContent = breadcrumb;
  }

  function setActiveNav(screen) {
    document.querySelectorAll('[data-nav]').forEach((node) => {
      const active = node.dataset.nav === screen || (screen === 'sector' && node.dataset.nav === 'sector') || (screen === 'sectors' && node.dataset.nav === 'sector');
      node.classList.toggle('active', active);
    });
  }

  function currentHash() { return location.hash || '#/overview'; }
  function rememberScroll(hash = currentHash()) {
    const scrolls = readSessionStore(STORAGE.scrolls, {});
    scrolls[hash] = window.scrollY;
    writeSessionStore(STORAGE.scrolls, scrolls);
  }
  function restoreScroll(hash = currentHash()) {
    const scrolls = readSessionStore(STORAGE.scrolls, {});
    if (typeof scrolls[hash] !== 'number') return;
    requestAnimationFrame(() => window.scrollTo(0, scrolls[hash]));
  }
  function replaceHash(hash) {
    history.replaceState(null, '', hash);
    render();
  }

  function snapshotStats(companies = state.companies) {
    let companyChannels = 0, personFound = 0, needsResearch = 0, websites = 0, ready = 0, email = 0, phone = 0, linkedin = 0;
    for (const company of companies) {
      const companyLevel = companyCompleteness(company);
      const person = personCompleteness(company);
      const r = readiness(company);
      if (companyLevel.score > 0) companyChannels += 1;
      if (person.fields.person) personFound += 1;
      if (!person.fields.person) needsResearch += 1;
      if (companyLevel.fields.website) websites += 1;
      if (['ready_to_contact', 'verified_contact'].includes(r.key)) ready += 1;
      if (companyLevel.fields.email || person.fields.email) email += 1;
      if (companyLevel.fields.phone || person.fields.phone) phone += 1;
      if (person.fields.linkedin) linkedin += 1;
    }
    return { total: companies.length, companyChannels, personFound, needsResearch, websites, ready, email, phone, linkedin };
  }

  function statCard(label, value, sub, tone = '') {
    return `<article class="stat-card ${tone}"><div class="label"><span>${esc(label)}</span></div><div class="value">${num(value)}</div><div class="sub">${esc(sub)}</div></article>`;
  }
  function quickStat(label, value) { return `<div class="quick-stat"><span>${esc(label)}</span><strong>${num(value)}</strong></div>`; }

  function overviewScreen(sectorOnly = false) {
    const stats = snapshotStats();
    const sectors = M.aggregateBySector(state.companies, state.contactsByCin);
    setHeader(
      sectorOnly ? 'Sector Segmentation' : 'Contact Acquisition Intelligence',
      'Start with the sector, identify the right person, verify a usable channel, then begin outreach.',
      sectorOnly ? 'Company universe → sectors' : 'Company universe → sector → contact',
    );
    setActiveNav(sectorOnly ? 'sectors' : 'overview');

    els.content.innerHTML = `
      ${sectorOnly ? '' : `<section class="stats-grid">
        ${statCard('Total companies', stats.total, 'MCA STK-7 inventory', 'blue')}
        ${statCard('Company channels', stats.companyChannels, 'Website / generic email / company phone', 'green')}
        ${statCard('Person identified', stats.personFound, 'Director / founder / key person')}
        ${statCard('Needs person research', stats.needsResearch, 'No decision-maker identified', 'amber')}
        ${statCard('Websites found', stats.websites, 'Status may still need verification')}
        ${statCard('Ready to contact', stats.ready, 'Person + direct channel', 'green')}
      </section>`}
      <section class="section-card">
        <div class="section-head"><div><h2>Companies by sector</h2><p>Each sector shows company-channel coverage, people identified, and the remaining person-research queue.</p></div><span class="badge blue">Derived from existing sector + NIC/name</span></div>
        <div class="section-body"><div class="sector-grid">
          ${sectors.map((row) => `<a class="sector-card" href="${attr(M.buildSectorRoute(row.key))}"><span class="sector-icon">${esc(row.icon)}</span><div><h3>${esc(row.label)}</h3><div class="sector-total">${num(row.total)}</div></div><div class="sector-split sector-split-three"><div class="mini-count channel"><strong>${num(row.channelFound)}</strong>Channels</div><div class="mini-count known"><strong>${num(row.personFound)}</strong>People</div><div class="mini-count unknown"><strong>${num(row.needsResearch)}</strong>Research</div></div></a>`).join('')}
        </div></div>
      </section>`;
  }

  function sectorScreen(route) {
    const meta = sectorMeta(route.sector);
    const all = M.sectorCompanies(state.companies, route.sector);
    const stats = snapshotStats(all);
    const aggregate = M.aggregateBySector(all, state.contactsByCin)[0] || { channelFound: 0, personFound: 0, needsResearch: 0 };
    const contactState = route.contactState || 'all';
    const searchValue = route.search || '';
    const stateValue = route.state || '';
    let rows = all;
    if (contactState === 'channel') rows = rows.filter((company) => companyCompleteness(company).score > 0);
    if (contactState === 'person') rows = rows.filter((company) => personCompleteness(company).fields.person);
    if (contactState === 'research') rows = rows.filter((company) => !personCompleteness(company).fields.person);
    if (searchValue) {
      const q = searchValue.toLowerCase();
      rows = rows.filter((company) => `${company.name} ${company.cin} ${company.state}`.toLowerCase().includes(q));
    }
    if (stateValue) rows = rows.filter((company) => company.state === stateValue);
    const states = [...new Set(all.map((company) => company.state).filter(Boolean))].sort();
    const viewLabel = { all: 'All companies', channel: 'Company channels', person: 'Person identified', research: 'Needs research' }[contactState] || 'All companies';
    setHeader(`${meta.label} — Contact Segmentation`, `${num(all.length)} companies. Separate company-level channels from real people before outreach.`, `Sectors → ${meta.label} → ${viewLabel}`);
    setActiveNav('sector');
    const routeFor = (nextState = contactState, extra = {}) => M.buildSectorRoute(route.sector, {
      contactState: nextState,
      search: extra.search !== undefined ? extra.search : searchValue,
      state: extra.state !== undefined ? extra.state : stateValue,
    });

    els.content.innerHTML = `
      <section class="sector-hero">
        <div class="hero-card"><div class="sector-label">Research sector</div><h2>${esc(meta.label)}</h2><p>Classified from the existing sector field plus NIC/name heuristics. Use this as research segmentation, not as a legal industry classification.</p><div class="hero-count"><strong>${num(all.length)}</strong><span>companies in this sector</span></div></div>
        <div><div class="contact-state-grid contact-state-grid-three">
          <a class="contact-state known" href="${attr(routeFor('channel'))}"><span class="state-label">Company channel found</span><div class="state-value">${num(aggregate.channelFound)}</div><p>Website, general email, or company phone exists.</p></a>
          <a class="contact-state person" href="${attr(routeFor('person'))}"><span class="state-label">Person identified</span><div class="state-value">${num(aggregate.personFound)}</div><p>Director, founder, or key person has been identified.</p></a>
          <a class="contact-state unknown" href="${attr(routeFor('research'))}"><span class="state-label">Needs person research</span><div class="state-value">${num(aggregate.needsResearch)}</div><p>No decision-maker identified yet.</p></a>
        </div><div class="quick-grid quick-grid-five">${quickStat('People', stats.personFound)}${quickStat('Emails', stats.email)}${quickStat('Phones', stats.phone)}${quickStat('LinkedIn', stats.linkedin)}${quickStat('Websites', stats.websites)}</div></div>
      </section>
      <section class="section-card">
        <div class="section-head"><div><h2>${esc(viewLabel)}</h2><p>${num(rows.length)} results in ${esc(meta.label)}.</p></div><div class="tabs"><a class="tab ${contactState === 'all' ? 'active' : ''}" href="${attr(routeFor('all'))}">All ${num(all.length)}</a><a class="tab ${contactState === 'channel' ? 'active' : ''}" href="${attr(routeFor('channel'))}">Channels ${num(aggregate.channelFound)}</a><a class="tab ${contactState === 'person' ? 'active' : ''}" href="${attr(routeFor('person'))}">People ${num(aggregate.personFound)}</a><a class="tab ${contactState === 'research' ? 'active' : ''}" href="${attr(routeFor('research'))}">Research ${num(aggregate.needsResearch)}</a></div></div>
        <div class="section-body"><div class="toolbar"><input id="sectorSearch" class="input grow" type="search" placeholder="Search company name, CIN, state…" value="${attr(searchValue)}" /><select id="sectorState" class="select compact-select"><option value="">All states</option>${states.map((name) => `<option value="${attr(name)}" ${name === stateValue ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select><button class="btn btn-secondary" type="button" id="clearSectorSearch">Clear</button></div></div>
        ${companyTable(rows, { showSector: false, returnHash: currentHash() })}
      </section>`;

    const search = document.getElementById('sectorSearch');
    search?.addEventListener('input', () => {
      replaceHash(routeFor(contactState, { search: search.value.trim() }));
      const next = document.getElementById('sectorSearch');
      if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); }
    });
    document.getElementById('sectorState')?.addEventListener('change', (event) => replaceHash(routeFor(contactState, { state: event.target.value })));
    document.getElementById('clearSectorSearch')?.addEventListener('click', () => replaceHash(M.buildSectorRoute(route.sector, { contactState })));
    restoreScroll(currentHash());
  }

  function displayDomain(url) {
    if (!url) return '';
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
  }

  function companyTable(companies, options = {}) {
    if (!companies.length) return `<div class="empty-card">No companies match this view.</div>`;
    const returnHash = options.returnHash || currentHash();
    return `<div class="table-wrap"><table><thead><tr><th>Company</th>${options.showSector !== false ? '<th>Sector</th>' : ''}<th>State</th><th>Person</th><th>Email</th><th>Phone</th><th>Website</th><th>Website status</th><th>Readiness</th><th>Action</th></tr></thead><tbody>${companies.map((company) => {
      const person = primaryPerson(company);
      const meta = sectorMeta(company);
      const email = person?.email || company.email || '';
      const phone = person?.phone || company.phone || '';
      const companyHref = M.buildCompanyRoute(company.cin, returnHash);
      return `<tr><td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td>${options.showSector !== false ? `<td><span class="badge blue">${esc(meta.label)}</span></td>` : ''}<td>${esc(company.state || '—')}</td><td>${person?.name ? `<span class="person-name">${esc(person.name)}</span><div class="person-role">${esc(person.designation || 'Role not captured')}</div>` : '<span class="missing">Not researched</span>'}</td><td>${email ? `<a href="mailto:${attr(email)}">${esc(email)}</a>${person?.email ? '<div class="cell-note">Direct</div>' : '<div class="cell-note">Company</div>'}` : '<span class="missing">Missing</span>'}</td><td>${phone ? `<a href="tel:${attr(phone)}">${esc(phone)}</a>${person?.phone ? '<div class="cell-note">Direct</div>' : '<div class="cell-note">Company</div>'}` : '<span class="missing">Missing</span>'}</td><td>${company.website_url ? `<a href="${attr(company.website_url)}" target="_blank" rel="noopener noreferrer">${esc(displayDomain(company.website_url))}</a>` : '<span class="missing">Missing</span>'}</td><td>${websiteBadge(company)}</td><td>${readinessBadge(company)}</td><td><a class="btn btn-primary btn-sm" data-company-link="1" href="${attr(companyHref)}">${person?.name ? 'View contact' : 'Research'}</a></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function returnContext(route, company) {
    const meta = sectorMeta(company);
    const fallbackHash = M.buildSectorRoute(meta.key);
    const from = route.from || fallbackHash;
    const parsed = M.parseRoute(from);
    let label = meta.label;
    if (parsed.screen === 'sector') {
      const view = { channel: 'Company Channels', person: 'Person Identified', research: 'Needs Research', all: 'All Companies' }[parsed.contactState || 'all'];
      label = `${sectorMeta(parsed.sector).label} / ${view}`;
    } else if (parsed.screen === 'research') label = 'Research Queue';
    else if (parsed.screen === 'outreach') label = 'Outreach';
    else if (parsed.screen === 'pipeline') label = 'Contact Pipeline';
    return { from, label };
  }

  function readinessDescription(key) {
    return {
      research_required: 'No decision-maker and no usable company channel yet.',
      company_channel_only: 'A company-level channel exists, but the director/founder is still unknown.',
      person_missing_channel: 'A decision-maker is identified, but a direct contact channel is still missing.',
      ready_to_contact: 'A decision-maker and at least one direct channel are available.',
      verified_contact: 'A researcher has verified the identified person/contact record.',
    }[key] || '';
  }

  function companyScreen(route) {
    const company = state.companies.find((item) => item.cin === route.cin);
    if (!company) {
      setHeader('Company not found', 'This CIN is not present in the loaded inventory.', 'Companies');
      els.content.innerHTML = '<div class="empty-card">Company not found.</div>';
      return;
    }
    const meta = sectorMeta(company);
    const r = readiness(company);
    const back = returnContext(route, company);
    const tabs = ['overview', 'contacts', 'digital', 'outreach', 'notes'];
    if (!tabs.includes(state.companyTab)) state.companyTab = 'contacts';
    const breadcrumb = `<a href="#/sectors">Sector Segmentation</a><span>›</span><a href="${attr(back.from)}">${esc(back.label)}</a><span>›</span><span>${esc(company.name)}</span>`;
    setHeader(company.name, 'Company contact dossier — identify the right person and make the record outreach-ready.', breadcrumb, true);
    setActiveNav('sector');
    els.content.innerHTML = `
      <div class="return-bar"><a class="return-link" href="${attr(back.from)}">← Back to ${esc(back.label)}</a></div>
      <section class="dossier-head"><div class="company-identity"><div class="identity-row"><div class="company-avatar">${esc(meta.icon)}</div><div><h2>${esc(company.name)}</h2><code>${esc(company.cin)}</code><div class="identity-badges"><span class="badge blue">${esc(meta.label)}</span><span class="badge gray">${esc(company.state || 'State unknown')}</span><span class="badge red">Struck off / dissolved</span>${readinessBadge(company)}</div></div></div></div><div class="readiness-card ${esc(r.key)}"><span>Contact readiness</span><div class="readiness-title">${esc(r.label)}</div><p>${readinessDescription(r.key)}</p></div></section>
      <section class="section-card"><div class="section-head dossier-tabs"><div class="tabs">${tabs.map((tab) => `<button class="tab ${state.companyTab === tab ? 'active' : ''}" type="button" data-company-tab="${tab}">${tab === 'digital' ? 'Digital footprint' : labelize(tab)}</button>`).join('')}</div></div><div class="section-body" id="companyTabBody">${renderCompanyTab(company, state.companyTab)}</div></section>`;
    document.querySelectorAll('[data-company-tab]').forEach((button) => button.addEventListener('click', () => { state.companyTab = button.dataset.companyTab; companyScreen(route); }));
    wireCompanyTab(company, route);
  }

  function renderCompanyTab(company, tab) {
    if (tab === 'overview') return companyOverview(company);
    if (tab === 'digital') return companyDigital(company);
    if (tab === 'outreach') return companyOutreach(company);
    if (tab === 'notes') return companyNotes(company);
    return companyContacts(company);
  }

  function info(label, value, href) {
    const content = value || value === 0 ? esc(value) : '<span class="missing">Not available</span>';
    return `<div class="info-item"><span>${esc(label)}</span>${href ? `<a href="${attr(href)}" target="_blank" rel="noopener noreferrer">${content}</a>` : `<strong>${content}</strong>`}</div>`;
  }

  function companyOverview(company) {
    const person = personCompleteness(company);
    const companyLevel = companyCompleteness(company);
    const checked = websiteCheck(company);
    return `<div class="detail-grid"><div><h3>Company information</h3><div class="info-grid">${info('CIN', company.cin)}${info('State', company.state)}${info('Incorporation year', company.year)}${info('Entity type', company.entity_type)}${info('NIC', company.nic)}${info('Strike-off date', state.summary?.strike_off_date || '01 Sep 2026')}${info('Source status', 'Dissolved / STK-7')}</div></div><div><h3>Contact summary</h3><div class="info-grid">${info('Person contact', `${person.score}/${person.total}`)}${info('Company channels', `${companyLevel.score}/${companyLevel.total}`)}${info('Website status', checked.status)}${info('Readiness', readiness(company).label)}</div></div></div>`;
  }

  function contactRow(contact, source = false, index = -1) {
    return `<div class="contact-card ${source ? 'source-contact' : ''}"><div><small>Person</small>${contact.name ? `<strong>${esc(contact.name)}</strong><div class="person-role">${esc(contact.designation || 'Role not captured')}</div>` : '<span class="missing">Name not researched</span>'}</div><div><small>Email</small>${contact.email ? `<a href="mailto:${attr(contact.email)}">${esc(contact.email)}</a>` : '<span class="missing">Missing</span>'}</div><div><small>Phone</small>${contact.phone ? `<a href="tel:${attr(contact.phone)}">${esc(contact.phone)}</a>` : '<span class="missing">Missing</span>'}</div><div><small>LinkedIn</small>${contact.linkedin ? `<a href="${attr(contact.linkedin)}" target="_blank" rel="noopener noreferrer">Open profile</a>` : '<span class="missing">Missing</span>'}</div><div><small>Verified</small>${contact.verified ? '<span class="badge green">Verified</span>' : '<span class="badge gray">No</span>'}</div><div><small>Source</small>${contact.source ? `<span>${esc(contact.source)}</span>` : '<span class="missing">Missing</span>'}</div><div>${source ? '<span class="badge gray">Source</span>' : `<button class="btn btn-secondary btn-sm" data-delete-contact="${index}" type="button">Remove</button>`}</div></div>`;
  }

  function companyChannelsTable(company) {
    const check = websiteCheck(company);
    const rows = [
      { type: 'Website', value: company.website_url || '', status: company.website_url ? check.status : 'Missing', verified: check.checkedAt ? new Date(check.checkedAt).toLocaleDateString() : '—', source: check.source || (company.website_url ? 'Source dataset' : '—'), action: company.website_url ? `<a class="btn btn-secondary btn-sm" href="${attr(company.website_url)}" target="_blank" rel="noopener noreferrer">Open</a>` : '—' },
      { type: 'General email', value: company.email || '', status: company.email ? 'Found' : 'Missing', verified: '—', source: company.email ? 'Source dataset' : '—', action: company.email ? `<a class="btn btn-secondary btn-sm" href="mailto:${attr(company.email)}">Email</a>` : '—' },
      { type: 'Company phone', value: company.phone || '', status: company.phone ? 'Found' : 'Missing', verified: '—', source: company.phone ? 'Source dataset' : '—', action: company.phone ? `<a class="btn btn-secondary btn-sm" href="tel:${attr(company.phone)}">Call</a>` : '—' },
    ];
    return `<div class="table-wrap channel-table"><table><thead><tr><th>Type</th><th>Value</th><th>Status</th><th>Last verified</th><th>Source</th><th>Action</th></tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${esc(row.type)}</strong></td><td>${row.value ? esc(row.value) : '<span class="missing">Missing</span>'}</td><td>${row.type === 'Website' && company.website_url ? websiteBadge(company) : `<span class="badge ${row.status === 'Found' ? 'green' : 'gray'}">${esc(row.status)}</span>`}</td><td>${esc(row.verified)}</td><td>${esc(row.source)}</td><td>${row.action}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function addContactForm() {
    return `<form id="addContactForm" class="section-card inline-form-card"><div class="section-body"><div class="form-grid">${field('Name', 'contactName', 'Director / founder name')}${field('Designation', 'contactDesignation', 'Director, Founder, CTO…')}${field('Direct email', 'contactEmail', 'name@company.com', 'email')}${field('Direct phone', 'contactPhone', '+91…', 'tel')}${field('LinkedIn URL', 'contactLinkedin', 'https://linkedin.com/in/…', 'url')}${field('Source', 'contactSource', 'MCA, LinkedIn, website, call…')}<div class="field full"><label class="checkbox-row"><input type="checkbox" id="contactVerified" /> Verified by researcher</label></div><div class="field full"><div class="toolbar"><button class="btn btn-primary" type="submit">Save person</button><button class="btn btn-secondary" type="button" id="cancelAddContact">Cancel</button></div></div></div></div></form>`;
  }
  function field(label, id, placeholder, type = 'text') { return `<div class="field"><label for="${id}">${esc(label)}</label><input class="input" id="${id}" name="${id}" type="${type}" placeholder="${attr(placeholder)}" /></div>`; }

  function researchLinks(company) {
    const q = encodeURIComponent(`"${company.name}" director founder`);
    const qEmail = encodeURIComponent(`"${company.name}" email phone director`);
    const qLinkedin = encodeURIComponent(`${company.name} founder director`);
    const wayback = company.website_url ? `https://web.archive.org/web/*/${encodeURIComponent(company.website_url)}` : `https://www.google.com/search?q=${encodeURIComponent(`"${company.name}" website`)}`;
    return [['Search web', `https://www.google.com/search?q=${q}`], ['Search contact details', `https://www.google.com/search?q=${qEmail}`], ['Search LinkedIn', `https://www.linkedin.com/search/results/people/?keywords=${qLinkedin}`], ['Search company + CIN', `https://www.google.com/search?q=${encodeURIComponent(`${company.cin} ${company.name}`)}`], ['Archived website', wayback]].map(([label, href]) => `<a class="btn btn-secondary" href="${href}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join('');
  }

  function companyContacts(company) {
    const saved = savedContacts(company);
    const person = personCompleteness(company);
    const companyLevel = companyCompleteness(company);
    const directorSource = company.director_name || company.director_email || company.director_phone || company.director_linkedin;
    const sourceRow = directorSource ? contactRow({ name: company.director_name || '', designation: company.director_designation || '', email: company.director_email || '', phone: company.director_phone || '', linkedin: company.director_linkedin || '', source: 'Source dataset', verified: false }, true) : '';
    return `<div class="contact-metric-grid"><div class="contact-metric person-metric"><span>Person Contact</span><strong>${person.score}/${person.total}</strong><p>Director/founder name, direct email, direct phone, LinkedIn.</p></div><div class="contact-metric company-metric"><span>Company Channels</span><strong>${companyLevel.score}/${companyLevel.total}</strong><p>Website, general/company email, company phone.</p></div></div><div class="subsection-head"><div><h2>Directors / founders / key people</h2><p>Company-level email/phone is not treated as a person record.</p></div><button class="btn btn-primary" type="button" id="showAddContact">+ Add person</button></div><div class="contact-list">${sourceRow}${saved.map((contact, index) => contactRow(contact, false, index)).join('')}${!directorSource && !saved.length ? '<div class="empty-card compact-empty">No person has been researched yet. Find the director/founder/key person and add the first sourced record.</div>' : ''}</div><div id="addContactWrap" style="margin-top:14px;display:none">${addContactForm()}</div><div class="subsection-head channel-heading"><div><h2>Company contact channels</h2><p>Useful ways to reach the company even before a decision-maker is identified.</p></div></div>${companyChannelsTable(company)}<div class="research-block"><h3>Research shortcuts</h3><div class="research-shortcuts">${researchLinks(company)}</div></div>`;
  }

  function companyDigital(company) {
    const check = websiteCheck(company);
    return `<div class="detail-grid digital-grid"><div><h3>Website & online presence</h3><div class="info-grid">${info('Website', company.website_url || '', company.website_url || '')}${info('Website status', check.status)}${info('Domain', displayDomain(company.website_url) || '')}${info('Last checked', check.checkedAt ? new Date(check.checkedAt).toLocaleString() : '')}${info('LinkedIn company', company.linkedin_company_url || '')}${info('Other website', company.other_website || '')}</div><form id="websiteCheckForm" class="website-check-form"><div class="field"><label>Verified website status</label><select id="websiteStatus" class="select">${['Not checked','Live','Dead','Redirected','Unclear'].map((value) => `<option value="${value}" ${value === check.status ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="field"><label>Verification source / note</label><input id="websiteSource" class="input" value="${attr(check.source)}" placeholder="URL, manual check, researcher note…" /></div><button class="btn btn-primary" type="submit">Save website check</button></form></div><div><h3>Code & technical signals</h3><div class="info-grid">${info('GitHub', company.github_url || '', company.github_url || '')}${info('Public repos', company.github_repos ?? 'Not checked')}${info('Code signal', company.code_signal || 'Not checked')}${info('Evidence', company.evidence || 'No evidence captured')}</div><div class="empty-card compact-empty research-reminder">A website or GitHub account is a digital-footprint clue. It does not make the company person-contact-ready until a decision-maker is identified.</div></div></div>`;
  }

  function outreachOptions(selected) {
    const aliases = selected === 'positive' ? 'replied' : selected === 'nda' ? 'mercor_candidate' : selected;
    return `<option value="">Not contacted</option>${optionList(['contacted','follow_up','no_response','replied','meeting','data_discussion','mercor_candidate'], aliases)}`;
  }
  function optionList(values, selected) { return values.map((value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${labelize(value)}</option>`).join(''); }

  function companyOutreach(company) {
    const outreach = state.outreachByCin[company.cin] || {};
    const r = readiness(company);
    return `<div class="detail-grid"><div><h3>Communication status</h3><form id="outreachForm"><div class="form-grid"><div class="field"><label>Status</label><select class="select" id="outreachStatus">${outreachOptions(outreach.status)}</select></div><div class="field"><label>Channel</label><select class="select" id="outreachChannel">${optionList(['email','phone','linkedin','whatsapp','other'], outreach.channel)}</select></div><div class="field full"><label>Next step / note</label><textarea id="outreachNote" placeholder="What happened and what should happen next?">${esc(outreach.note || '')}</textarea></div><div class="field full"><button class="btn btn-primary" type="submit">Save outreach status</button></div></div></form></div><div><h3>Current stage</h3><div class="empty-card compact-empty outreach-stage">${stageBadge(M.opportunityStage(company, state.contactsByCin, state.outreachByCin))}<p>${esc(outreach.updatedAt ? `Last updated ${new Date(outreach.updatedAt).toLocaleString()}` : 'No outreach activity recorded yet.')}</p><p>${esc(r.label)}</p></div></div></div>`;
  }

  function companyNotes(company) {
    return `<div><h3>Research notes</h3><textarea id="companyNotes" placeholder="Director clues, source URLs, call notes, ownership questions…">${esc(state.notesByCin[company.cin] || '')}</textarea><div class="notes-actions"><button class="btn btn-primary" id="saveNotes" type="button">Save notes</button></div></div>`;
  }

  function wireCompanyTab(company, route) {
    if (state.companyTab === 'contacts') {
      const wrap = document.getElementById('addContactWrap');
      document.getElementById('showAddContact')?.addEventListener('click', () => { wrap.style.display = 'block'; document.getElementById('contactName')?.focus(); });
      document.getElementById('cancelAddContact')?.addEventListener('click', () => { wrap.style.display = 'none'; });
      document.getElementById('addContactForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const contact = {
          name: document.getElementById('contactName').value.trim(), designation: document.getElementById('contactDesignation').value.trim(), email: document.getElementById('contactEmail').value.trim(), phone: document.getElementById('contactPhone').value.trim(), linkedin: document.getElementById('contactLinkedin').value.trim(), source: document.getElementById('contactSource').value.trim(), verified: document.getElementById('contactVerified').checked, addedAt: new Date().toISOString(),
        };
        if (!contact.name && !contact.email && !contact.phone && !contact.linkedin) return toast('Add at least a person name or direct channel.');
        state.contactsByCin[company.cin] = [...savedContacts(company), contact];
        writeStore(STORAGE.contacts, state.contactsByCin);
        toast('Person saved.');
        companyScreen(route);
      });
      document.querySelectorAll('[data-delete-contact]').forEach((button) => button.addEventListener('click', () => {
        const index = Number(button.dataset.deleteContact);
        const next = savedContacts(company).filter((_, i) => i !== index);
        if (next.length) state.contactsByCin[company.cin] = next; else delete state.contactsByCin[company.cin];
        writeStore(STORAGE.contacts, state.contactsByCin);
        companyScreen(route);
      }));
    }
    if (state.companyTab === 'digital') {
      document.getElementById('websiteCheckForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        state.websiteChecksByCin[company.cin] = { status: document.getElementById('websiteStatus').value, source: document.getElementById('websiteSource').value.trim(), checkedAt: new Date().toISOString() };
        writeStore(STORAGE.websites, state.websiteChecksByCin);
        toast('Website status saved.');
        companyScreen(route);
      });
    }
    if (state.companyTab === 'outreach') {
      document.getElementById('outreachForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const selected = document.getElementById('outreachStatus').value;
        const status = selected === 'replied' ? 'positive' : selected === 'mercor_candidate' ? 'nda' : selected;
        state.outreachByCin[company.cin] = { status, channel: document.getElementById('outreachChannel').value, note: document.getElementById('outreachNote').value.trim(), updatedAt: new Date().toISOString() };
        writeStore(STORAGE.outreach, state.outreachByCin);
        toast('Outreach status saved.');
        companyScreen(route);
      });
    }
    if (state.companyTab === 'notes') {
      document.getElementById('saveNotes')?.addEventListener('click', () => {
        state.notesByCin[company.cin] = document.getElementById('companyNotes').value.trim();
        writeStore(STORAGE.notes, state.notesByCin);
        toast('Research notes saved.');
      });
    }
  }

  function listRoute(screen, options = {}) {
    const params = new URLSearchParams();
    if (options.search) params.set('search', options.search);
    if (options.sector) params.set('sector', options.sector);
    const query = params.toString();
    return `#/${screen}${query ? `?${query}` : ''}`;
  }

  function researchScreen(route) {
    const searchValue = route.search || '';
    const sectorValue = route.sector || '';
    const queue = state.companies.filter((company) => !personCompleteness(company).fields.person);
    let rows = queue;
    if (sectorValue) rows = rows.filter((company) => M.deriveSector(company) === sectorValue);
    if (searchValue) { const q = searchValue.toLowerCase(); rows = rows.filter((company) => `${company.name} ${company.cin} ${company.state}`.toLowerCase().includes(q)); }
    const missingEmail = queue.filter((company) => !personCompleteness(company).fields.email).length;
    const missingPhone = queue.filter((company) => !personCompleteness(company).fields.phone).length;
    const missingLinkedin = queue.filter((company) => !personCompleteness(company).fields.linkedin).length;
    setHeader('Research Queue — Find Missing Contacts', 'Prioritize companies where the director/founder/key person has not yet been identified.', 'Research queue → person missing');
    setActiveNav('research');
    els.content.innerHTML = `<section class="stats-grid research-stats">${statCard('Person not found', queue.length, 'Primary research queue', 'amber')}${statCard('Missing direct email', missingEmail, 'Person-level email')}${statCard('Missing direct phone', missingPhone, 'Person-level phone')}${statCard('Missing LinkedIn', missingLinkedin, 'Person profile')}</section><section class="section-card"><div class="section-head"><div><h2>Research queue</h2><p>Find the real person first, then capture direct channels and sources.</p></div></div><div class="section-body"><div class="toolbar"><input id="researchSearch" class="input grow" type="search" placeholder="Search company, CIN, state…" value="${attr(searchValue)}"/><select id="researchSector" class="select compact-select"><option value="">All sectors</option>${M.SECTORS.map((sector) => `<option value="${sector.key}" ${sectorValue === sector.key ? 'selected' : ''}>${esc(sector.label)}</option>`).join('')}</select><button class="btn btn-secondary" id="clearResearchFilters" type="button">Clear</button></div></div>${researchTable(rows)}</section>`;
    document.getElementById('researchSearch')?.addEventListener('input', (event) => { replaceHash(listRoute('research', { search: event.target.value.trim(), sector: sectorValue })); document.getElementById('researchSearch')?.focus(); });
    document.getElementById('researchSector')?.addEventListener('change', (event) => replaceHash(listRoute('research', { search: searchValue, sector: event.target.value })));
    document.getElementById('clearResearchFilters')?.addEventListener('click', () => replaceHash('#/research'));
    restoreScroll(currentHash());
  }

  function researchTable(companies) {
    if (!companies.length) return '<div class="empty-card">No companies match this research filter.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Sector</th><th>State</th><th>Existing company channels</th><th>Missing person fields</th><th>Readiness</th><th>Action</th></tr></thead><tbody>${companies.map((company) => {
      const companyLevel = companyCompleteness(company);
      const person = personCompleteness(company);
      const missing = Object.entries(person.fields).filter(([, value]) => !value).map(([key]) => key === 'person' ? 'Person' : labelize(key)).join(' · ');
      return `<tr><td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td><td><span class="badge blue">${esc(sectorMeta(company).label)}</span></td><td>${esc(company.state || '—')}</td><td>${esc(companyLevel.label)} (${companyLevel.score}/${companyLevel.total})</td><td>${esc(missing || 'None')}</td><td>${readinessBadge(company)}</td><td><a class="btn btn-primary btn-sm" data-company-link="1" href="${attr(M.buildCompanyRoute(company.cin, currentHash()))}">Research</a></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function outreachScreen(route) {
    const searchValue = route.search || '';
    const contactReady = state.companies.filter((company) => ['ready_to_contact', 'verified_contact'].includes(readiness(company).key));
    let rows = contactReady.map((company) => ({ company, outreach: state.outreachByCin[company.cin] || {}, stage: M.opportunityStage(company, state.contactsByCin, state.outreachByCin) }));
    if (searchValue) { const q = searchValue.toLowerCase(); rows = rows.filter(({ company }) => `${company.name} ${company.cin}`.toLowerCase().includes(q)); }
    const contacted = rows.filter((row) => ['contacted','replied','meeting','data_discussion','mercor_candidate'].includes(row.stage)).length;
    setHeader('Outreach Tracker', 'Track the person, channel, response, and next step once the record is truly ready to contact.', 'Person identified → outreach');
    setActiveNav('outreach');
    els.content.innerHTML = `<section class="stats-grid research-stats">${statCard('Ready to contact', contactReady.length, 'Person + direct channel', 'green')}${statCard('Contacted', contacted, 'Outreach activity recorded', 'blue')}${statCard('Replied', rows.filter((row) => row.stage === 'replied').length, 'Positive response')}${statCard('Meetings', rows.filter((row) => row.stage === 'meeting').length, 'Meeting stage')}</section><section class="section-card"><div class="section-head"><div><h2>Communication tracker</h2><p>Update status directly or open the company dossier.</p></div></div><div class="section-body"><input id="outreachSearch" class="input" type="search" placeholder="Search contact-ready companies…" value="${attr(searchValue)}"/></div>${outreachTable(rows)}</section>`;
    document.getElementById('outreachSearch')?.addEventListener('input', (event) => { replaceHash(listRoute('outreach', { search: event.target.value.trim() })); document.getElementById('outreachSearch')?.focus(); });
    document.querySelectorAll('[data-quick-status]').forEach((select) => select.addEventListener('change', () => {
      const cin = select.dataset.quickStatus;
      const selected = select.value;
      const status = selected === 'replied' ? 'positive' : selected === 'mercor_candidate' ? 'nda' : selected;
      state.outreachByCin[cin] = { ...(state.outreachByCin[cin] || {}), status, updatedAt: new Date().toISOString() };
      writeStore(STORAGE.outreach, state.outreachByCin);
      toast('Outreach stage updated.'); render();
    }));
    restoreScroll(currentHash());
  }

  function outreachTable(rows) {
    if (!rows.length) return '<div class="empty-card">No contact-ready companies match this search.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Person</th><th>Direct channel</th><th>Stage</th><th>Quick update</th><th>Next step</th></tr></thead><tbody>${rows.map(({ company, outreach, stage }) => {
      const person = primaryPerson(company);
      const channel = person?.email || person?.phone || person?.linkedin || 'Direct channel saved in another person record';
      return `<tr><td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td><td>${person?.name ? `<strong>${esc(person.name)}</strong><div class="person-role">${esc(person.designation || 'Role not captured')}</div>` : '<span class="missing">Person not researched</span>'}</td><td>${esc(channel)}</td><td>${stageBadge(stage)}</td><td><select class="select" data-quick-status="${attr(company.cin)}"><option value="" ${!outreach.status ? 'selected' : ''}>Not contacted</option>${outreachOptions(outreach.status).replace('<option value="">Not contacted</option>', '')}</select></td><td><a class="btn btn-secondary btn-sm" data-company-link="1" href="${attr(M.buildCompanyRoute(company.cin, currentHash()))}">Open dossier</a></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function pipelineScreen() {
    const stageKeys = ['research','channel_found','person_identified','contacted','replied','meeting','data_discussion','mercor_candidate'];
    const grouped = Object.fromEntries(stageKeys.map((key) => [key, []]));
    for (const company of state.companies) {
      const stage = M.opportunityStage(company, state.contactsByCin, state.outreachByCin);
      if (!grouped[stage]) grouped[stage] = [];
      grouped[stage].push(company);
    }
    setHeader('Contact Pipeline', 'Operational funnel from company research to an active data/code conversation.', 'Research → person → outreach → conversation');
    setActiveNav('pipeline');
    const rows = state.companies.slice().sort((a, b) => stageRank(M.opportunityStage(b, state.contactsByCin, state.outreachByCin)) - stageRank(M.opportunityStage(a, state.contactsByCin, state.outreachByCin)));
    els.content.innerHTML = `<section class="pipeline-cards pipeline-cards-eight">${stageKeys.map((stage) => `<div class="pipeline-card ${stage}"><span>${stageBadge(stage)}</span><strong>${num(grouped[stage].length)}</strong></div>`).join('')}</section><section class="section-card"><div class="section-head"><div><h2>All companies by next action</h2><p>The pipeline is driven by person/channel readiness and saved outreach activity.</p></div></div><div class="table-wrap"><table><thead><tr><th>Company</th><th>Sector</th><th>Readiness</th><th>Stage</th><th>Next action</th></tr></thead><tbody>${rows.map((company) => {
      const stage = M.opportunityStage(company, state.contactsByCin, state.outreachByCin);
      return `<tr><td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td><td>${esc(sectorMeta(company).label)}</td><td>${readinessBadge(company)}</td><td>${stageBadge(stage)}</td><td><a class="btn btn-primary btn-sm" data-company-link="1" href="${attr(M.buildCompanyRoute(company.cin, currentHash()))}">${esc(nextAction(stage))}</a></td></tr>`;
    }).join('')}</tbody></table></div></section>`;
    restoreScroll(currentHash());
  }

  function stageRank(stage) { return { research: 0, channel_found: 1, person_identified: 2, contacted: 3, replied: 4, meeting: 5, data_discussion: 6, mercor_candidate: 7 }[stage] || 0; }
  function nextAction(stage) { return { research: 'Research person', channel_found: 'Find decision-maker', person_identified: 'Start outreach', contacted: 'Follow up', replied: 'Book / manage call', meeting: 'Discuss data / code', data_discussion: 'Qualify for Mercor', mercor_candidate: 'Manage opportunity' }[stage] || 'Open'; }

  function render() {
    const route = M.parseRoute(location.hash);
    if (route.screen === 'overview') return overviewScreen(false);
    if (route.screen === 'sectors') return overviewScreen(true);
    if (route.screen === 'sector') return sectorScreen(route);
    if (route.screen === 'company') return companyScreen(route);
    if (route.screen === 'research') return researchScreen(route);
    if (route.screen === 'outreach') return outreachScreen(route);
    if (route.screen === 'pipeline') return pipelineScreen(route);
    return overviewScreen(false);
  }

  function currentExportRows() {
    const route = M.parseRoute(location.hash);
    let companies = state.companies;
    if (route.screen === 'sector') {
      companies = M.sectorCompanies(companies, route.sector);
      if (route.contactState === 'channel') companies = companies.filter((company) => companyCompleteness(company).score > 0);
      if (route.contactState === 'person') companies = companies.filter((company) => personCompleteness(company).fields.person);
      if (route.contactState === 'research') companies = companies.filter((company) => !personCompleteness(company).fields.person);
      if (route.search) { const q = route.search.toLowerCase(); companies = companies.filter((company) => `${company.name} ${company.cin} ${company.state}`.toLowerCase().includes(q)); }
      if (route.state) companies = companies.filter((company) => company.state === route.state);
    }
    if (route.screen === 'research') companies = companies.filter((company) => !personCompleteness(company).fields.person);
    if (route.screen === 'outreach') companies = companies.filter((company) => ['ready_to_contact', 'verified_contact'].includes(readiness(company).key));
    if (route.screen === 'company') companies = companies.filter((company) => company.cin === route.cin);
    return companies.map((company) => {
      const person = M.personChannels(company, savedContacts(company));
      const companyLevel = M.companyChannels(company);
      return { company: company.name, cin: company.cin, state: company.state || '', sector: sectorMeta(company).label, readiness: readiness(company).label, person_names: person.people.join(' | '), direct_emails: person.emails.join(' | '), direct_phones: person.phones.join(' | '), linkedins: person.linkedins.join(' | '), website: companyLevel.website, website_status: websiteCheck(company).status, company_email: companyLevel.email, company_phone: companyLevel.phone, pipeline_stage: M.opportunityStage(company, state.contactsByCin, state.outreachByCin) };
    });
  }

  function csvEscape(value) {
    const text = String(value ?? '');
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  }
  function exportCurrentView() {
    const rows = currentExportRows();
    if (!rows.length) return toast('Nothing to export.');
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => csvEscape(row[header])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `apply-wizz-contact-intelligence-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast(`${rows.length} rows exported.`);
  }

  async function init() {
    try {
      const [companiesRes, summaryRes] = await Promise.all([fetch('data/companies.json'), fetch('data/summary.json')]);
      if (!companiesRes.ok || !summaryRes.ok) throw new Error(`Failed to load data (${companiesRes.status}/${summaryRes.status})`);
      state.companies = await companiesRes.json();
      state.summary = await summaryRes.json();
      els.sidebarSourceMeta.textContent = `${num(state.companies.length)} companies · strike-off ${state.summary.strike_off_date || 'source'}`;
      if (!location.hash) location.hash = '#/overview';
      render();
    } catch (error) {
      els.content.innerHTML = `<div class="empty-card"><strong>Could not load company data.</strong><p>${esc(error.message)}</p><p>Serve this folder over HTTP so the relative data files can load.</p></div>`;
      console.error(error);
    }
  }

  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[data-company-link]');
    if (link) rememberScroll(currentHash());
  });
  window.addEventListener('hashchange', render);
  els.exportBtn.addEventListener('click', exportCurrentView);
  init();
})();
