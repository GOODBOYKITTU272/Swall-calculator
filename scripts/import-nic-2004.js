'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://microdata.gov.in/NADA/index.php/catalog/124/variable/V207';
const AUTHORITY_URL = 'https://mospi.gov.in/sites/default/files/main_menu/national_industrial_classification/nic_2004_struc_detail.pdf';
const EXPECTED_ANCHORS = ['01111', '24233', '72291', '72909'];

function decodeHtml(text) {
  return String(text || '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();
}

function parseNicCategoryHtml(html) {
  const found = new Map();
  const rowRe = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row;
  while ((row = rowRe.exec(String(html || '')))) {
    const cells = [];
    const tdRe = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi;
    let cell;
    while ((cell = tdRe.exec(row[1]))) cells.push(decodeHtml(cell[1]));
    if (cells.length < 2) continue;
    const code = cells[0].trim();
    if (!/^\d{5}$/.test(code) || code === '00000') continue;
    const description = cells[1].trim();
    if (!description) continue;
    if (!found.has(code)) found.set(code, { code, description });
  }
  return [...found.values()].sort((a, b) => a.code.localeCompare(b.code));
}

function validateNicMaster(rows, options = {}) {
  const minimumRows = options.minimumRows ?? 1100;
  const codes = new Set();
  const errors = [];
  for (const row of rows || []) {
    if (!/^\d{5}$/.test(String(row.code || ''))) errors.push(`invalid_code:${row.code}`);
    if (!String(row.description || '').trim()) errors.push(`missing_description:${row.code}`);
    if (codes.has(row.code)) errors.push(`duplicate_code:${row.code}`);
    codes.add(row.code);
  }
  const missingAnchors = EXPECTED_ANCHORS.filter((code) => !codes.has(code));
  if ((rows || []).length < minimumRows) errors.push(`row_count_below_${minimumRows}`);
  if (missingAnchors.length) errors.push(`missing_anchor_codes:${missingAnchors.join(',')}`);
  return { valid: errors.length === 0, rowCount: (rows || []).length, missingAnchors, errors };
}

function buildMaster(rows) {
  return {
    meta: {
      nic_version: 'NIC-2004',
      level: '5-digit subclass',
      source_catalog_url: SOURCE_URL,
      authority_reference_url: AUTHORITY_URL,
      source_authority: 'Ministry of Statistics and Programme Implementation / National Sample Survey Office, Government of India',
      expected_official_subclasses: 1191,
      generated_at: new Date().toISOString(),
    },
    rows: rows.map((row) => ({
      ...row,
      division: row.code.slice(0, 2),
      group: row.code.slice(0, 3),
      class: row.code.slice(0, 4),
    })),
  };
}

async function importNic2004({ sourceUrl = SOURCE_URL, outputPath } = {}) {
  const response = await fetch(sourceUrl, { headers: { 'user-agent': 'Apply-Wizz-NIC-Importer/1.0' } });
  if (!response.ok) throw new Error(`NIC-2004 source request failed: ${response.status}`);
  const html = await response.text();
  const rows = parseNicCategoryHtml(html);
  const report = validateNicMaster(rows);
  if (!report.valid) throw new Error(`NIC-2004 validation failed: ${report.errors.join('; ')}`);
  const master = buildMaster(rows);
  const target = outputPath || path.join(__dirname, '..', 'data', 'nic', 'nic-2004.json');
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(master, null, 2) + '\n');
  return { target, report };
}

if (require.main === module) {
  importNic2004().then(({ target, report }) => {
    console.log(`Imported ${report.rowCount} NIC-2004 subclasses to ${target}`);
  }).catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = { SOURCE_URL, AUTHORITY_URL, parseNicCategoryHtml, validateNicMaster, buildMaster, importNic2004 };
