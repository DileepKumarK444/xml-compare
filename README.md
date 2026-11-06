# XML Compare

Local-only web app that compares two XML files in two modes:

- **XML Source View** – line diff of the raw text (Monaco diff editor, files never reformatted).
- **XML Content View** – structural diff (elements, attributes, text, namespaces, ordering) shown as a navigable tree.

Nothing is stored: files are processed in memory, there is no database, no auth, no history.
Works offline once dependencies are installed.

## Run

Backend (http://localhost:8000):

```bash
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
.venv/bin/python manage.py runserver 8000
```

Frontend (http://localhost:5173):

```bash
cd frontend
npm install
npm run dev
```

Checks: `cd backend && .venv/bin/pytest` and `cd frontend && npm run lint && npm run build`.

Frontend-only demo (no backend): set `VITE_USE_MOCK=true` in `frontend/.env.development`
and use **Load sample files** on the upload screen.

## API

`POST /api/compare/xml/` (multipart): `original_file`, `modified_file`, optional booleans
`ignore_whitespace` (default true), `ignore_comments` (false), `ignore_order` (false).
Returns `{options, original, modified, source:{summary,differences}, content:{summary,differences,tree}}`.
Invalid XML -> `400 {"error": "...", "line": n}`. `GET /api/health/` lists supported formats.

## Architecture

```
backend/comparison/services/
  parser.py      XMLParser: hardened lxml (no XXE/network) -> format-neutral Node tree
  source.py      XMLSourceComparator: difflib line diff on (optionally normalised) lines
  structural.py  XMLStructuralComparator: match by id attrs -> identical subtrees ->
                 similarity (attrs/text/children) -> single-candidate pairing; LIS for order changes;
                 added/removed subtrees reported once at their root
  service.py     XMLComparisonService orchestrates both (no Django imports)
backend/comparison/registry.py   add new document formats here (URL: /api/compare/<format>/)
frontend/src/    React + MUI; state in state/AppState.tsx (result survives Back to Upload)
```

Adding PostgreSQL later: define `DATABASES` in `config/settings.py` and add models for users,
comparison history and uploaded-file metadata; the comparison services need no changes.

## Notes

- Summary counts are per mode: Source = hunks (unchanged = lines); Content = reported differences
  (unchanged = elements with no own change). Both come from the backend result.
- Element order is significant by default; `ignore_order` disables move detection.
