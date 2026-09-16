(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ContactIntelModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const SECTORS = [
    { key: 'technology', label: 'Technology', icon: '⌘' },
    { key: 'biotech', label: 'Biotech', icon: '◉' },
    { key: 'healthcare_pharma', label: 'Healthcare & Pharma', icon: '✚' },
    { key: 'finance_fintech', label: 'Finance & Fintech', icon: '₹' },
    { key: 'logistics_supply', label: 'Logistics & Supply Chain', icon: '↗' },
    { key: 'education', label: 'Education', icon: '▰' },
    { key: 'manufacturing', label: 'Manufacturing', icon: '⚙' },
    { key: 'agriculture_food', label: 'Agriculture & Food', icon: '⌁' },
    { key: 'realestate_construction', label: 'Real Estate & Construction', icon: '▦' },
    { key: 'retail_commerce', label: 'Retail & Commerce', icon: '◫' },
    { key: 'hospitality_travel', label: 'Hospitality & Travel', icon: '⌂' },
    { key: 'professional_services', label: 'Professional Services', icon: '◇' },
    { key: 'other', label: 'Other', icon: '•••' },
  ];

  const clean = (value) => String(value || '').trim();
  const digits = (value) => clean(value).replace(/\D/g, '');
  const starts = (nic, prefixes) => prefixes.some((prefix) => nic.startsWith(prefix));

  function deriveSector(company) {
    const original = clean(company && company.sector).toLowerCase();
    const name = clean(company && company.name).toLowerCase();
    const nic = digits(company && company.nic);

    if (original === 'tech') return 'technology';
    if (original === 'biotech') return 'biotech';

    if (/biotech|bio ?science|life ?science|genomic|diagnostic|laborator/.test(name)) return 'biotech';
    if (/health|pharma|medical|medic|hospital|clinic|wellness|ayurved|drug/.test(name) || starts(nic, ['21', '86', '87', '88'])) return 'healthcare_pharma';
    if (/fintech|finance|financial|capital|payment|bank|insurance|nidhi|credit|loan/.test(name) || starts(nic, ['64', '65', '66'])) return 'finance_fintech';
    if (/logistic|cargo|transport|shipping|freight|warehouse|courier|delivery/.test(name) || starts(nic, ['49', '50', '51', '52', '53'])) return 'logistics_supply';
    if (/education|academy|school|college|learning|edtech|institute|training/.test(name) || starts(nic, ['85'])) return 'education';
    if (/agri|farm|fish|food|feed|crop|dairy/.test(name) || starts(nic, ['01', '02', '03'])) return 'agriculture_food';
    if (/construction|infra|builder|developer|realty|real estate|property/.test(name) || starts(nic, ['41', '42', '43', '68'])) return 'realestate_construction';
    if (/hotel|resort|travel|tour|hospitality|restaurant/.test(name) || starts(nic, ['55', '56', '79'])) return 'hospitality_travel';
    if (/retail|store|trading|trade|ecommerce|e-commerce|commerce/.test(name) || starts(nic, ['45', '46', '47'])) return 'retail_commerce';
    if (starts(nic, ['10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33'])) return 'manufacturing';
    if (starts(nic, ['69', '70', '71', '72', '73', '74', '75', '78', '80', '81', '82'])) return 'professional_services';
    return 'other';
  }

  function companyChannels(company) {
    return {
      website: clean(company && company.website_url),
      email: clean(company && company.email),
      phone: clean(company && company.phone),
    };
  }

  function personChannels(company, savedContacts) {
    const contacts = Array.isArray(savedContacts) ? savedContacts : [];
    const people = new Set();
    const emails = new Set();
    const phones = new Set();
    const linkedins = new Set();

    if (clean(company && company.director_name)) people.add(clean(company.director_name));
    if (clean(company && company.director_email)) emails.add(clean(company.director_email));
    if (clean(company && company.director_phone)) phones.add(clean(company.director_phone));
    if (clean(company && company.director_linkedin)) linkedins.add(clean(company.director_linkedin));

    for (const contact of contacts) {
      if (clean(contact && contact.name)) people.add(clean(contact.name));
      if (clean(contact && contact.email)) emails.add(clean(contact.email));
      if (clean(contact && contact.phone)) phones.add(clean(contact.phone));
      if (clean(contact && contact.linkedin)) linkedins.add(clean(contact.linkedin));
    }

    return {
      people: [...people],
      emails: [...emails],
      phones: [...phones],
      linkedins: [...linkedins],
      verified: contacts.some((contact) => Boolean(contact && contact.verified)),
    };
  }

  function contactChannels(company, savedContacts) {
    const companyLevel = companyChannels(company);
    const personLevel = personChannels(company, savedContacts);
    return {
      people: personLevel.people,
      emails: [...new Set([companyLevel.email, ...personLevel.emails].filter(Boolean))],
      phones: [...new Set([companyLevel.phone, ...personLevel.phones].filter(Boolean))],
      linkedins: [...personLevel.linkedins],
    };
  }

  function companyChannelCompleteness(company) {
    const channels = companyChannels(company);
    const fields = {
      website: Boolean(channels.website),
      email: Boolean(channels.email),
      phone: Boolean(channels.phone),
    };
    const score = Object.values(fields).filter(Boolean).length;
    let label = 'No channel';
    if (score > 1) label = 'Multiple channels';
    else if (fields.email) label = 'Email only';
    else if (fields.phone) label = 'Phone only';
    else if (fields.website) label = 'Website only';
    return { fields, score, total: 3, label };
  }

  function personCompleteness(company, savedContacts) {
    const channels = personChannels(company, savedContacts);
    const fields = {
      person: channels.people.length > 0,
      email: channels.emails.length > 0,
      phone: channels.phones.length > 0,
      linkedin: channels.linkedins.length > 0,
    };
    const score = Object.values(fields).filter(Boolean).length;
    let label = 'Not researched';
    if (score === 4) label = 'Complete';
    else if (score >= 2) label = 'Partial';
    else if (score === 1) label = fields.person ? 'Person only' : 'Direct channel only';
    return { fields, score, total: 4, label, verified: Boolean(fields.person && channels.verified) };
  }

  function contactReadiness(company, savedContacts) {
    const person = personCompleteness(company, savedContacts);
    const companyLevel = companyChannelCompleteness(company);
    const hasDirectPersonChannel = person.fields.email || person.fields.phone || person.fields.linkedin;

    if (person.fields.person && hasDirectPersonChannel && person.verified) {
      return { key: 'verified_contact', label: 'Verified contact', tone: 'green' };
    }
    if (person.fields.person && hasDirectPersonChannel) {
      return { key: 'ready_to_contact', label: 'Ready to contact', tone: 'blue' };
    }
    if (person.fields.person) {
      return { key: 'person_missing_channel', label: 'Person found — missing channel', tone: 'amber' };
    }
    if (companyLevel.score > 0) {
      return { key: 'company_channel_only', label: 'Company channel only', tone: 'amber' };
    }
    return { key: 'research_required', label: 'Research required', tone: 'gray' };
  }

  function isContactKnown(company, savedContacts) {
    return contactReadiness(company, savedContacts).key !== 'research_required';
  }

  function contactCompleteness(company, savedContacts) {
    return personCompleteness(company, savedContacts);
  }

  function aggregateBySector(companies, contactsByCin) {
    const map = new Map(SECTORS.map((sector) => [sector.key, {
      ...sector,
      total: 0,
      channelFound: 0,
      personFound: 0,
      needsResearch: 0,
      known: 0,
      unknown: 0,
    }]));

    for (const company of companies || []) {
      const key = deriveSector(company);
      const row = map.get(key) || map.get('other');
      const saved = (contactsByCin && contactsByCin[company.cin]) || [];
      const companyLevel = companyChannelCompleteness(company);
      const person = personCompleteness(company, saved);
      row.total += 1;
      if (companyLevel.score > 0) row.channelFound += 1;
      if (person.fields.person) row.personFound += 1;
      if (!person.fields.person) row.needsResearch += 1;
      if (isContactKnown(company, saved)) row.known += 1;
      else row.unknown += 1;
    }

    return [...map.values()]
      .filter((row) => row.total > 0)
      .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }

  function sectorCompanies(companies, sectorKey) {
    return (companies || []).filter((company) => deriveSector(company) === sectorKey);
  }

  function normalizeWebsiteStatus(value) {
    const status = clean(value).toLowerCase().replace(/[\s_-]+/g, ' ');
    if (!status || ['not checked', 'unchecked', 'unknown', 'none'].includes(status)) return 'Not checked';
    if (['live', 'active', 'working', 'ok'].includes(status)) return 'Live';
    if (['dead', 'down', 'inactive', 'not found', 'offline'].includes(status)) return 'Dead';
    if (['redirect', 'redirected'].includes(status)) return 'Redirected';
    return 'Unclear';
  }

  function buildQuery(params) {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && String(value) !== '') search.set(key, String(value));
    }
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  function buildSectorRoute(sector, options = {}) {
    const state = clean(options.contactState || 'all');
    const suffix = state && state !== 'all' ? `/${encodeURIComponent(state)}` : '';
    return `#/sector/${encodeURIComponent(sector)}${suffix}${buildQuery({ search: options.search, state: options.state })}`;
  }

  function buildCompanyRoute(cin, returnHash) {
    return `#/company/${encodeURIComponent(cin)}${buildQuery({ from: returnHash })}`;
  }

  function parseRoute(hash) {
    const raw = clean(hash || '#/overview').replace(/^#/, '');
    const qIndex = raw.indexOf('?');
    const path = qIndex >= 0 ? raw.slice(0, qIndex) : raw;
    const query = qIndex >= 0 ? raw.slice(qIndex + 1) : '';
    const params = new URLSearchParams(query);
    const parts = path.split('/').filter(Boolean).map(decodeURIComponent);

    if (!parts.length || parts[0] === 'overview') return { screen: 'overview' };
    if (parts[0] === 'sectors') return { screen: 'sectors' };
    if (parts[0] === 'sector' && parts[1]) {
      const result = { screen: 'sector', sector: parts[1] };
      if (['channel', 'person', 'research', 'all'].includes(parts[2])) result.contactState = parts[2];
      if (params.get('search')) result.search = params.get('search');
      if (params.get('state')) result.state = params.get('state');
      return result;
    }
    if (parts[0] === 'company' && parts[1]) {
      const result = { screen: 'company', cin: parts[1] };
      if (params.get('from')) result.from = params.get('from');
      return result;
    }
    if (['research', 'outreach', 'pipeline'].includes(parts[0])) {
      const result = { screen: parts[0] };
      if (params.get('search')) result.search = params.get('search');
      if (params.get('sector')) result.sector = params.get('sector');
      return result;
    }
    return { screen: 'overview' };
  }

  function opportunityStage(company, contactsByCin, outreachByCin) {
    const outreach = outreachByCin && outreachByCin[company.cin];
    const status = clean(outreach && outreach.status).toLowerCase();
    if (status === 'nda' || status === 'opportunity') return 'mercor_candidate';
    if (status === 'meeting') return 'meeting';
    if (status === 'data_discussion') return 'data_discussion';
    if (status === 'positive' || status === 'replied') return 'replied';
    if (status === 'contacted' || status === 'follow_up' || status === 'no_response') return 'contacted';

    const saved = (contactsByCin && contactsByCin[company.cin]) || [];
    const readiness = contactReadiness(company, saved);
    if (readiness.key === 'verified_contact' || readiness.key === 'ready_to_contact') return 'person_identified';
    if (readiness.key === 'person_missing_channel') return 'person_identified';
    if (readiness.key === 'company_channel_only') return 'channel_found';
    return 'research';
  }

  function sectorMeta(key) {
    return SECTORS.find((sector) => sector.key === key) || SECTORS[SECTORS.length - 1];
  }

  return {
    SECTORS,
    deriveSector,
    companyChannels,
    personChannels,
    contactChannels,
    companyChannelCompleteness,
    personCompleteness,
    contactReadiness,
    isContactKnown,
    contactCompleteness,
    aggregateBySector,
    sectorCompanies,
    normalizeWebsiteStatus,
    buildSectorRoute,
    buildCompanyRoute,
    parseRoute,
    opportunityStage,
    sectorMeta,
  };
});
