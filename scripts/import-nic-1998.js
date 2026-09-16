'use strict';

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const SOURCE_URLS = [
  'https://microdata.gov.in/NADA/index.php/catalog/103/download/6523',
  'https://microdata.gov.in/nada43/index.php/catalog/91/download/872',
];
const AUTHORITY_CATALOG_URL = 'https://microdata.gov.in/NADA/index.php/catalog/103/related-materials';
const EXPECTED_ANCHORS = ['01111', '24233', '72200', '72900'];

function cleanDescription(value) {
  return String(value || '').replace(/\s+/g, ' ').replace(/^[-–—:;,.\s]+/, '').trim();
}

function parseNic1998Text(text) {
  const found = new Map();
  const lines = String(text || '').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/\s+/g, ' ').trim();
    if (!line) continue;
    const match = /^(?:(?:[A-Q]\s+)?(?:\d{2}\s+)?(?:\d{3}\s+)?(?:\d{4}\s+)?)?(\d{5})\s+(.+)$/.exec(line);
    if (!match) continue;
    const code = match[1];
    const description = cleanDescription(match[2]);
    if (!description || found.has(code)) continue;
    found.set(code, { code, description });
  }
  return [...found.values()].sort((a,b)=>a.code.localeCompare(b.code));
}

function validateNic1998(rows, options={}) {
  const minimumRows = options.minimumRows ?? 950;
  const codes = new Set();
  const errors = [];
  for (const row of rows || []) {
    if (!/^\d{5}$/.test(String(row.code || ''))) errors.push(`invalid_code:${row.code}`);
    if (!String(row.description || '').trim()) errors.push(`missing_description:${row.code}`);
    if (codes.has(row.code)) errors.push(`duplicate_code:${row.code}`);
    codes.add(row.code);
  }
  const missingAnchors = EXPECTED_ANCHORS.filter(code=>!codes.has(code));
  if ((rows || []).length < minimumRows) errors.push(`row_count_below_${minimumRows}`);
  if (missingAnchors.length) errors.push(`missing_anchor_codes:${missingAnchors.join(',')}`);
  return { valid: errors.length===0, rowCount:(rows||[]).length, missingAnchors, errors };
}

function downloadOfficialPdf(target) {
  const errors=[];
  for (const url of SOURCE_URLS) {
    try {
      execFileSync('curl', ['-fL','--retry','2','--connect-timeout','20','-A','Apply-Wizz-NIC-Importer/1.0','-o',target,url], {stdio:'pipe'});
      if (fs.existsSync(target) && fs.statSync(target).size > 10000) return url;
    } catch (error) {
      errors.push(`${url}: ${error.status || error.message}`);
    }
  }
  throw new Error(`NIC-1998 PDF download failed: ${errors.join(' | ')}`);
}

function buildMaster(rows, downloadedFrom) {
  return {
    meta:{
      nic_version:'NIC-1998', level:'5-digit subclass',
      authority_catalog_url:AUTHORITY_CATALOG_URL,
      downloaded_from:downloadedFrom,
      source_authority:'National Sample Survey Office / Government of India',
      expected_official_subclasses:1021,
      generated_at:new Date().toISOString(),
    },
    rows:rows.map(row=>({...row,division:row.code.slice(0,2),group:row.code.slice(0,3),class:row.code.slice(0,4)})),
  };
}

async function importNic1998({outputPath}={}) {
  const tmp=path.join(os.tmpdir(),`apply-wizz-nic-1998-${process.pid}.pdf`);
  let downloadedFrom='';
  try {
    downloadedFrom=downloadOfficialPdf(tmp);
    const text=execFileSync('pdftotext',['-layout',tmp,'-'],{encoding:'utf8',maxBuffer:20*1024*1024});
    const rows=parseNic1998Text(text);
    const report=validateNic1998(rows);
    if (!report.valid) throw new Error(`NIC-1998 validation failed: ${report.errors.join('; ')}`);
    const target=outputPath || path.join(__dirname,'..','data','nic','nic-1998.json');
    fs.mkdirSync(path.dirname(target),{recursive:true});
    fs.writeFileSync(target,JSON.stringify(buildMaster(rows,downloadedFrom),null,2)+'\n');
    return {target,report};
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

if (require.main===module) {
  importNic1998().then(({target,report})=>console.log(`Imported ${report.rowCount} NIC-1998 subclasses to ${target}`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}

module.exports={SOURCE_URLS,AUTHORITY_CATALOG_URL,parseNic1998Text,validateNic1998,buildMaster,importNic1998};
