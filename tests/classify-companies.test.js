'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildIndex, mergeSectorMaps, enrichCompanies, summarize } = require('../scripts/classify-companies');

const dictionaries = {
  'NIC-1998': buildIndex({ rows: [
    { code: '72200', description: 'Software consultancy and supply', division: '72' },
    { code: '24233', description: 'Manufacture of ayurvedic or unani pharmaceutical preparations', division: '24' },
  ]}, 'NIC-1998'),
  'NIC-2008': buildIndex({ rows: [
    { code: '62099', description: 'Other information technology and computer service activities n.e.c.', division: '62' },
  ]}, 'NIC-2008'),
};

const overrides = {
  '72200': {
    description: 'Software consultancy and supply',
    primary_sector: 'technology',
    technology_signal: 'high',
    dictionary_version: 'CIN-LEGACY',
    verified: true,
    confidence: 'high',
  },
};

const sectorMap = mergeSectorMaps(
  { 'NIC-1998': { '24': { primary_sector: 'healthcare_pharma', technology_signal: 'low' }, '72': { primary_sector: 'technology', technology_signal: 'high' } } },
  { 'NIC-2008': { '62': { primary_sector: 'technology', technology_signal: 'high' } } },
);

test('buildIndex keeps version and marks imported master rows verified', () => {
  assert.equal(dictionaries['NIC-1998']['72200'].version, 'NIC-1998');
  assert.equal(dictionaries['NIC-1998']['72200'].verified, true);
});

test('mergeSectorMaps preserves all NIC editions', () => {
  assert.ok(sectorMap['NIC-1998']);
  assert.ok(sectorMap['NIC-2008']);
});

test('enrichment never mutates or overwrites original company fields', () => {
  const input = [{ cin: 'U24233KA2004PTC034320', name: 'RISHI HERBAL TECHNOLOGIES PRIVATE LIMITED', sector: 'tech', state: 'Karnataka' }];
  const before = JSON.parse(JSON.stringify(input));
  const output = enrichCompanies(input, dictionaries, overrides, sectorMap);

  assert.deepEqual(input, before);
  assert.equal(output[0].sector, 'tech');
  assert.equal(output[0].classified_sector, 'healthcare_pharma');
  assert.equal(output[0].cin_industry_code, '24233');
  assert.ok(output[0].classification_anomaly_flags.includes('name_sector_mismatch_review'));
});

test('legacy CIN override is recorded separately from original sector', () => {
  const [row] = enrichCompanies([
    { cin: 'U72200AP2022PTC122301', name: 'PROPHECIUS TECHNOLOGIES PRIVATE LIMITED', sector: 'tech' },
  ], dictionaries, overrides, sectorMap);

  assert.equal(row.classified_sector, 'technology');
  assert.equal(row.classification_source, 'verified_override');
  assert.equal(row.classification_dictionary, 'CIN-LEGACY');
});

test('summary exposes exact, ambiguous, unmatched, invalid, review and sector totals', () => {
  const rows = [
    { classification_match_status: 'exact', classification_source: 'verified_override', classification_review_required: false, classified_sector: 'technology' },
    { classification_match_status: 'ambiguous', classification_source: 'conflicting_dictionaries', classification_review_required: true, classified_sector: 'unclassified' },
    { classification_match_status: 'unmatched', classification_source: 'unresolved', classification_review_required: true, classified_sector: 'unclassified' },
    { classification_match_status: 'invalid_cin', classification_source: 'unresolved', classification_review_required: true, classified_sector: 'unclassified' },
  ];
  const s = summarize(rows);
  assert.equal(s.total, 4);
  assert.equal(s.exact, 1);
  assert.equal(s.ambiguous, 1);
  assert.equal(s.unmatched, 1);
  assert.equal(s.invalid_cin, 1);
  assert.equal(s.review_required, 3);
  assert.equal(s.verified_overrides, 1);
  assert.equal(s.by_sector.technology, 1);
  assert.equal(s.by_sector.unclassified, 3);
});
