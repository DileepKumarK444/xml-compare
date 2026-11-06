import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { compareXml } from '../api/compare';
import type { CompareOptions, CompareResult, DiffFilter, ViewMode } from '../types';
import { checkWellFormed } from '../utils/format';
import { deleteFiles, getFiles, putFiles } from '../utils/fileStore';
import {
  entryFromResult,
  loadHistory,
  saveHistory,
  withEntry,
  type HistoryEntry,
} from '../utils/history';

export interface SelectedFile {
  file: File;
  text: string;
  error: string | null; // null => valid XML
}

export interface ViewState {
  tab: ViewMode;
  filter: DiffFilter;
  selected: Record<ViewMode, number | null>;
}

const DEFAULT_OPTIONS: CompareOptions = {
  ignore_whitespace: true,
  ignore_comments: false,
  ignore_order: false,
};
const DEFAULT_VIEW: ViewState = {
  tab: 'source',
  filter: 'all',
  selected: { source: null, content: null },
};
const MAX_BYTES = 20 * 1024 * 1024;

interface AppState {
  original: SelectedFile | null;
  modified: SelectedFile | null;
  options: CompareOptions;
  result: CompareResult | null;
  loading: boolean;
  error: string | null;
  view: ViewState;
  setView: (patch: Partial<ViewState>) => void;
  selectDifference: (id: number | null) => void;
  setOptions: (o: CompareOptions) => void;
  loadFile: (which: 'original' | 'modified', file: File) => Promise<void>;
  clearFile: (which: 'original' | 'modified') => void;
  swapFiles: () => void;
  compare: () => Promise<boolean>;
  /** Re-run the comparison with edited text for either side. Resolves to an error message, or null on success. */
  recompare: (texts: { original?: string; modified?: string }) => Promise<string | null>;
  history: HistoryEntry[];
  removeHistory: (id: string) => void;
  clearHistory: () => void;
  /** Load a past comparison from stored file contents. Resolves true on success. */
  reopenHistory: (id: string) => Promise<boolean>;
  reset: () => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [original, setOriginal] = useState<SelectedFile | null>(null);
  const [modified, setModified] = useState<SelectedFile | null>(null);
  const [options, setOptions] = useState<CompareOptions>(DEFAULT_OPTIONS);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setViewState] = useState<ViewState>(DEFAULT_VIEW);
  const [history, setHistory] = useState<HistoryEntry[]>(loadHistory);

  const updateHistory = useCallback((fn: (h: HistoryEntry[]) => HistoryEntry[]) => {
    setHistory((h) => {
      const next = fn(h);
      saveHistory(next);
      // Drop stored file contents for entries that fell out of the list (idempotent).
      const keep = new Set(next.map((e) => e.id));
      void deleteFiles(h.filter((e) => !keep.has(e.id)).map((e) => e.id));
      return next;
    });
  }, []);
  const removeHistory = useCallback(
    (id: string) => updateHistory((h) => h.filter((e) => e.id !== id)),
    [updateHistory],
  );
  const clearHistory = useCallback(() => updateHistory(() => []), [updateHistory]);

  const setView = useCallback(
    (patch: Partial<ViewState>) => setViewState((v) => ({ ...v, ...patch })),
    [],
  );
  const selectDifference = useCallback(
    (id: number | null) =>
      setViewState((v) => ({ ...v, selected: { ...v.selected, [v.tab]: id } })),
    [],
  );

  const loadFile = useCallback(async (which: 'original' | 'modified', file: File) => {
    let problem: string | null;
    let text = '';
    if (!file.name.toLowerCase().endsWith('.xml')) problem = 'Only .xml files are accepted.';
    else if (file.size === 0) problem = 'File is empty.';
    else if (file.size > MAX_BYTES) problem = 'File is larger than 20 MB.';
    else {
      text = await file.text();
      problem = checkWellFormed(text);
    }
    (which === 'original' ? setOriginal : setModified)({ file, text, error: problem });
    setError(null);
  }, []);

  const clearFile = useCallback((which: 'original' | 'modified') => {
    (which === 'original' ? setOriginal : setModified)(null);
  }, []);

  const swapFiles = useCallback(() => {
    setOriginal(modified);
    setModified(original);
    setError(null);
  }, [original, modified]);

  const compare = useCallback(async () => {
    if (!original || !modified || original.error || modified.error) return false;
    setLoading(true);
    setError(null);
    try {
      const res = await compareXml(original.file, modified.file, options);
      setResult(res);
      setViewState(DEFAULT_VIEW);
      const entry = entryFromResult(res); // built once, outside any state updater
      updateHistory((h) => withEntry(h, entry));
      void putFiles({
        id: entry.id,
        original: { name: res.original.filename, text: res.original.text },
        modified: { name: res.modified.filename, text: res.modified.text },
      }).then(
        (ok) =>
          ok &&
          updateHistory((h) => h.map((e) => (e.id === entry.id ? { ...e, stored: true } : e))),
      );
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Comparison failed.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [original, modified, options, updateHistory]);

  const reopenHistory = useCallback(
    async (id: string) => {
      setError(null);
      const entry = history.find((e) => e.id === id);
      const files = await getFiles(id);
      if (!entry || !files) {
        setError('The saved files for this comparison are no longer available in this browser.');
        return false;
      }
      setLoading(true);
      try {
        const mk = (f: { name: string; text: string }) =>
          new File([f.text], f.name, { type: 'application/xml' });
        const res = await compareXml(mk(files.original), mk(files.modified), entry.options);
        setResult(res);
        setViewState(DEFAULT_VIEW);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Comparison failed.');
        return false;
      } finally {
        setLoading(false);
      }
    },
    [history],
  );

  const resultRef = useRef<CompareResult | null>(null);
  const seqRef = useRef(0);
  useEffect(() => {
    resultRef.current = result;
  }, [result]);

  const recompare = useCallback(async (texts: { original?: string; modified?: string }) => {
    const cur = resultRef.current;
    if (!cur) return null;
    const seq = ++seqRef.current;
    const mk = (t: string, n: string) => new File([t], n, { type: 'application/xml' });
    try {
      const res = await compareXml(
        mk(texts.original ?? cur.original.text, cur.original.filename),
        mk(texts.modified ?? cur.modified.text, cur.modified.filename),
        cur.options,
      );
      if (seq !== seqRef.current) return null; // a newer edit superseded this one
      setResult(res);
      setViewState((v) => ({
        ...v,
        selected: {
          source: res.source.differences.some((d) => d.id === v.selected.source)
            ? v.selected.source
            : null,
          content: res.content.differences.some((d) => d.id === v.selected.content)
            ? v.selected.content
            : null,
        },
      }));
      return null;
    } catch (e) {
      return seq === seqRef.current && e instanceof Error ? e.message : null;
    }
  }, []);

  const reset = useCallback(() => {
    setOriginal(null);
    setModified(null);
    setOptions(DEFAULT_OPTIONS);
    setResult(null);
    setError(null);
    setViewState(DEFAULT_VIEW);
  }, []);

  const value = useMemo(
    () => ({
      original,
      modified,
      options,
      result,
      loading,
      error,
      view,
      setView,
      selectDifference,
      setOptions,
      loadFile,
      clearFile,
      swapFiles,
      compare,
      recompare,
      history,
      removeHistory,
      clearHistory,
      reopenHistory,
      reset,
    }),
    [
      original,
      modified,
      options,
      result,
      loading,
      error,
      view,
      setView,
      selectDifference,
      loadFile,
      clearFile,
      swapFiles,
      compare,
      recompare,
      history,
      removeHistory,
      clearHistory,
      reopenHistory,
      reset,
    ],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAppState must be used inside AppStateProvider');
  return v;
}
