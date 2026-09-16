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

test('a company is contact-known only when a usable channel exists', () => {
  const company = { cin: 'A', email: '', phone: '', contact_status: 'not_checked' };
  assert.equal(model.isContactKnown(company, []), false);
  assert.equal(model.isContactKnown(company, [{ name: 'Founder', linkedin: 'https://linkedin.com/in/founder' }]), true);
});

test('contact completeness tracks person, email, phone, and linkedin independently', () => {
  const company = { cin: 'A', email: 'hello@example.com', phone: '' };
  const completeness = model.contactCompleteness(company, [{ name: 'Ravi', designation: 'Director', phone: '+91 99999 99999' }]);
  assert.deepEqual(completeness.fields, { person: true, email: true, phone: true, linkedin: false });
  assert.equal(completeness.score, 3);
  assert.equal(completeness.total, 4);
  assert.equal(completeness.label, 'Partial');
});

test('sector aggregation returns total, known, and unknown counts', () => {
  const companies = [
    { cin: 'A', sector: 'tech', name: 'A TECH', email: 'a@example.com', phone: '', nic: '62010' },
    { cin: 'B', sector: 'tech', name: 'B TECH', email: '', phone: '', nic: '62020' },
    { cin: 'C', sector: 'non_tech', name: 'C LOGISTICS', email: '', phone: '', nic: '52241' },
  ];
  const rows = model.aggregateBySector(companies, {});
  const technology = rows.find((row) => row.key === 'technology');
  assert.deepEqual({ total: technology.total, known: technology.known, unknown: technology.unknown }, { total: 2, known: 1, unknown: 1 });
});

test('route parser recognizes sector contact-state and company routes', () => {
  assert.deepEqual(model.parseRoute('#/sector/technology/known'), { screen: 'sector', sector: 'technology', contactState: 'known' });
  assert.deepEqual(model.parseRoute('#/company/U62010AP2026PTC123384'), { screen: 'company', cin: 'U62010AP2026PTC123384' });
});

test('opportunity stage prioritizes outreach state over contact readiness', () => {
  const company = { cin: 'A', email: 'a@example.com', phone: '' };
  assert.equal(model.opportunityStage(company, {}, {}), 'contact_ready');
  assert.equal(model.opportunityStage(company, {}, { A: { status: 'contacted' } }), 'contacted');
  assert.equal(model.opportunityStage(company, {}, { A: { status: 'positive' } }), 'positive');
  assert.equal(model.opportunityStage(company, {}, { A: { status: 'nda' } }), 'nda');
});
