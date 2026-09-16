(() => {
  'use strict';

  const M = window.ContactIntelModel;
  const STORAGE = {
    contacts: 'swall.phase2.contacts',
    outreach: 'swall.phase2.outreach',
    notes: 'swall.phase2.notes',
  };

  const state = {
    companies: [],
    summary: null,
    contactsByCin: readStore(STORAGE.contacts, {}),
    outreachByCin: readStore(STORAGE.outreach, {}),
    notesByCin: readStore(STORAGE.notes, {}),
    companyTab: 'contacts',
    search: '',
    sectorFilter: '',
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

  function esc(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function attr(value) {
    return esc(value);
  }

  function num(value) {
    return Number(value || 0).toLocaleString('en-IN');
  }

  function labelize(value) {
    return String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
  }

  function toast(message) {
    els.toast.textContent = message;
    els.toast.classList.add('show');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => els.toast.classList.remove('show'), 1800);
  }

  function savedContacts(company) {
    return state.contactsByCin[company.cin] || [];
  }

  function primaryContact(company) {
    const saved = savedContacts(company);
    if (saved.length) return saved[0];
    return {
      name: company.director_name || '',
      designation: company.director_designation || '',
      email: company.email || '',
      phone: company.phone || '',
      linkedin: company.linkedin_url || '',
      source: company.email || company.phone ? 'Source dataset' : '',
    };
  }

  function channels(company) {
    return M.contactChannels(company, savedContacts(company));
  }

  function contactKnown(company) {
    return M.isContactKnown(company, savedContacts(company));
  }

  function completeness(company) {
    return M.contactCompleteness(company, savedContacts(company));
  }

  function sectorMeta(companyOrKey) {
    const key = typeof companyOrKey === 'string' ? companyOrKey : M.deriveSector(companyOrKey);
    return M.sectorMeta(key);
  }

  function statusBadge(company) {
    const c = completeness(company);
    const known = contactKnown(company);
    const cls = c.score === 4 ? 'green' : known ? 'amber' : 'gray';
    return `<span class="badge ${cls}">${known ? `${esc(c.label)} ${c.score}/${c.total}` : 'Unknown contact'}</span>`;
  }

  function stageBadge(stage) {
    const labels = {
      research: 'Research',
      contact_ready: 'Contact ready',
      contacted: 'Contacted',
      positive: 'Positive',
      nda: 'NDA / Opportunity',
    };
    const colors = { research: 'gray', contact_ready: 'blue', contacted: 'amber', positive: 'green', nda: 'purple' };
    return `<span class="badge ${colors[stage] || 'gray'}">${labels[stage] || labelize(stage)}</span>`;
  }

  function setHeader(title, subtitle, breadcrumb) {
    els.pageTitle.textContent = title;
    els.pageSubtitle.textContent = subtitle;
    els.breadcrumb.textContent = breadcrumb;
  }

  function setActiveNav(screen) {
    document.querySelectorAll('[data-nav]').forEach((node) => node.classList.toggle('active', node.dataset.nav === screen || (screen === 'sector' && node.dataset.nav === 'sector')));
  }

  function snapshotStats(companies = state.companies) {
    let known = 0;
    let person = 0;
    let email = 0;
    let phone = 0;
    let linkedin = 0;
    for (const company of companies) {
      if (contactKnown(company)) known += 1;
      const c = channels(company);
      if (c.people.length) person += 1;
      if (c.emails.length) email += 1;
      if (c.phones.length) phone += 1;
      if (c.linkedins.length) linkedin += 1;
    }
    return { total: companies.length, known, unknown: companies.length - known, person, email, phone, linkedin };
  }

  function overviewScreen() {
    const stats = snapshotStats();
    const sectors = M.aggregateBySector(state.companies, state.contactsByCin);
    setHeader('Contact Acquisition Intelligence', 'Understand the sector, identify the right person, verify a channel, then contact them.', 'Company universe → sector → contact');
    setActiveNav('overview');

    els.content.innerHTML = `
      <section class="stats-grid">
        ${statCard('Total companies', stats.total, 'MCA STK-7 inventory', 'blue')}
        ${statCard('Contact ready', stats.known, `${percent(stats.known, stats.total)} of companies`, 'green')}
        ${statCard('Unknown contact', stats.unknown, 'Needs person/contact research', 'amber')}
        ${statCard('Person name found', stats.person, 'Director / founder / key person')}
        ${statCard('Email found', stats.email, 'Company or person email')}
        ${statCard('Phone found', stats.phone, 'Company or person phone')}
      </section>

      <section class="section-card">
        <div class="section-head">
          <div><h2>Companies by sector</h2><p>First segmentation layer. Click any sector to split it into Known vs Unknown contacts.</p></div>
          <span class="badge blue">Derived from existing sector + NIC/name</span>
        </div>
        <div class="section-body">
          <div class="sector-grid">
            ${sectors.map((row) => `
              <a class="sector-card" href="#/sector/${encodeURIComponent(row.key)}">
                <span class="sector-icon">${esc(row.icon)}</span>
                <div><h3>${esc(row.label)}</h3><div class="sector-total">${num(row.total)}</div></div>
                <div class="sector-split">
                  <div class="mini-count known"><strong>${num(row.known)}</strong>Known</div>
                  <div class="mini-count unknown"><strong>${num(row.unknown)}</strong>Unknown</div>
                </div>
              </a>`).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function statCard(label, value, sub, tone = '') {
    return `<article class="stat-card ${tone}"><div class="label"><span>${esc(label)}</span></div><div class="value">${num(value)}</div><div class="sub">${esc(sub)}</div></article>`;
  }

  function percent(value, total) {
    return total ? `${((value / total) * 100).toFixed(1)}%` : '0%';
  }

  function sectorScreen(route) {
    const meta = sectorMeta(route.sector);
    const all = M.sectorCompanies(state.companies, route.sector);
    const stats = snapshotStats(all);
    const contactState = route.contactState || 'all';
    let rows = all;
    if (contactState === 'known') rows = all.filter(contactKnown);
    if (contactState === 'unknown') rows = all.filter((company) => !contactKnown(company));
    if (state.search) {
      const q = state.search.toLowerCase();
      rows = rows.filter((company) => `${company.name} ${company.cin} ${company.state}`.toLowerCase().includes(q));
    }

    setHeader(`${meta.label} — Contact Segmentation`, `${num(all.length)} companies. The immediate job is to separate contact-ready companies from those that still need enrichment.`, `Sectors → ${meta.label} → ${contactState === 'all' ? 'all companies' : contactState}`);
    setActiveNav('sector');

    els.content.innerHTML = `
      <section class="sector-hero">
        <div class="hero-card">
          <div class="sector-label">Research sector</div>
          <h2>${esc(meta.label)}</h2>
          <p>Auto-classified from the existing sector flag plus NIC/name heuristics. Treat this as a research segmentation, not a verified industry label.</p>
          <div class="hero-count"><strong>${num(all.length)}</strong><span>companies in this sector</span></div>
        </div>
        <div>
          <div class="contact-state-grid">
            <a class="contact-state known" href="#/sector/${encodeURIComponent(route.sector)}/known"><span class="state-label">Known contact</span><div class="state-value">${num(stats.known)}</div><p>At least one usable email, phone, or LinkedIn channel.</p></a>
            <a class="contact-state unknown" href="#/sector/${encodeURIComponent(route.sector)}/unknown"><span class="state-label">Unknown contact</span><div class="state-value">${num(stats.unknown)}</div><p>No usable contact channel yet. Research queue.</p></a>
          </div>
          <div class="quick-grid">
            ${quickStat('People', stats.person)}
            ${quickStat('Emails', stats.email)}
            ${quickStat('Phones', stats.phone)}
            ${quickStat('LinkedIn', stats.linkedin)}
          </div>
        </div>
      </section>

      <section class="section-card">
        <div class="section-head">
          <div>
            <h2>${contactState === 'all' ? 'All companies' : contactState === 'known' ? 'Known contacts' : 'Unknown contacts'}</h2>
            <p>${num(rows.length)} results in ${esc(meta.label)}.</p>
          </div>
          <div class="tabs">
            <a class="tab ${contactState === 'all' ? 'active' : ''}" href="#/sector/${encodeURIComponent(route.sector)}">All ${num(all.length)}</a>
            <a class="tab ${contactState === 'known' ? 'active' : ''}" href="#/sector/${encodeURIComponent(route.sector)}/known">Known ${num(stats.known)}</a>
            <a class="tab ${contactState === 'unknown' ? 'active' : ''}" href="#/sector/${encodeURIComponent(route.sector)}/unknown">Unknown ${num(stats.unknown)}</a>
          </div>
        </div>
        <div class="section-body">
          <div class="toolbar"><input id="sectorSearch" class="input grow" type="search" placeholder="Search company name, CIN, state…" value="${attr(state.search)}" /><button class="btn btn-secondary" type="button" id="clearSectorSearch">Clear</button></div>
        </div>
        ${companyTable(rows, { showSector: false })}
      </section>
    `;

    const search = document.getElementById('sectorSearch');
    if (search) search.addEventListener('input', () => { state.search = search.value.trim(); sectorScreen(route); const next = document.getElementById('sectorSearch'); if (next) { next.focus(); next.setSelectionRange(next.value.length, next.value.length); } });
    document.getElementById('clearSectorSearch')?.addEventListener('click', () => { state.search = ''; sectorScreen(route); });
  }

  function quickStat(label, value) {
    return `<div class="quick-stat"><span>${esc(label)}</span><strong>${num(value)}</strong></div>`;
  }

  function companyTable(companies, options = {}) {
    if (!companies.length) return `<div class="empty-card">No companies match this view.</div>`;
    return `<div class="table-wrap"><table><thead><tr><th>Company</th>${options.showSector !== false ? '<th>Sector</th>' : ''}<th>State</th><th>Contact status</th><th>Person</th><th>Email</th><th>Phone</th><th>Action</th></tr></thead><tbody>${companies.map((company) => {
      const contact = primaryContact(company);
      const meta = sectorMeta(company);
      return `<tr>
        <td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td>
        ${options.showSector !== false ? `<td><span class="badge blue">${esc(meta.label)}</span></td>` : ''}
        <td>${esc(company.state || '—')}</td>
        <td>${statusBadge(company)}</td>
        <td>${contact.name ? `<span class="person-name">${esc(contact.name)}</span><div class="person-role">${esc(contact.designation || 'Role not captured')}</div>` : '<span class="missing">Not researched</span>'}</td>
        <td>${contact.email ? `<a href="mailto:${attr(contact.email)}">${esc(contact.email)}</a>` : '<span class="missing">Missing</span>'}</td>
        <td>${contact.phone ? `<a href="tel:${attr(contact.phone)}">${esc(contact.phone)}</a>` : '<span class="missing">Missing</span>'}</td>
        <td><a class="btn btn-primary btn-sm" href="#/company/${encodeURIComponent(company.cin)}">${contactKnown(company) ? 'View contact' : 'Research'}</a></td>
      </tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function companyScreen(route) {
    const company = state.companies.find((item) => item.cin === route.cin);
    if (!company) {
      setHeader('Company not found', 'This CIN is not present in the loaded inventory.', 'Companies');
      els.content.innerHTML = '<div class="empty-card">Company not found.</div>';
      return;
    }

    const meta = sectorMeta(company);
    const complete = completeness(company);
    const known = contactKnown(company);
    setHeader(company.name, 'Company contact dossier — identify the right person and make the record outreach-ready.', `${meta.label} → Company → contact dossier`);
    setActiveNav('sector');

    const tabs = ['overview', 'contacts', 'digital', 'outreach', 'notes'];
    if (!tabs.includes(state.companyTab)) state.companyTab = 'contacts';

    els.content.innerHTML = `
      <section class="dossier-head">
        <div class="company-identity">
          <div class="identity-row"><div class="company-avatar">${esc(meta.icon)}</div><div><h2>${esc(company.name)}</h2><code>${esc(company.cin)}</code><div class="identity-badges"><span class="badge blue">${esc(meta.label)}</span><span class="badge gray">${esc(company.state || 'State unknown')}</span>${known ? '<span class="badge green">Contact known</span>' : '<span class="badge amber">Contact unknown</span>'}</div></div></div>
        </div>
        <div class="completeness-card"><span>Contact completeness</span><div class="score">${complete.score}/${complete.total}</div><p>${esc(complete.label)} · person, email, phone, LinkedIn</p><div class="progress"><span style="width:${complete.score / complete.total * 100}%"></span></div></div>
      </section>

      <section class="section-card">
        <div class="section-head"><div class="tabs">${tabs.map((tab) => `<button class="tab ${state.companyTab === tab ? 'active' : ''}" type="button" data-company-tab="${tab}">${tab === 'digital' ? 'Digital footprint' : labelize(tab)}</button>`).join('')}</div><a class="btn btn-secondary" href="#/sector/${encodeURIComponent(meta.key)}">Back to sector</a></div>
        <div class="section-body" id="companyTabBody">${renderCompanyTab(company, state.companyTab)}</div>
      </section>
    `;

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

  function companyOverview(company) {
    const c = channels(company);
    return `<div class="detail-grid"><div><h3>Company information</h3><div class="info-grid">${info('CIN', company.cin)}${info('State', company.state)}${info('Incorporation year', company.year)}${info('Entity type', company.entity_type)}${info('NIC', company.nic)}${info('Source status', 'Dissolved / STK-7')}</div></div><div><h3>Contact summary</h3><div class="info-grid">${info('People found', c.people.length)}${info('Emails found', c.emails.length)}${info('Phones found', c.phones.length)}${info('LinkedIn found', c.linkedins.length)}</div></div></div>`;
  }

  function info(label, value, href) {
    const content = value || value === 0 ? esc(value) : '<span class="missing">Not available</span>';
    return `<div class="info-item"><span>${esc(label)}</span>${href ? `<a href="${attr(href)}" target="_blank" rel="noopener noreferrer">${content}</a>` : `<strong>${content}</strong>`}</div>`;
  }

  function companyContacts(company) {
    const saved = savedContacts(company);
    const sourceHasContact = Boolean(company.email || company.phone || company.director_name || company.linkedin_url);
    const sourceRow = sourceHasContact ? contactRow({ name: company.director_name || '', designation: company.director_designation || '', email: company.email || '', phone: company.phone || '', linkedin: company.linkedin_url || '', source: 'Source dataset' }, true) : '';
    return `
      <div class="section-head" style="padding:0 0 13px;border:0"><div><h2>Directors / founders / key people</h2><p>Only factual source fields or contacts manually saved by your research team appear here.</p></div><button class="btn btn-primary" type="button" id="showAddContact">+ Add contact</button></div>
      <div class="contact-list">${sourceRow}${saved.map((contact, index) => contactRow(contact, false, index)).join('')}${!sourceHasContact && !saved.length ? '<div class="empty-card">No person/contact data has been researched yet. Use the research tools below and add the first verified contact.</div>' : ''}</div>
      <div id="addContactWrap" style="margin-top:14px;display:none">${addContactForm(company)}</div>
      <div style="margin-top:16px"><h3>Research shortcuts</h3><div class="research-shortcuts">${researchLinks(company)}</div></div>
    `;
  }

  function contactRow(contact, source = false, index = -1) {
    return `<div class="contact-card ${source ? 'source-contact' : ''}">
      <div><small>Person</small>${contact.name ? `<strong>${esc(contact.name)}</strong><div class="person-role">${esc(contact.designation || 'Role not captured')}</div>` : '<span class="missing">Name not researched</span>'}</div>
      <div><small>Email</small>${contact.email ? `<a href="mailto:${attr(contact.email)}">${esc(contact.email)}</a>` : '<span class="missing">Missing</span>'}</div>
      <div><small>Phone</small>${contact.phone ? `<a href="tel:${attr(contact.phone)}">${esc(contact.phone)}</a>` : '<span class="missing">Missing</span>'}</div>
      <div><small>LinkedIn</small>${contact.linkedin ? `<a href="${attr(contact.linkedin)}" target="_blank" rel="noopener noreferrer">Open profile</a>` : '<span class="missing">Missing</span>'}</div>
      <div>${source ? '<span class="badge gray">Source</span>' : `<button class="btn btn-secondary btn-sm" data-delete-contact="${index}" type="button">Remove</button>`}</div>
    </div>`;
  }

  function addContactForm(company) {
    return `<form id="addContactForm" class="section-card" style="box-shadow:none"><div class="section-body"><div class="form-grid">
      ${field('Name', 'contactName', 'Director / founder name')}${field('Designation', 'contactDesignation', 'Director, Founder, CTO…')}
      ${field('Email', 'contactEmail', 'name@company.com', 'email')}${field('Phone', 'contactPhone', '+91…', 'tel')}
      ${field('LinkedIn URL', 'contactLinkedin', 'https://linkedin.com/in/…', 'url')}${field('Source', 'contactSource', 'MCA, LinkedIn, website, call…')}
      <div class="field full"><label class="checkbox-row"><input type="checkbox" id="contactVerified" /> Verified by researcher</label></div>
      <div class="field full"><div class="toolbar"><button class="btn btn-primary" type="submit">Save contact</button><button class="btn btn-secondary" type="button" id="cancelAddContact">Cancel</button></div></div>
    </div></div></form>`;
  }

  function field(label, id, placeholder, type = 'text') {
    return `<div class="field"><label for="${id}">${esc(label)}</label><input class="input" id="${id}" name="${id}" type="${type}" placeholder="${attr(placeholder)}" /></div>`;
  }

  function researchLinks(company) {
    const q = encodeURIComponent(`"${company.name}" director founder`);
    const qEmail = encodeURIComponent(`"${company.name}" email phone director`);
    const qLinkedin = encodeURIComponent(`${company.name} founder director`);
    return [
      ['Search web', `https://www.google.com/search?q=${q}`],
      ['Search contact details', `https://www.google.com/search?q=${qEmail}`],
      ['Search LinkedIn', `https://www.linkedin.com/search/results/people/?keywords=${qLinkedin}`],
      ['Search company + CIN', `https://www.google.com/search?q=${encodeURIComponent(`${company.cin} ${company.name}`)}`],
    ].map(([label, href]) => `<a class="btn btn-secondary" href="${href}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`).join('');
  }

  function companyDigital(company) {
    return `<div class="detail-grid"><div><h3>Digital footprint</h3><div class="info-grid">${info('Website', company.website_url || '', company.website_url || '')}${info('Website status', company.website_status || 'Not checked')}${info('GitHub', company.github_url || '', company.github_url || '')}${info('Public repos', company.github_repos ?? 'Not checked')}${info('Code signal', company.code_signal || 'Not checked')}${info('Evidence', company.evidence || 'No evidence captured')}</div></div><div><h3>Research reminder</h3><div class="empty-card" style="padding:22px">A live website or GitHub profile does not make the company contact-ready. The contact workflow is complete only when a usable person/channel is found and recorded.</div></div></div>`;
  }

  function companyOutreach(company) {
    const outreach = state.outreachByCin[company.cin] || {};
    return `<div class="detail-grid"><div><h3>Communication status</h3><form id="outreachForm"><div class="form-grid"><div class="field"><label>Status</label><select class="select" id="outreachStatus">${outreachOptions(outreach.status)}</select></div><div class="field"><label>Channel</label><select class="select" id="outreachChannel">${optionList(['email','phone','linkedin','whatsapp','other'], outreach.channel)}</select></div><div class="field full"><label>Next step / note</label><textarea id="outreachNote" placeholder="What happened and what should happen next?">${esc(outreach.note || '')}</textarea></div><div class="field full"><button class="btn btn-primary" type="submit">Save outreach status</button></div></div></form></div><div><h3>Current stage</h3><div class="empty-card" style="padding:22px">${stageBadge(M.opportunityStage(company, state.contactsByCin, state.outreachByCin))}<p style="margin:10px 0 0">${esc(outreach.updatedAt ? `Last updated ${new Date(outreach.updatedAt).toLocaleString()}` : 'No outreach activity recorded yet.')}</p></div></div></div>`;
  }

  function outreachOptions(selected) {
    return `<option value="">Not contacted</option>${optionList(['contacted','follow_up','no_response','positive','nda'], selected)}`;
  }

  function optionList(values, selected) {
    return values.map((value) => `<option value="${value}" ${value === selected ? 'selected' : ''}>${labelize(value)}</option>`).join('');
  }

  function companyNotes(company) {
    return `<div><h3>Research notes</h3><textarea id="companyNotes" placeholder="Director clues, source URLs, call notes, ownership questions…">${esc(state.notesByCin[company.cin] || '')}</textarea><div style="margin-top:9px"><button class="btn btn-primary" id="saveNotes" type="button">Save notes</button></div></div>`;
  }

  function wireCompanyTab(company, route) {
    if (state.companyTab === 'contacts') {
      const wrap = document.getElementById('addContactWrap');
      document.getElementById('showAddContact')?.addEventListener('click', () => { wrap.style.display = 'block'; document.getElementById('contactName')?.focus(); });
      document.getElementById('cancelAddContact')?.addEventListener('click', () => { wrap.style.display = 'none'; });
      document.getElementById('addContactForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        const contact = {
          name: document.getElementById('contactName').value.trim(),
          designation: document.getElementById('contactDesignation').value.trim(),
          email: document.getElementById('contactEmail').value.trim(),
          phone: document.getElementById('contactPhone').value.trim(),
          linkedin: document.getElementById('contactLinkedin').value.trim(),
          source: document.getElementById('contactSource').value.trim(),
          verified: document.getElementById('contactVerified').checked,
          addedAt: new Date().toISOString(),
        };
        if (!contact.name && !contact.email && !contact.phone && !contact.linkedin) {
          toast('Add at least a name or contact channel.');
          return;
        }
        state.contactsByCin[company.cin] = [...savedContacts(company), contact];
        writeStore(STORAGE.contacts, state.contactsByCin);
        toast('Contact saved.');
        companyScreen(route);
      });
      document.querySelectorAll('[data-delete-contact]').forEach((button) => button.addEventListener('click', () => {
        const index = Number(button.dataset.deleteContact);
        const next = savedContacts(company).filter((_, i) => i !== index);
        if (next.length) state.contactsByCin[company.cin] = next;
        else delete state.contactsByCin[company.cin];
        writeStore(STORAGE.contacts, state.contactsByCin);
        companyScreen(route);
      }));
    }

    if (state.companyTab === 'outreach') {
      document.getElementById('outreachForm')?.addEventListener('submit', (event) => {
        event.preventDefault();
        state.outreachByCin[company.cin] = {
          status: document.getElementById('outreachStatus').value,
          channel: document.getElementById('outreachChannel').value,
          note: document.getElementById('outreachNote').value.trim(),
          updatedAt: new Date().toISOString(),
        };
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

  function researchScreen() {
    const unknown = state.companies.filter((company) => !contactKnown(company));
    const sectors = M.aggregateBySector(unknown, state.contactsByCin);
    let rows = unknown;
    if (state.sectorFilter) rows = rows.filter((company) => M.deriveSector(company) === state.sectorFilter);
    if (state.search) {
      const q = state.search.toLowerCase();
      rows = rows.filter((company) => `${company.name} ${company.cin} ${company.state}`.toLowerCase().includes(q));
    }
    setHeader('Unknown Companies — Research & Enrich', 'This is the work queue: companies where we still cannot reach a real person or usable channel.', 'Research queue → missing contacts');
    setActiveNav('research');
    els.content.innerHTML = `
      <section class="stats-grid">${statCard('Unknown companies', unknown.length, 'No usable channel yet', 'amber')}${statCard('Sectors affected', sectors.length, 'Research across sectors')}${statCard('Contact ready', state.companies.length - unknown.length, 'Already has a channel', 'green')}</section>
      <section class="section-card"><div class="section-head"><div><h2>Research queue</h2><p>Find director/founder/key-person name plus email, phone, or LinkedIn.</p></div></div><div class="section-body"><div class="toolbar"><input id="researchSearch" class="input grow" type="search" placeholder="Search company, CIN, state…" value="${attr(state.search)}"/><select id="researchSector" class="select" style="width:auto"><option value="">All sectors</option>${M.SECTORS.map((sector) => `<option value="${sector.key}" ${state.sectorFilter === sector.key ? 'selected' : ''}>${esc(sector.label)}</option>`).join('')}</select><button class="btn btn-secondary" id="clearResearchFilters" type="button">Clear</button></div></div>${researchTable(rows)}</section>`;
    document.getElementById('researchSearch')?.addEventListener('input', (e) => { state.search = e.target.value.trim(); researchScreen(); document.getElementById('researchSearch')?.focus(); });
    document.getElementById('researchSector')?.addEventListener('change', (e) => { state.sectorFilter = e.target.value; researchScreen(); });
    document.getElementById('clearResearchFilters')?.addEventListener('click', () => { state.search = ''; state.sectorFilter = ''; researchScreen(); });
  }

  function researchTable(companies) {
    if (!companies.length) return '<div class="empty-card">No unknown-contact companies match this filter.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Sector</th><th>State</th><th>Missing</th><th>Research state</th><th>Action</th></tr></thead><tbody>${companies.map((company) => `<tr><td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td><td><span class="badge blue">${esc(sectorMeta(company).label)}</span></td><td>${esc(company.state || '—')}</td><td>Person · Email · Phone · LinkedIn</td><td><span class="badge gray">Not contact-ready</span></td><td><a class="btn btn-primary btn-sm" href="#/company/${encodeURIComponent(company.cin)}">Research</a></td></tr>`).join('')}</tbody></table></div>`;
  }

  function outreachScreen() {
    const contactReady = state.companies.filter(contactKnown);
    let rows = contactReady.map((company) => ({ company, outreach: state.outreachByCin[company.cin] || {}, stage: M.opportunityStage(company, state.contactsByCin, state.outreachByCin) }));
    if (state.search) {
      const q = state.search.toLowerCase();
      rows = rows.filter(({ company }) => `${company.name} ${company.cin}`.toLowerCase().includes(q));
    }
    const contacted = rows.filter((row) => ['contacted','positive','nda'].includes(row.stage)).length;
    setHeader('Outreach Tracker', 'Only contact-ready companies belong here. Track the channel, response, and next step.', 'Contact ready → outreach');
    setActiveNav('outreach');
    els.content.innerHTML = `
      <section class="stats-grid">${statCard('Contact ready', contactReady.length, 'Can be contacted', 'green')}${statCard('Contacted', contacted, 'Outreach activity recorded', 'blue')}${statCard('Positive', rows.filter(r => r.stage === 'positive').length, 'Positive response')}${statCard('NDA / Opportunity', rows.filter(r => r.stage === 'nda').length, 'Advanced stage')}</section>
      <section class="section-card"><div class="section-head"><div><h2>Communication tracker</h2><p>Update status directly or open the company dossier for notes.</p></div></div><div class="section-body"><input id="outreachSearch" class="input" type="search" placeholder="Search contact-ready companies…" value="${attr(state.search)}"/></div>${outreachTable(rows)}</section>`;
    document.getElementById('outreachSearch')?.addEventListener('input', (e) => { state.search = e.target.value.trim(); outreachScreen(); document.getElementById('outreachSearch')?.focus(); });
    document.querySelectorAll('[data-quick-status]').forEach((select) => select.addEventListener('change', () => {
      const cin = select.dataset.quickStatus;
      state.outreachByCin[cin] = { ...(state.outreachByCin[cin] || {}), status: select.value, updatedAt: new Date().toISOString() };
      writeStore(STORAGE.outreach, state.outreachByCin);
      toast('Outreach stage updated.');
      outreachScreen();
    }));
  }

  function outreachTable(rows) {
    if (!rows.length) return '<div class="empty-card">No contact-ready companies match this search.</div>';
    return `<div class="table-wrap"><table><thead><tr><th>Company</th><th>Contact</th><th>Email / Phone</th><th>Stage</th><th>Quick update</th><th>Next step</th></tr></thead><tbody>${rows.map(({ company, outreach, stage }) => {
      const contact = primaryContact(company);
      return `<tr><td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td><td>${contact.name ? `<strong>${esc(contact.name)}</strong><div class="person-role">${esc(contact.designation || 'Role not captured')}</div>` : '<span class="missing">Person not researched</span>'}</td><td>${esc(contact.email || contact.phone || contact.linkedin || 'Channel available in another saved contact')}</td><td>${stageBadge(stage)}</td><td><select class="select" data-quick-status="${attr(company.cin)}" style="min-width:130px"><option value="" ${!outreach.status ? 'selected' : ''}>Not contacted</option>${optionList(['contacted','follow_up','no_response','positive','nda'], outreach.status)}</select></td><td><a class="btn btn-secondary btn-sm" href="#/company/${encodeURIComponent(company.cin)}">Open dossier</a></td></tr>`;
    }).join('')}</tbody></table></div>`;
  }

  function pipelineScreen() {
    const grouped = { research: [], contact_ready: [], contacted: [], positive: [], nda: [] };
    for (const company of state.companies) grouped[M.opportunityStage(company, state.contactsByCin, state.outreachByCin)].push(company);
    setHeader('Contact Pipeline — Next Steps', 'A simple operational funnel from unknown company to active conversation.', 'Research → contact ready → contacted → positive → NDA');
    setActiveNav('pipeline');
    const rows = state.companies.slice().sort((a, b) => stageRank(M.opportunityStage(b, state.contactsByCin, state.outreachByCin)) - stageRank(M.opportunityStage(a, state.contactsByCin, state.outreachByCin)));
    els.content.innerHTML = `
      <section class="pipeline-cards">${Object.entries(grouped).map(([stage, companies]) => `<div class="pipeline-card ${stage}"><span>${stage === 'nda' ? 'NDA / Opportunity' : labelize(stage)}</span><strong>${num(companies.length)}</strong></div>`).join('')}</section>
      <section class="section-card"><div class="section-head"><div><h2>All companies by next action</h2><p>The stage is driven by contact readiness and saved outreach status.</p></div></div><div class="table-wrap"><table><thead><tr><th>Company</th><th>Sector</th><th>Contact status</th><th>Stage</th><th>Next action</th></tr></thead><tbody>${rows.map((company) => { const stage = M.opportunityStage(company, state.contactsByCin, state.outreachByCin); return `<tr><td class="company-cell"><strong>${esc(company.name)}</strong><code>${esc(company.cin)}</code></td><td>${esc(sectorMeta(company).label)}</td><td>${statusBadge(company)}</td><td>${stageBadge(stage)}</td><td><a class="btn btn-primary btn-sm" href="#/company/${encodeURIComponent(company.cin)}">${nextAction(stage)}</a></td></tr>`; }).join('')}</tbody></table></div></section>`;
  }

  function stageRank(stage) {
    return { research: 0, contact_ready: 1, contacted: 2, positive: 3, nda: 4 }[stage] || 0;
  }

  function nextAction(stage) {
    return { research: 'Research contact', contact_ready: 'Start outreach', contacted: 'Follow up', positive: 'Qualify opportunity', nda: 'Manage NDA' }[stage] || 'Open';
  }

  function render() {
    const route = M.parseRoute(location.hash);
    if (route.screen !== 'sector') state.search = '';
    if (route.screen === 'overview') return overviewScreen();
    if (route.screen === 'sector') return sectorScreen(route);
    if (route.screen === 'company') return companyScreen(route);
    if (route.screen === 'research') return researchScreen();
    if (route.screen === 'outreach') return outreachScreen();
    if (route.screen === 'pipeline') return pipelineScreen();
    return overviewScreen();
  }

  function currentExportRows() {
    const route = M.parseRoute(location.hash);
    let companies = state.companies;
    if (route.screen === 'sector') {
      companies = M.sectorCompanies(companies, route.sector);
      if (route.contactState === 'known') companies = companies.filter(contactKnown);
      if (route.contactState === 'unknown') companies = companies.filter((company) => !contactKnown(company));
    }
    if (route.screen === 'research') companies = companies.filter((company) => !contactKnown(company));
    if (route.screen === 'outreach') companies = companies.filter(contactKnown);
    if (route.screen === 'company') companies = companies.filter((company) => company.cin === route.cin);
    return companies.map((company) => {
      const c = channels(company);
      return {
        company: company.name,
        cin: company.cin,
        state: company.state || '',
        sector: sectorMeta(company).label,
        contact_status: contactKnown(company) ? 'known' : 'unknown',
        people: c.people.join(' | '),
        emails: c.emails.join(' | '),
        phones: c.phones.join(' | '),
        linkedins: c.linkedins.join(' | '),
        pipeline_stage: M.opportunityStage(company, state.contactsByCin, state.outreachByCin),
      };
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

  window.addEventListener('hashchange', () => { state.search = ''; state.sectorFilter = ''; render(); });
  els.exportBtn.addEventListener('click', exportCurrentView);
  init();
})();
