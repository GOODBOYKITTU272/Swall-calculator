const test = require('node:test');
const assert = require('node:assert/strict');
const { parseNic1998Text, validateNic1998 } = require('../scripts/import-nic-1998');

test('parses five-digit NIC-1998 subclass lines from extracted PDF text', () => {
  const text=`
01111 Growing of food grain crops (cereals and pulses)
72200 Software consultancy and supply
72900 Other computer related activities
`;
  const rows=parseNic1998Text(text);
  assert.deepEqual(rows.map(r=>r.code),['01111','72200','72900']);
  assert.match(rows[1].description,/Software consultancy/);
});

test('validates NIC-1998 anchors and expected master shape', () => {
  const rows=[
    {code:'01111',description:'Growing of food grain crops (cereals and pulses)'},
    {code:'24233',description:'Manufacture of pharmaceutical preparations'},
    {code:'72200',description:'Software consultancy and supply'},
    {code:'72900',description:'Other computer related activities'},
  ];
  const report=validateNic1998(rows,{minimumRows:4});
  assert.equal(report.valid,true);
  assert.deepEqual(report.missingAnchors,[]);
});
