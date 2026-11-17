# XML Compare

Local-only web app with a dashboard of tools: **XML Compare**, **JSON Compare**, **Text Compare** and **XML Validator**. XML and JSON compare each work in two modes (Text Compare has the Source view only):

- **Source View** – line diff of the raw text (Monaco diff editor, files never reformatted).
- **Content View** – structural diff shown as a navigable tree. XML: elements, attributes, text, namespaces, ordering. JSON: properties, array items (matched by `id`/`name`/`key`/… when present), value types and values; property order is ignored.

Nothing is stored on the server: files are processed in memory, with no database and no auth. For convenience the browser keeps a comparison history (file names, sizes, options, difference counts in localStorage, and the file contents in IndexedDB) so past comparisons can be re-opened from the upload page. It never leaves your machine; "Remove" / "Clear history" deletes it.
Works offline once dependencies are installed.

## Run (Windows, macOS, Linux, WSL)

Needs Node 20.19+ and Python 3.10+. One command from the repo root:

```bash
node run.mjs      # or: npm start
```

It creates the Python venv and installs `node_modules` for **your** system when they are missing or were
made on another OS (a common cause of "Cannot find native binding" errors in WSL), then starts the backend
(http://localhost:8010) and the frontend (http://localhost:5173, opens the dashboard). Ctrl+C stops both.
Change ports with `BACKEND_PORT=8011 FRONTEND_PORT=5180 node run.mjs`
(PowerShell: `$env:BACKEND_PORT=8011; node run.mjs`).

Don't share `node_modules` or `.venv` between Windows/macOS and WSL; each system sets up its own.

Manual start (equivalent):

```bash
cd backend && python3 -m venv .venv && .venv/bin/pip install -r requirements.txt && .venv/bin/python manage.py runserver 8010
cd frontend && npm install && npm run dev
```
(Windows venv path: `.venv\Scripts\python`.)

Checks: `cd backend && .venv/bin/pytest` and `cd frontend && npm run lint && npm run build`.

Frontend-only demo (no backend): set `VITE_USE_MOCK=true` in `frontend/.env.development`
and use **Load sample files** on the upload screen.

## API

`POST /api/compare/<format>/` with format `xml`, `json` or `text` (multipart): `original_file`, `modified_file`, optional booleans
`ignore_whitespace` (default true), `ignore_comments` (false), `ignore_order` (false).
Returns `{options, original, modified, source:{summary,differences}, content:{summary,differences,tree}}`.
Invalid input -> `400 {"error": "...", "line": n}`. `GET /api/health/` lists supported formats.

`POST /api/validate/xml/` (multipart): `xml_file`, optional `schema_file` (a single self-contained XSD).
Returns `{well_formed, valid, schema, summary, errors:[{id, kind: syntax|schema, line, column, message}], stats, text}`.
A schema that is not a valid XSD, or that includes/imports other files -> `400 {"error": "..."}`.

## Architecture

```
backend/comparison/services/
  parser.py      XMLParser: hardened lxml (no XXE/network) -> format-neutral Node tree
  source.py      XMLSourceComparator: difflib line diff on (optionally normalised) lines
  structural.py  XMLStructuralComparator: match by id attrs -> identical subtrees ->
                 similarity (attrs/text/children) -> single-candidate pairing; LIS for order changes;
                 added/removed subtrees reported once at their root
  service.py     XMLComparisonService orchestrates both (no Django imports)
  text_service.py   TextComparisonService: line diff only (content is null)
  xml_validator.py  XMLValidator: well-formedness + XSD, every error with line/column
  json_parser.py / json_structural.py / json_service.py   the same pipeline for JSON
                 (`ignore_order` = array order; `ignore_comments` does not apply)
backend/comparison/registry.py   add new document formats here (URL: /api/compare/<format>/)
frontend/src/    React + MUI; state in state/AppState.tsx (result survives Back to Upload)
```

Adding PostgreSQL later: define `DATABASES` in `config/settings.py` and add models for users,
comparison history and uploaded-file metadata; the comparison services need no changes.

## Notes

- Summary counts are per mode: Source = hunks (unchanged = lines); Content = reported differences
  (unchanged = elements with no own change). Both come from the backend result.
- Element order is significant by default; `ignore_order` disables move detection.
