import type { AnyResult, CompareOptions, Summary } from '../types';

/** One past comparison. Only names and counts are kept — never file contents. */
export interface HistoryEntry {
  id: string;
  at: string; // ISO timestamp
  original: { name: string; size: number };
  modified: { name: string; size: number };
  options: CompareOptions;
  source: Summary;
  content: Summary;
  /** True once the file contents were saved, so the comparison can be re-opened. */
  stored?: boolean;
}

const MAX_ENTRIES = 100;

export function loadHistory(key: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(key: string, entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
  } catch {
    /* storage blocked or full — history is a convenience, so ignore */
  }
}

export function entryFromResult(r: AnyResult): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    original: { name: r.original.filename, size: r.original.size },
    modified: { name: r.modified.filename, size: r.modified.size },
    options: r.options,
    source: r.source.summary,
    content: r.content?.summary ?? r.source.summary,
  };
}

export function withEntry(list: HistoryEntry[], e: HistoryEntry): HistoryEntry[] {
  return [e, ...list].slice(0, MAX_ENTRIES);
}
