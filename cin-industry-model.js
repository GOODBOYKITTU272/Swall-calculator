(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CinIndustryModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const TECH_NAME_RE = /\b(tech|technology|technologies|software|digital|ai|systems?|solutions?|informatics?|info ?tech|iot)\b/i;

  function clean(value) { return String(value || '').trim(); }

  function parseCin(cin) {
    const raw = clean(cin).toUpperCase();
    const match = /^([LU])([0-9]{5})([A-Z]{2})([0-9]{4})([A-Z]{3})([0-9]{6})$/.exec(raw);
    if (!match) return { raw, valid: false };
    return {
      raw,
      valid: true,
      listing_status: match[1],
      industry_code: match[2],
      state_code: match[3],
      incorporation_year: Number(match[4]),
      company_class: match[5],
      registration_number: match[6],
    };
  }

  function lookupSector(row, sectorMap) {
    const byVersion = sectorMap && sectorMap[row.version];
    if (!byVersion) return null;
    const division = String(row.division || row.code || '').slice(0, 2);
    return byVersion[row.code] || byVersion[division] || null;
  }

  function normalizeCandidate(version, row, code, sectorMap) {
    const normalized = { ...row, version: row.version || version, code: row.code || code };
    const sector = lookupSector(normalized, sectorMap);
    return {
      ...normalized,
      primary_sector: sector?.primary_sector || 'unclassified',
      technology_signal: sector?.technology_signal || 'unknown',
    };
  }

  function compatibleCandidates(candidates) {
    if (candidates.length < 2) return true;
    const sectors = new Set(candidates.map((row) => row.primary_sector));
    const descriptions = new Set(candidates.map((row) => clean(row.description).toLowerCase()));
    return sectors.size === 1 && descriptions.size === 1;
  }

  function resolveCinIndustry(code, dictionaries, overrides, sectorMap) {
    const normalized = clean(code);
    if (!/^\d{5}$/.test(normalized)) {
      return { code: normalized, status: 'invalid', primary_sector: 'unclassified', review_required: true };
    }

    const override = overrides && overrides[normalized];
    if (override && override.verified) {
      return {
        code: normalized,
        status: 'exact',
        resolution_source: 'verified_override',
        dictionary_version: override.dictionary_version || 'CIN-LEGACY',
        description: override.description,
        primary_sector: override.primary_sector || 'unclassified',
        technology_signal: override.technology_signal || 'unknown',
        confidence: override.confidence || 'high',
        evidence: override.evidence || [],
        review_required: false,
      };
    }

    const candidates = [];
    for (const [version, rows] of Object.entries(dictionaries || {})) {
      const row = rows && rows[normalized];
      if (!row || row.verified === false) continue;
      candidates.push(normalizeCandidate(version, row, normalized, sectorMap));
    }

    if (!candidates.length) {
      return { code: normalized, status: 'unmatched', candidates: [], primary_sector: 'unclassified', technology_signal: 'unknown', review_required: true };
    }

    if (candidates.length === 1 || compatibleCandidates(candidates)) {
      const chosen = candidates[0];
      return {
        code: normalized,
        status: 'exact',
        resolution_source: candidates.length === 1 ? 'official_dictionary' : 'compatible_dictionaries',
        dictionary_version: candidates.length === 1 ? chosen.version : candidates.map((row) => row.version).join('+'),
        description: chosen.description,
        primary_sector: chosen.primary_sector,
        technology_signal: chosen.technology_signal,
        confidence: chosen.primary_sector === 'unclassified' ? 'medium' : 'high',
        candidates,
        review_required: chosen.primary_sector === 'unclassified',
      };
    }

    return {
      code: normalized,
      status: 'ambiguous',
      resolution_source: 'conflicting_dictionaries',
      candidates,
      primary_sector: 'unclassified',
      technology_signal: 'unknown',
      review_required: true,
    };
  }

  function classifyCompany(company, dictionaries, overrides, sectorMap) {
    const parsed = parseCin(company && company.cin);
    const anomaly_flags = [];
    if (TECH_NAME_RE.test(clean(company && company.name))) anomaly_flags.push('name_contains_technology_term');
    if (!parsed.valid) {
      return { ...parsed, nic_match_status: 'invalid_cin', primary_sector: 'unclassified', technology_signal: 'unknown', review_required: true, anomaly_flags };
    }
    const resolved = resolveCinIndustry(parsed.industry_code, dictionaries, overrides, sectorMap);
    if (anomaly_flags.includes('name_contains_technology_term') && resolved.primary_sector !== 'technology') {
      anomaly_flags.push('name_sector_mismatch_review');
    }
    return {
      ...parsed,
      cin_industry_code: parsed.industry_code,
      nic_match_status: resolved.status,
      classification_dictionary: resolved.dictionary_version || '',
      official_description: resolved.description || '',
      primary_sector: resolved.primary_sector || 'unclassified',
      technology_signal: resolved.technology_signal || 'unknown',
      classification_source: resolved.resolution_source || 'unresolved',
      sector_confidence: resolved.confidence || 'none',
      review_required: Boolean(resolved.review_required),
      classification_candidates: resolved.candidates || [],
      anomaly_flags,
    };
  }

  return { parseCin, resolveCinIndustry, classifyCompany };
});
