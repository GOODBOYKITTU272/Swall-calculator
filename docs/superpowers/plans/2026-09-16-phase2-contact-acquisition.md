# Phase 2 Contact Acquisition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing MCA STK-7 company inventory into a sector-first contact acquisition workflow where every company can be classified as contact-known or contact-unknown, researched, enriched, and moved into outreach.

**Architecture:** Keep the product as a zero-build static SPA. Add a pure data/model module for sector classification, contact readiness, aggregation, and pipeline status; test it with Node's built-in test runner. The browser app uses hash routing, the existing `data/companies.json`, and localStorage for manual contacts/outreach state so Phase 2 works without a backend migration.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js built-in test runner, existing JSON datasets.

**Spec:** Approved Phase 2 flow: Sector → Known/Unknown → Company Contacts → Research/Enrich → Outreach → Opportunity Pipeline.

## Global Constraints

- Preserve the existing full `data/companies.json` and `data/summary.json` datasets.
- Do not fabricate director names, emails, phone numbers, or LinkedIn profiles.
- `Known` means at least one usable contact channel exists in source data or a manually saved person contact.
- `Unknown` includes both `unknown` and `not_checked` source statuses when no usable contact channel exists.
- Sector/domain classifications derived from NIC/name heuristics must be labeled as derived, not verified research.
- Keep the app runnable with `npm start` and no build step.

## Implemented Tasks

- [x] Contact intelligence model and tests.
- [x] Phase 2 SPA shell and routes.
- [x] Sector cards with Known vs Unknown splits.
- [x] Company contact dossier with factual-source-only policy.
- [x] Manual contact enrichment persisted in localStorage.
- [x] Research queue.
- [x] Outreach tracker.
- [x] Contact pipeline.
- [x] CSV export for the current view.
- [x] Local syntax, test, and HTTP smoke verification.
