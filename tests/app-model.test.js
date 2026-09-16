const test = require('node:test');
const assert = require('node:assert/strict');

const model = require('../app-model.js');

test('classifies explicit tech companies as technology', () => {
  assert.equal(model.deriveSector({ sector: 'tech', name: 'LAPRA TECH PRIVATE LIMITED', nic: '62010' }), 'technology');
});

test('classifies non-tech healthcare and logistics companies from NIC/name', () => {
  assert.equal(model.deriveSector({ sector: 'non_tech', name: 'NEW BARMAN HEALTHCARE PRIVATE LIMITED', nic: '24230' }), 'healthcare_pharma');
  assert.equal(model.deriveSector({ sector: 'non_tech', name: 'NEXMOVE CARGO AND SERVICES PRIVATE LIMITED', nic: '52241' }), 'logistics_supply');
});

test('company channels are separate from person contact details', () => {
  const company = {
    cin: 'A',
    email: 'support@panget.in',
    phone: '+912269408474',
    website_url: 'https://panget.in',
  };

  assert.deepEqual(model.companyChannelCompleteness(company), {
    fields: { website: true, email: true, phone: true },
    score: 3,
    total: 3,
    label: 'Multiple channels',
  });
  assert.deepEqual(model.personCompleteness(company, []), {
    fields: { person: false, email: false, phone: false, linkedin: false },
    score: 0,
    total: 4,
    label: 'Not researched',
    verified: false,
  });
});

test('person completeness tracks a saved decision-maker independently', () => {
  const company = { cin: 'A', email: 'support@example.com', phone: '+910000000000' };
  const contacts = [{
    name: 'Ravi Kumar',
    designation: 'Director',
    email: 'ravi@example.com',
    phone: '+919999999999',
    linkedin: 'https://linkedin.com/in/ravi',
    verified: true,
  }];

  const result = model.personCompleteness(company, contacts);
  assert.deepEqual(result.fields, { person: true, email: true, phone: true, linkedin: true });
  assert.equal(result.score, 4);
  assert.equal(result.verified, true);
});

test('contact readiness distinguishes research, company-only, person-only, ready, and verified', () => {
  assert.equal(model.contactReadiness({}, []).key, 'research_required');
  assert.equal(model.contactReadiness({ email: 'info@example.com' }, []).key, 'company_channel_only');
  assert.equal(model.contactReadiness({}, [{ name: 'Founder' }]).key, 'person_missing_channel');
  assert.equal(model.contactReadiness({}, [{ name: 'Founder', email: 'founder@example.com' }]).key, 'ready_to_contact');
  assert.equal(model.contactReadiness({}, [{ name: 'Founder', email: 'founder@example.com', verified: true }]).key, 'verified_contact');
});

test('sector aggregation exposes company-channel, person-found, and research counts', () => {
  const companies = [
    { cin: 'A', sector: 'tech', name: 'A TECH', email: 'a@example.com', phone: '', nic: '62010' },
    { cin: 'B', sector: 'tech', name: 'B TECH', email: '', phone: '', nic: '62020' },
    { cin: 'C', sector: 'tech', name: 'C TECH', email: '', phone: '', nic: '62020' },
  ];
  const contacts = {
    C: [{ name: 'Founder C', email: 'founder@c.example' }],
  };
  const technology = model.aggregateBySector(companies, contacts).find((row) => row.key === 'technology');

  assert.deepEqual(
    {
      total: technology.total,
      channelFound: technology.channelFound,
      personFound: technology.personFound,
      needsResearch: technology.needsResearch,
    },
    { total: 3, channelFound: 1, personFound: 1, needsResearch: 2 },
  );
});

test('website status is normalized to the five approved labels', () => {
  assert.equal(model.normalizeWebsiteStatus('live'), 'Live');
  assert.equal(model.normalizeWebsiteStatus('dead'), 'Dead');
  assert.equal(model.normalizeWebsiteStatus('redirected'), 'Redirected');
  assert.equal(model.normalizeWebsiteStatus('maybe'), 'Unclear');
  assert.equal(model.normalizeWebsiteStatus(''), 'Not checked');
});

test('sector route preserves contact view, search, and state filters in the URL', () => {
  const hash = model.buildSectorRoute('technology', {
    contactState: 'channel',
    search: 'PANGET',
    state: 'Bihar',
  });
  assert.equal(hash, '#/sector/technology/channel?search=PANGET&state=Bihar');
  assert.deepEqual(model.parseRoute(hash), {
    screen: 'sector',
    sector: 'technology',
    contactState: 'channel',
    search: 'PANGET',
    state: 'Bihar',
  });
});

test('company route carries the exact return hash and parser restores it', () => {
  const returnHash = '#/sector/technology/channel?search=PANGET&state=Bihar';
  const hash = model.buildCompanyRoute('U62099BR2025OPC076419', returnHash);
  const route = model.parseRoute(hash);

  assert.equal(route.screen, 'company');
  assert.equal(route.cin, 'U62099BR2025OPC076419');
  assert.equal(route.from, returnHash);
});

test('direct company links can fall back to the company sector', () => {
  assert.deepEqual(
    model.parseRoute('#/company/U62099BR2025OPC076419'),
    { screen: 'company', cin: 'U62099BR2025OPC076419' },
  );
});

test('opportunity stage starts from the new contact-readiness model', () => {
  const company = { cin: 'A', email: 'a@example.com', phone: '' };
  assert.equal(model.opportunityStage(company, {}, {}), 'channel_found');
  assert.equal(model.opportunityStage(company, { A: [{ name: 'Founder', email: 'founder@example.com' }] }, {}), 'person_identified');
  assert.equal(model.opportunityStage(company, {}, { A: { status: 'contacted' } }), 'contacted');
  assert.equal(model.opportunityStage(company, {}, { A: { status: 'positive' } }), 'replied');
  assert.equal(model.opportunityStage(company, {}, { A: { status: 'nda' } }), 'mercor_candidate');
});

test('research and outreach routes preserve their own list filters for return navigation', () => {
  assert.deepEqual(model.parseRoute('#/research?search=AFFIVO&sector=technology'), {
    screen: 'research',
    search: 'AFFIVO',
    sector: 'technology',
  });
  assert.deepEqual(model.parseRoute('#/outreach?search=PANGET'), {
    screen: 'outreach',
    search: 'PANGET',
  });
});
