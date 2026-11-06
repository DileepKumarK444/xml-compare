import type { CompareOptions, CompareResult, Summary } from '../types';

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

const KEY = 'xml-compare-history';
const MAX_ENTRIES = 100;

export function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    /* storage blocked or full — history is a convenience, so ignore */
  }
}

export function entryFromResult(r: CompareResult): HistoryEntry {
  return {
    id: crypto.randomUUID(),
    at: new Date().toISOString(),
    original: { name: r.original.filename, size: r.original.size },
    modified: { name: r.modified.filename, size: r.modified.size },
    options: r.options,
    source: r.source.summary,
    content: r.content.summary,
  };
}

export function withEntry(list: HistoryEntry[], e: HistoryEntry): HistoryEntry[] {
  return [e, ...list].slice(0, MAX_ENTRIES);
}
