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

  function contactChannels(company, savedContacts) {
    const contacts = Array.isArray(savedContacts) ? savedContacts : [];
    const emails = new Set();
    const phones = new Set();
    const linkedins = new Set();
    const people = new Set();

    if (clean(company && company.email)) emails.add(clean(company.email));
    if (clean(company && company.phone)) phones.add(clean(company.phone));
    if (clean(company && company.linkedin_url)) linkedins.add(clean(company.linkedin_url));
    if (clean(company && company.director_name)) people.add(clean(company.director_name));

    for (const contact of contacts) {
      if (clean(contact && contact.email)) emails.add(clean(contact.email));
      if (clean(contact && contact.phone)) phones.add(clean(contact.phone));
      if (clean(contact && contact.linkedin)) linkedins.add(clean(contact.linkedin));
      if (clean(contact && contact.name)) people.add(clean(contact.name));
    }

    return {
      people: [...people],
      emails: [...emails],
      phones: [...phones],
      linkedins: [...linkedins],
    };
  }

  function isContactKnown(company, savedContacts) {
    const channels = contactChannels(company, savedContacts);
    return channels.emails.length > 0 || channels.phones.length > 0 || channels.linkedins.length > 0;
  }

  function contactCompleteness(company, savedContacts) {
    const channels = contactChannels(company, savedContacts);
    const fields = {
      person: channels.people.length > 0,
      email: channels.emails.length > 0,
      phone: channels.phones.length > 0,
      linkedin: channels.linkedins.length > 0,
    };
    const score = Object.values(fields).filter(Boolean).length;
    let label = 'Unknown';
    if (score === 4) label = 'Complete';
    else if (score >= 2) label = 'Partial';
    else if (score === 1) label = 'Channel only';
    return { fields, score, total: 4, label };
  }

  function aggregateBySector(companies, contactsByCin) {
    const map = new Map(SECTORS.map((sector) => [sector.key, { ...sector, total: 0, known: 0, unknown: 0 }]));
    for (const company of companies || []) {
      const key = deriveSector(company);
      const row = map.get(key) || map.get('other');
      const saved = (contactsByCin && contactsByCin[company.cin]) || [];
      row.total += 1;
      if (isContactKnown(company, saved)) row.known += 1;
      else row.unknown += 1;
    }
    return [...map.values()].filter((row) => row.total > 0).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label));
  }

  function sectorCompanies(companies, sectorKey) {
    return (companies || []).filter((company) => deriveSector(company) === sectorKey);
  }

  function parseRoute(hash) {
    const raw = clean(hash || '#/overview').replace(/^#/, '');
    const parts = raw.split('/').filter(Boolean).map(decodeURIComponent);
    if (!parts.length || parts[0] === 'overview') return { screen: 'overview' };
    if (parts[0] === 'sector' && parts[1]) {
      const result = { screen: 'sector', sector: parts[1] };
      if (parts[2] === 'known' || parts[2] === 'unknown') result.contactState = parts[2];
      return result;
    }
    if (parts[0] === 'company' && parts[1]) return { screen: 'company', cin: parts[1] };
    if (['research', 'outreach', 'pipeline'].includes(parts[0])) return { screen: parts[0] };
    return { screen: 'overview' };
  }

  function opportunityStage(company, contactsByCin, outreachByCin) {
    const outreach = outreachByCin && outreachByCin[company.cin];
    const status = clean(outreach && outreach.status).toLowerCase();
    if (status === 'nda' || status === 'opportunity') return 'nda';
    if (status === 'positive') return 'positive';
    if (status === 'contacted' || status === 'follow_up' || status === 'no_response') return 'contacted';
    const saved = (contactsByCin && contactsByCin[company.cin]) || [];
    return isContactKnown(company, saved) ? 'contact_ready' : 'research';
  }

  function sectorMeta(key) {
    return SECTORS.find((sector) => sector.key === key) || SECTORS[SECTORS.length - 1];
  }

  return {
    SECTORS,
    deriveSector,
    contactChannels,
    isContactKnown,
    contactCompleteness,
    aggregateBySector,
    sectorCompanies,
    parseRoute,
    opportunityStage,
    sectorMeta,
  };
});
