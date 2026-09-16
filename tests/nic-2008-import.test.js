const test = require('node:test');
const assert = require('node:assert/strict');
const { parseCsv, validateNic2008 } = require('../scripts/import-nic-2008');

test('parses quoted NIC-2008 subclass CSV safely', () => {
  const csv='code,description\n01111,Growing of wheat\n62099,"Other information technology and computer service activities n.e.c."\n72200,Research and experimental development on social sciences and humanities\n';
  const rows=parseCsv(csv);
  assert.equal(rows.length,3);
  assert.equal(rows[1].code,'62099');
  assert.match(rows[1].description,/information technology/);
});

test('validates NIC-2008 anchor codes', () => {
  const rows=[
    {code:'01111',description:'Growing of wheat'},
    {code:'62099',description:'Other information technology and computer service activities n.e.c.'},
    {code:'72200',description:'Research and experimental development on social sciences and humanities'},
  ];
  const report=validateNic2008(rows,{minimumRows:3});
  assert.equal(report.valid,true);
});
