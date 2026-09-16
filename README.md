# Company Segregation

Static dashboard for MCA Form STK-7 company segregation and Mercor coding inventory.

## Structure

```
company-segregation-ui/
  index.html
  styles.css
  app.js
  data/companies.json
  data/summary.json
  vercel.json
  package.json
  README.md
```

## Open locally

Because browsers block `fetch()` of local JSON under `file://`, serve the folder over HTTP:

```bash
cd /workspace/company-segregation-ui
npx --yes serve . -p 3000
# then open http://localhost:3000
```

Or with Python:

```bash
cd /workspace/company-segregation-ui
python3 -m http.server 8080
# then open http://localhost:8080
```

`index.html` uses relative paths (`data/companies.json`, `data/summary.json`), so any static host works.

## Deploy to Vercel

```bash
cd /workspace/company-segregation-ui
npx vercel --prod
```

Or connect the folder in the Vercel dashboard as a static site (no build command; output/root = `.`).

## Data notes

- Deep-dive (website / email / phone / GitHub) was completed for **tech** and **biotech** only.
- **Non-tech** companies are marked `contact_status: not_checked` — filters and empty states reflect that honestly.
