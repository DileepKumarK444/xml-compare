import type { FormatConfig } from '../formats';
import type { AnyResult } from '../types';
import { statusColors } from '../theme';

const esc = (s: string | null | undefined) =>
  (s ?? '').replace(
    /[&<>"]/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!,
  );

/** Self-contained HTML report covering both comparison modes. */
export function buildReport(r: AnyResult, cfg: FormatConfig): string {
  const badge = (t: keyof typeof statusColors) =>
    `<span style="background:${statusColors[t].bg};color:${statusColors[t].main};padding:2px 8px;border-radius:10px;font-size:12px;font-weight:600">${statusColors[t].label}</span>`;
  const summary = (s: AnyResult['source']['summary'], unit: string) =>
    `<p>Total <b>${s.total}</b> · Added <b>${s.added}</b> · Removed <b>${s.removed}</b> · Modified <b>${s.modified}</b> · Unchanged ${unit} <b>${s.unchanged}</b></p>`;

  const srcRows = r.source.differences
    .map(
      (d) => `<tr><td>${d.id}</td><td>${badge(d.type)}</td>
<td>${d.original_start ? `${d.original_start}–${d.original_end}` : '—'}</td>
<td>${d.modified_start ? `${d.modified_start}–${d.modified_end}` : '—'}</td>
<td>${esc(d.preview)}</td></tr>`,
    )
    .join('');
  const contentRows = (r.content?.differences ?? [])
    .map(
      (d) => `<tr><td>${d.id}</td><td>${badge(d.type)}</td><td><code>${esc(d.path)}</code></td>
<td>${esc(d.original_value) || '—'}</td><td>${esc(d.modified_value) || '—'}</td><td>${esc(d.description)}</td></tr>`,
    )
    .join('');

  return `<!doctype html><html><head><meta charset="utf-8"><title>${cfg.tool} report</title>
<style>body{font:14px system-ui,sans-serif;margin:32px;color:#1d2b3a}h1{color:#0b2a4f}
table{border-collapse:collapse;width:100%;margin:8px 0 28px}th,td{border:1px solid #dde4ee;padding:6px 10px;text-align:left;vertical-align:top}
th{background:#f4f7fb}code{font-size:12px}</style></head><body>
<h1>${cfg.tool} report</h1>
<p>Original: <b>${esc(r.original.filename)}</b> · Modified: <b>${esc(r.modified.filename)}</b><br>
Options — ignore whitespace: ${r.options.ignore_whitespace}, ignore comments: ${r.options.ignore_comments}, ignore order: ${r.options.ignore_order}<br>
Generated ${new Date().toLocaleString()}</p>
<h2>${cfg.name} Source View</h2>${summary(r.source.summary, 'lines')}
<table><tr><th>#</th><th>Type</th><th>Original lines</th><th>Modified lines</th><th>Content</th></tr>${srcRows || '<tr><td colspan=5>No differences</td></tr>'}</table>
${
  r.content
    ? `<h2>${cfg.name} Content View</h2>${summary(r.content.summary, cfg.contentUnit)}
<table><tr><th>#</th><th>Type</th><th>${cfg.id === 'xml' ? 'XML path' : 'JSON path'}</th><th>Original</th><th>Modified</th><th>Description</th></tr>${contentRows || '<tr><td colspan=6>No differences</td></tr>'}</table>`
    : ''
}
</body></html>`;
}
