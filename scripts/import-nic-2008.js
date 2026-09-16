'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SOURCE_URL = 'https://raw.githubusercontent.com/avantifellows/external_data_sources/main/plfs/codemaps/nic_subclass.csv';
const AUTHORITY_URL = 'https://www.mospi.gov.in/sites/default/files/main_menu/national_industrial_classification/h_NIC-2008.pdf';
const EXPECTED_ANCHORS = ['01111', '62099', '72200'];

function parseCsvLine(line) {
  const out=[]; let value=''; let quoted=false;
  for (let i=0;i<line.length;i++) {
    const ch=line[i];
    if (ch==='"') {
      if (quoted && line[i+1]==='"') { value+='"'; i++; }
      else quoted=!quoted;
    } else if (ch===',' && !quoted) { out.push(value); value=''; }
    else value+=ch;
  }
  out.push(value);
  return out;
}

function parseCsv(csv) {
  const lines=String(csv||'').replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header=parseCsvLine(lines[0]).map(v=>v.trim().toLowerCase());
  const codeIndex=header.indexOf('code'); const descIndex=header.indexOf('description');
  if (codeIndex<0 || descIndex<0) throw new Error('NIC-2008 CSV missing code/description headers');
  const seen=new Set(); const rows=[];
  for (const line of lines.slice(1)) {
    const cells=parseCsvLine(line);
    const code=String(cells[codeIndex]||'').trim();
    const description=String(cells[descIndex]||'').trim();
    if (!/^\d{5}$/.test(code) || !description || seen.has(code)) continue;
    seen.add(code); rows.push({code,description});
  }
  return rows.sort((a,b)=>a.code.localeCompare(b.code));
}

function validateNic2008(rows, options={}) {
  const minimumRows=options.minimumRows ?? 1000;
  const codes=new Set(); const errors=[];
  for (const row of rows||[]) {
    if (!/^\d{5}$/.test(String(row.code||''))) errors.push(`invalid_code:${row.code}`);
    if (!String(row.description||'').trim()) errors.push(`missing_description:${row.code}`);
    if (codes.has(row.code)) errors.push(`duplicate_code:${row.code}`);
    codes.add(row.code);
  }
  const missingAnchors=EXPECTED_ANCHORS.filter(code=>!codes.has(code));
  if ((rows||[]).length<minimumRows) errors.push(`row_count_below_${minimumRows}`);
  if (missingAnchors.length) errors.push(`missing_anchor_codes:${missingAnchors.join(',')}`);
  return {valid:errors.length===0,rowCount:(rows||[]).length,missingAnchors,errors};
}

function buildMaster(rows) {
  return {
    meta:{
      nic_version:'NIC-2008', level:'5-digit subclass',
      transport_source_url:SOURCE_URL, authority_reference_url:AUTHORITY_URL,
      source_authority:'Ministry of Statistics and Programme Implementation, Government of India',
      transport_note:'Machine-readable mirror; descriptions must remain consistent with MoSPI NIC-2008 authority.',
      generated_at:new Date().toISOString(),
    },
    rows:rows.map(row=>({...row,division:row.code.slice(0,2),group:row.code.slice(0,3),class:row.code.slice(0,4)})),
  };
}

async function importNic2008({sourceUrl=SOURCE_URL,outputPath}={}) {
  const response=await fetch(sourceUrl,{headers:{'user-agent':'Apply-Wizz-NIC-Importer/1.0'}});
  if (!response.ok) throw new Error(`NIC-2008 source request failed: ${response.status}`);
  const rows=parseCsv(await response.text());
  const report=validateNic2008(rows);
  if (!report.valid) throw new Error(`NIC-2008 validation failed: ${report.errors.join('; ')}`);
  const target=outputPath || path.join(__dirname,'..','data','nic','nic-2008.json');
  fs.mkdirSync(path.dirname(target),{recursive:true});
  fs.writeFileSync(target,JSON.stringify(buildMaster(rows),null,2)+'\n');
  return {target,report};
}

if (require.main===module) {
  importNic2008().then(({target,report})=>console.log(`Imported ${report.rowCount} NIC-2008 subclasses to ${target}`)).catch(error=>{console.error(error.message);process.exitCode=1;});
}

module.exports={SOURCE_URL,AUTHORITY_URL,parseCsv,validateNic2008,buildMaster,importNic2008};
