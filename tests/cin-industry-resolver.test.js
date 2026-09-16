const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../cin-industry-model');

const dictionaries = {
  'NIC-1998': {
    '72200': { code:'72200', description:'Software publishing, consultancy and supply', version:'NIC-1998', division:'72', verified:true },
    '72900': { code:'72900', description:'Other computer related activities', version:'NIC-1998', division:'72', verified:true },
  },
  'NIC-2004': {
    '24233': { code:'24233', description:'Manufacture of ayurvedic or unani pharmaceutical preparations', version:'NIC-2004', division:'24', verified:true },
    '72291': { code:'72291', description:'Analysis, design and programming of custom software', version:'NIC-2004', division:'72', verified:true },
  },
  'NIC-2008': {
    '62099': { code:'62099', description:'Other information technology and computer service activities n.e.c.', version:'NIC-2008', division:'62', verified:true },
    '72200': { code:'72200', description:'Research and experimental development on social sciences and humanities', version:'NIC-2008', division:'72', verified:true },
  },
};

const overrides = {
  '72200': {
    description:'Software publishing, consultancy and supply',
    primary_sector:'technology', technology_signal:'high',
    source:'validated_cin_legacy_semantics', confidence:'high', verified:true,
  },
  '72900': {
    description:'Other computer related activities',
    primary_sector:'technology', technology_signal:'high',
    source:'validated_cin_legacy_semantics', confidence:'high', verified:true,
  },
};

const sectorMap = {
  'NIC-2004': { '24': {primary_sector:'healthcare_pharma',technology_signal:'low'}, '72': {primary_sector:'technology',technology_signal:'high'} },
  'NIC-2008': { '62': {primary_sector:'technology',technology_signal:'high'}, '72': {primary_sector:'professional_services',technology_signal:'high'} },
  'NIC-1998': { '72': {primary_sector:'technology',technology_signal:'high'} },
};

test('parses industry code from CIN without using company name', () => {
  const p=M.parseCin('U72200KA2014PTC075971');
  assert.equal(p.valid,true); assert.equal(p.industry_code,'72200');
});

test('verified CIN override wins when official dictionaries conflict for 72200', () => {
  const r=M.resolveCinIndustry('72200', dictionaries, overrides, sectorMap);
  assert.equal(r.status,'exact'); assert.equal(r.resolution_source,'verified_override');
  assert.equal(r.primary_sector,'technology');
  assert.match(r.description,/Software publishing/);
});

test('72900 legacy CIN semantics resolve to technology', () => {
  const r=M.resolveCinIndustry('72900', dictionaries, overrides, sectorMap);
  assert.equal(r.status,'exact'); assert.equal(r.primary_sector,'technology');
});

test('24233 resolves exactly through NIC-2004 to healthcare pharma', () => {
  const r=M.resolveCinIndustry('24233', dictionaries, overrides, sectorMap);
  assert.equal(r.status,'exact'); assert.equal(r.dictionary_version,'NIC-2004');
  assert.equal(r.primary_sector,'healthcare_pharma');
});

test('62099 resolves exactly through NIC-2008 to technology', () => {
  const r=M.resolveCinIndustry('62099', dictionaries, overrides, sectorMap);
  assert.equal(r.status,'exact'); assert.equal(r.dictionary_version,'NIC-2008');
  assert.equal(r.primary_sector,'technology');
});

test('company name technology term cannot override non-tech code', () => {
  const c=M.classifyCompany({cin:'U24233KA2004PTC034320',name:'RISHI HERBAL TECHNOLOGIES PRIVATE LIMITED'}, dictionaries, overrides, sectorMap);
  assert.equal(c.primary_sector,'healthcare_pharma');
  assert.ok(c.anomaly_flags.includes('name_contains_technology_term'));
  assert.ok(c.anomaly_flags.includes('name_sector_mismatch_review'));
});

test('conflicting dictionary meanings without override remain review required', () => {
  const r=M.resolveCinIndustry('72200', dictionaries, {}, sectorMap);
  assert.equal(r.status,'ambiguous'); assert.equal(r.review_required,true);
});

test('unknown code remains unclassified and review required', () => {
  const c=M.classifyCompany({cin:'U99999KA2020PTC123456',name:'ABC TECH PRIVATE LIMITED'}, dictionaries, overrides, sectorMap);
  assert.equal(c.primary_sector,'unclassified'); assert.equal(c.review_required,true);
});

test('manufacturing fallback maps configured division to manufacturing', () => {
  const dictionaries2={
    'NIC-2008': {'25111':{code:'25111',description:'Manufacture of structural metal products',version:'NIC-2008',division:'25',verified:true}},
  };
  const sectorMap2={
    'NIC-2008': { default_manufacturing_divisions:['25'] },
  };
  const r=M.resolveCinIndustry('25111',dictionaries2,{},sectorMap2);
  assert.equal(r.primary_sector,'manufacturing');
  assert.equal(r.technology_signal,'low');
});
