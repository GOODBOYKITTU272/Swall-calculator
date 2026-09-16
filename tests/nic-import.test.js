const test = require('node:test');
const assert = require('node:assert/strict');
const { parseNicCategoryHtml, validateNicMaster } = require('../scripts/import-nic-2004');

test('parses five-digit NIC-2004 categories from government catalog HTML', () => {
  const html = `
    <tr><td>01111</td><td>Growing of food grain crops (cereals and pulses)</td></tr>
    <tr><td>72291</td><td>Analysis, design and programming of custom software, ready to use</td></tr>
    <tr><td>72909</td><td>Other computer related activities, n.e.c.</td></tr>`;
  const rows = parseNicCategoryHtml(html);
  assert.deepEqual(rows.map(r => r.code), ['01111','72291','72909']);
  assert.equal(rows[1].description, 'Analysis, design and programming of custom software, ready to use');
});

test('ignores non-five-digit category codes and deduplicates', () => {
  const html = `<tr><td>00000</td><td>NA / NR</td></tr><tr><td>72291</td><td>Software A</td></tr><tr><td>72291</td><td>Software A</td></tr><tr><td>72</td><td>Division</td></tr>`;
  const rows = parseNicCategoryHtml(html);
  assert.deepEqual(rows, [{code:'72291',description:'Software A'}]);
});

test('validates master shape and expected anchor codes', () => {
  const rows = [
    {code:'01111',description:'Growing of food grain crops'},
    {code:'24233',description:'Manufacture of ayurvedic or unani pharmaceutical preparation'},
    {code:'72291',description:'Analysis, design and programming of custom software'},
    {code:'72909',description:'Other computer related activities, n.e.c.'},
  ];
  const report = validateNicMaster(rows,{minimumRows:4});
  assert.equal(report.valid,true);
  assert.deepEqual(report.missingAnchors,[]);
});
