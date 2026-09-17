'use strict';

const fs = require('node:fs');
const path = require('node:path');
const M = require('../cin-industry-model');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function buildIndex(master, version) {
  const index = {};
  for (const row of master?.rows || []) {
    if (!/^\d{5}$/.test(String(row.code || ''))) continue;
    index[row.code] = { ...row, version: row.version || version, verified: row.verified !== false };
  }
  return index;
}

function mergeSectorMaps(...maps) {
  const merged = {};
  for (const map of maps) {
    for (const [version, value] of Object.entries(map || {})) {
      merged[version] = { ...(merged[version] || {}), ...(value || {}) };
      const existingManufacturing = merged[version].default_manufacturing_divisions || [];
      const incomingManufacturing = value?.default_manufacturing_divisions || [];
      if (existingManufacturing.length || incomingManufacturing.length) {
        merged[version].default_manufacturing_divisions = [...new Set([...existingManufacturing, ...incomingManufacturing])];
      }
    }
  }
  return merged;
}

function normalizeClassification(result) {
  return {
    cin_industry_code: result.cin_industry_code || result.industry_code || '',
    classification_match_status: result.nic_match_status || 'invalid_cin',
    classified_sector: result.primary_sector || 'unclassified',
    classified_technology_signal: result.technology_signal || 'unknown',
    classification_source: result.classification_source || 'unresolved',
    classification_dictionary: result.classification_dictionary || '',
    official_industry_description: result.official_description || '',
    sector_confidence: result.sector_confidence || 'none',
    classification_review_required: Boolean(result.review_required),
    classification_candidates: result.classification_candidates || [],
    classification_anomaly_flags: result.anomaly_flags || [],
  };
}

function enrichCompanies(companies, dictionaries, overrides, sectorMap) {
  return (companies || []).map((company) => {
    const classification = normalizeClassification(M.classifyCompany(company, dictionaries, overrides, sectorMap));
    return { ...company, ...classification };
  });
}

function summarize(rows) {
  const summary = {
    total: rows.length,
    exact: 0,
    ambiguous: 0,
    unmatched: 0,
    invalid_cin: 0,
    review_required: 0,
    verified_overrides: 0,
    by_sector: {},
    by_dictionary: {},
    anomaly_flags: {},
  };

  for (const row of rows) {
    const status = row.classification_match_status || 'invalid_cin';
    if (Object.prototype.hasOwnProperty.call(summary, status) && typeof summary[status] === 'number') summary[status] += 1;
    if (row.classification_review_required) summary.review_required += 1;
    if (row.classification_source === 'verified_override') summary.verified_overrides += 1;

    const sector = row.classified_sector || 'unclassified';
    summary.by_sector[sector] = (summary.by_sector[sector] || 0) + 1;

    const dictionary = row.classification_dictionary || 'unresolved';
    summary.by_dictionary[dictionary] = (summary.by_dictionary[dictionary] || 0) + 1;

    for (const flag of row.classification_anomaly_flags || []) {
      summary.anomaly_flags[flag] = (summary.anomaly_flags[flag] || 0) + 1;
    }
  }

  return summary;
}

function loadReferenceData(root = path.join(__dirname, '..')) {
  const nicDir = path.join(root, 'data', 'nic');
  const masters = {
    'NIC-1998': readJson(path.join(nicDir, 'nic-1998.json')),
    'NIC-2004': readJson(path.join(nicDir, 'nic-2004.json')),
    'NIC-2008': readJson(path.join(nicDir, 'nic-2008.json')),
  };
  const dictionaries = Object.fromEntries(Object.entries(masters).map(([version, master]) => [version, buildIndex(master, version)]));
  const overrides = readJson(path.join(nicDir, 'cin-code-overrides.json'));
  const sectorMap = mergeSectorMaps(
    readJson(path.join(nicDir, 'apply-wizz-sector-map-1998.json')),
    readJson(path.join(nicDir, 'apply-wizz-sector-map.json')),
  );
  return { dictionaries, overrides, sectorMap };
}

function generate({ root = path.join(__dirname, '..'), inputPath, outputPath, reportPath } = {}) {
  const source = inputPath || path.join(root, 'data', 'companies.json');
  const output = outputPath || path.join(root, 'data', 'companies-classified.json');
  const report = reportPath || path.join(root, 'data', 'classification-report.json');
  const companies = readJson(source);
  if (!Array.isArray(companies)) throw new Error('data/companies.json must be an array');

  const refs = loadReferenceData(root);
  const enriched = enrichCompanies(companies, refs.dictionaries, refs.overrides, refs.sectorMap);
  const audit = {
    generated_at: new Date().toISOString(),
    source_file: path.relative(root, source),
    output_file: path.relative(root, output),
    source_count: companies.length,
    source_mutated: false,
    dictionaries: ['NIC-1998', 'NIC-2004', 'NIC-2008'],
    summary: summarize(enriched),
  };

  fs.writeFileSync(output, JSON.stringify(enriched, null, 2) + '\n');
  fs.writeFileSync(report, JSON.stringify(audit, null, 2) + '\n');
  return { output, report, audit, enriched };
}

if (require.main === module) {
  try {
    const result = generate();
    const s = result.audit.summary;
    console.log(`Classified ${s.total} companies: exact=${s.exact}, ambiguous=${s.ambiguous}, unmatched=${s.unmatched}, invalid=${s.invalid_cin}, review=${s.review_required}`);
    console.log(`Output: ${result.output}`);
    console.log(`Report: ${result.report}`);
  } catch (error) {
    console.error(error.stack || error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildIndex, mergeSectorMaps, enrichCompanies, summarize, loadReferenceData, generate };
