import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import SaveIcon from '@mui/icons-material/Save';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import { Alert, Box, Button, Chip, Paper, Snackbar, Stack } from '@mui/material';
import { DiffEditor } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../monaco';
import type { AnyResult, SourceDifference } from '../types';
import { useFormat } from '../formats';
import { copyText, download } from '../utils/format';
import { buildReport } from '../utils/report';
import DiffNav from './DiffNav';
import FileTitles from './FileTitles';

interface Props {
  result: AnyResult;
  visible: SourceDifference[]; // filtered
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Re-compare with edited Modified text; resolves to an error message or null. */
  onEdit: (texts: { original?: string; modified?: string }) => Promise<string | null>;
}

type Collection = { clear: () => void; set: (d: unknown[]) => void };

const EDIT_DEBOUNCE_MS = 600;
const IMMEDIATE = 1; // monaco.editor.ScrollType.Immediate — no smooth-scroll lag
const GLYPH_MARGIN_TARGET = 2; // monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN

function editedName(name: string) {
  const i = name.lastIndexOf('.');
  return i > 0 ? `${name.slice(0, i)}-edited${name.slice(i)}` : `${name}-edited`;
}

export default function SourceView({ result, visible, selectedId, onSelect, onEdit }: Props) {
  const cfg = useFormat();
  const diffRef = useRef<{
    getOriginalEditor: () => never;
    getModifiedEditor: () => never;
    getLineChanges: () => LineChange[] | null;
  } | null>(null);
  const decorations = useRef<Collection[]>([]);
  const glyphs = useRef<Collection[]>([]);
  const changes = useRef<LineChange[]>([]);
  const [originalEdited, setOriginalEdited] = useState(false);
  const [toast, setToast] = useState('');
  // The editor owns the Modified text while editing, so this seed is captured once (not re-synced
  // from `result`, which would overwrite what the user typed while a re-compare was in flight).
  const [initialModified] = useState(result.modified.text);
  const [dirty, setDirty] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runId = useRef(0);
  const onEditRef = useRef(onEdit);
  useEffect(() => {
    onEditRef.current = onEdit;
  }, [onEdit]);
  useEffect(() => () => clearTimeout(timer.current), []);
  const all = result.source.differences;

  const apply = useCallback(() => {
    const ed = diffRef.current;
    if (!ed) return;
    const sides = [
      {
        editor: ed.getOriginalEditor() as never as EditorLike,
        start: 'original_start',
        end: 'original_end',
      },
      {
        editor: ed.getModifiedEditor() as never as EditorLike,
        start: 'modified_start',
        end: 'modified_end',
      },
    ] as const;
    decorations.current.forEach((c) => c.clear());
    decorations.current = sides.map(({ editor, start, end }) => {
      const decs: unknown[] = [];
      for (const d of all) {
        const s = d[start];
        const e = d[end];
        if (s == null || e == null) continue;
        if (d.id === selectedId) {
          // Native Monaco colours show the diff (VS Code style); we only outline the selection.
          decs.push({
            range: { startLineNumber: s, startColumn: 1, endLineNumber: e, endColumn: 1 },
            options: {
              isWholeLine: true,
              className: 'xc-line-selected',
              linesDecorationsClassName: 'xc-gutter-selected',
            },
          });
        }
      }
      const c = editor.createDecorationsCollection(decs);
      return c as Collection;
    });
    const sel = all.find((d) => d.id === selectedId);
    if (sel) {
      if (sel.modified_start != null)
        sides[1].editor.revealLineInCenter(sel.modified_start, IMMEDIATE);
      else if (sel.original_start != null)
        sides[0].editor.revealLineInCenter(sel.original_start, IMMEDIATE);
    }
  }, [all, selectedId]);

  useEffect(() => {
    apply();
  }, [apply]);

  // Arrow glyphs in each pane's margin, one per block Monaco's own diff reports (VS Code style).
  // Original's arrow copies that block into Modified; Modified's arrow copies it into Original.
  const refreshGlyphs = useCallback(() => {
    const ed = diffRef.current;
    if (!ed) return;
    changes.current = ed.getLineChanges() ?? [];
    glyphs.current.forEach((c) => c.clear());
    const mk = (cls: string, tip: string, line: number) => ({
      range: { startLineNumber: line, startColumn: 1, endLineNumber: line, endColumn: 1 },
      options: { glyphMarginClassName: cls, glyphMarginHoverMessage: { value: tip } },
    });
    const orig = ed.getOriginalEditor() as never as EditorLike;
    const mod = ed.getModifiedEditor() as never as EditorLike;
    glyphs.current = [
      orig.createDecorationsCollection(
        changes.current
          .filter((c) => c.originalEndLineNumber > 0)
          .map((c) =>
            mk('xc-glyph-to-modified', 'Copy this block to Modified', c.originalStartLineNumber),
          ),
      ) as Collection,
      mod.createDecorationsCollection(
        changes.current
          .filter((c) => c.modifiedEndLineNumber > 0)
          .map((c) =>
            mk('xc-glyph-to-original', 'Copy this block to Original', c.modifiedStartLineNumber),
          ),
      ) as Collection,
    ];
  }, []);

  // Copy the block under `line` in `from`'s pane into the other file.
  const copyBlock = async (from: 'original' | 'modified', line: number) => {
    const ed = diffRef.current;
    if (!ed) return;
    const c = changes.current.find((x) =>
      from === 'original'
        ? line >= x.originalStartLineNumber &&
          line <= Math.max(x.originalEndLineNumber, x.originalStartLineNumber)
        : line >= x.modifiedStartLineNumber &&
          line <= Math.max(x.modifiedEndLineNumber, x.modifiedStartLineNumber),
    );
    if (!c) return;
    const srcPane = (from === 'original'
      ? ed.getOriginalEditor()
      : ed.getModifiedEditor()) as never as BlockEditor;
    const dstPane = (from === 'original'
      ? ed.getModifiedEditor()
      : ed.getOriginalEditor()) as never as BlockEditor;
    const src = srcPane.getModel();
    const dst = dstPane.getModel();
    if (!src || !dst) return;
    const [s1, s2, d1, d2] =
      from === 'original'
        ? [
            c.originalStartLineNumber,
            c.originalEndLineNumber,
            c.modifiedStartLineNumber,
            c.modifiedEndLineNumber,
          ]
        : [
            c.modifiedStartLineNumber,
            c.modifiedEndLineNumber,
            c.originalStartLineNumber,
            c.originalEndLineNumber,
          ];
    const text = src.getValueInRange({
      startLineNumber: s1,
      startColumn: 1,
      endLineNumber: s2,
      endColumn: src.getLineMaxColumn(s2),
    });
    const eol = dst.getEOL();
    let edit: { range: unknown; text: string };
    if (d2 > 0) {
      // The other file has lines here too: replace them.
      edit = {
        range: {
          startLineNumber: d1,
          startColumn: 1,
          endLineNumber: d2,
          endColumn: dst.getLineMaxColumn(d2),
        },
        text,
      };
    } else if (d1 < dst.getLineCount()) {
      // The other file has nothing here: insert as new lines after line d1.
      edit = {
        range: { startLineNumber: d1 + 1, startColumn: 1, endLineNumber: d1 + 1, endColumn: 1 },
        text: text + eol,
      };
    } else {
      const col = dst.getLineMaxColumn(d1); // insert after the very last line
      edit = {
        range: { startLineNumber: d1, startColumn: col, endLineNumber: d1, endColumn: col },
        text: eol + text,
      };
    }
    if (from === 'original') {
      dstPane.pushUndoStop();
      dstPane.executeEdits('copy-block', [edit]); // undoable; the normal debounced re-compare follows
      dstPane.pushUndoStop();
      setToast('Copied to Modified');
    } else {
      dst.applyEdits([edit]); // Original is read-only for typing, so edit its model and re-compare now
      setOriginalEdited(true);
      setComparing(true);
      const err = await onEditRef.current({ original: dst.getValue(), modified: liveText() });
      setComparing(false);
      setEditError(err);
      setToast('Copied to Original');
    }
  };

  // Collapse {cfg.foldNoun}: fold the root's child elements (root stays open). Expand {cfg.foldNoun}: unfold all. Both panes.
  const fold = async (mode: 'collapse' | 'expand') => {
    const ed = diffRef.current;
    if (!ed) return;
    const panes = [ed.getOriginalEditor(), ed.getModifiedEditor()] as never as FoldableEditor[];
    for (const e of panes) {
      await e.getAction(mode === 'collapse' ? 'editor.foldLevel2' : 'editor.unfoldAll')?.run();
    }
  };

  const liveText = () =>
    (diffRef.current?.getModifiedEditor() as never as ValueEditor | undefined)?.getValue() ??
    result.modified.text;

  const onModifiedChange = () => {
    const text = liveText();
    setDirty(text !== initialModified);
    clearTimeout(timer.current);
    const id = ++runId.current;
    timer.current = setTimeout(async () => {
      const problem = cfg.validate(text);
      if (problem) {
        setComparing(false);
        setEditError(problem);
        return;
      }
      setComparing(true);
      const err = await onEditRef.current({ modified: text });
      if (id !== runId.current) return; // superseded by a newer edit
      setComparing(false);
      setEditError(err);
    }, EDIT_DEBOUNCE_MS);
  };

  // Pretty-print one side. Modified goes through the editor (undoable, and the normal debounced
  // re-compare picks it up); Original is read-only, so its model is replaced and re-compared here.
  const formatSide = async (side: 'original' | 'modified') => {
    const ed = diffRef.current;
    if (!ed) return;
    const pane = (side === 'original'
      ? ed.getOriginalEditor()
      : ed.getModifiedEditor()) as never as FormatEditor;
    const model = pane.getModel();
    const src = pane.getValue();
    if (!model) return;
    const label = side === 'original' ? 'Original' : 'Modified';
    if (cfg.validate(src)) return setToast(`Can't format ${label}: the ${cfg.name} is not valid`);
    const formatted = cfg.pretty?.(src) ?? src;
    if (formatted === src) return setToast(`${label} is already formatted`);
    if (side === 'modified') {
      pane.pushUndoStop();
      pane.executeEdits('format', [{ range: model.getFullModelRange(), text: formatted }]);
      pane.pushUndoStop();
    } else {
      model.setValue(formatted);
      setComparing(true);
      const err = await onEditRef.current({ original: formatted, modified: liveText() });
      setComparing(false);
      setEditError(err);
    }
    setToast(`${label} formatted`);
  };

  const revertEdits = () =>
    (diffRef.current?.getModifiedEditor() as never as ValueEditor | undefined)?.setValue(
      initialModified,
    );

  const say = async (text: string, label: string) =>
    setToast((await copyText(text)) ? `${label} copied` : 'Copy failed — clipboard unavailable');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 1 }}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <DiffNav ids={visible.map((d) => d.id)} selectedId={selectedId} onSelect={onSelect} />
        <Button size="small" startIcon={<UnfoldLessIcon />} onClick={() => fold('collapse')}>
          Collapse {cfg.foldNoun}
        </Button>
        <Button size="small" startIcon={<UnfoldMoreIcon />} onClick={() => fold('expand')}>
          Expand {cfg.foldNoun}
        </Button>
        {cfg.pretty && (
          <>
            <Button
              size="small"
              startIcon={<FormatAlignLeftIcon />}
              onClick={() => formatSide('original')}
            >
              Format Original
            </Button>
            <Button
              size="small"
              startIcon={<FormatAlignLeftIcon />}
              onClick={() => formatSide('modified')}
            >
              Format Modified
            </Button>
          </>
        )}
        <Box sx={{ flex: 1 }} />
        {originalEdited && <Chip size="small" color="info" label="Original changed" />}
        {dirty && (
          <Chip size="small" color="warning" label={comparing ? 'Edited · comparing…' : 'Edited'} />
        )}
        {dirty && (
          <Button size="small" startIcon={<UndoIcon />} onClick={revertEdits}>
            Discard Edits
          </Button>
        )}
        <Button
          size="small"
          variant="contained"
          startIcon={<SaveIcon />}
          disabled={!dirty || !!editError}
          onClick={() => download(editedName(result.modified.filename), liveText())}
        >
          Save Edited {cfg.name}
        </Button>
        <Button
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={() => say(result.original.text, `Original ${cfg.name}`)}
        >
          Copy Original {cfg.name}
        </Button>
        <Button
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={() => say(liveText(), `Modified ${cfg.name}`)}
        >
          Copy Modified {cfg.name}
        </Button>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => download(result.original.filename, result.original.text)}
        >
          Download Original {cfg.name}
        </Button>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => download(result.modified.filename, liveText())}
        >
          Download Modified {cfg.name}
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SummarizeOutlinedIcon />}
          onClick={() =>
            download(`${cfg.id}-compare-report.html`, buildReport(result, cfg), 'text/html')
          }
        >
          Download Comparison Report
        </Button>
      </Stack>
      {editError && (
        <Alert severity="warning" sx={{ py: 0 }}>
          Edited {cfg.name} can't be compared yet:{' '}
          {editError.length > 140 ? `${editError.slice(0, 140)}…` : editError}. Showing the last
          valid comparison.
        </Alert>
      )}
      <FileTitles original={result.original.filename} modified={result.modified.filename} />
      <Paper
        variant="outlined"
        sx={{ flex: 1, minHeight: 320, overflow: 'hidden', borderRadius: 3 }}
      >
        <DiffEditor
          original={result.original.text}
          modified={initialModified}
          language={cfg.language}
          theme="xml-compare"
          onMount={(editor) => {
            diffRef.current = editor as never;
            const sides = [
              ['original', editor.getOriginalEditor()],
              ['modified', editor.getModifiedEditor()],
            ] as const;
            for (const [side, e] of sides) {
              e.updateOptions({
                folding: true,
                foldingStrategy: 'indentation',
                showFoldingControls: 'always',
                glyphMargin: true,
                stickyScroll: { enabled: false },
              });
              e.onMouseDown((ev) => {
                if (ev.target.type === GLYPH_MARGIN_TARGET && ev.target.position) {
                  void copyBlock(side, ev.target.position.lineNumber);
                }
              });
            }
            apply();
            refreshGlyphs();
            editor.getModifiedEditor().onDidChangeModelContent(() => onModifiedChange());
            editor.onDidUpdateDiff(() => {
              apply();
              refreshGlyphs();
            });
          }}
          options={{
            readOnly: false, // Modified pane is editable
            originalEditable: false, // Original stays read-only
            renderMarginRevertIcon: true,
            stickyScroll: { enabled: false }, // its overlay covers lines and skews scroll positions
            diffAlgorithm: 'advanced',
            renderSideBySide: true,
            useInlineViewWhenSpaceIsLimited: false,
            ignoreTrimWhitespace: result.options.ignore_whitespace,
            renderIndicators: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            lineNumbers: 'on',
            fontSize: 13,
            wordWrap: 'off',
            renderOverviewRuler: true,
            folding: true,
            foldingStrategy: 'indentation',
            showFoldingControls: 'always',
            hideUnchangedRegions: { enabled: false },
          }}
        />
      </Paper>
      <Snackbar
        open={!!toast}
        autoHideDuration={2000}
        onClose={() => setToast('')}
        message={toast}
      />
    </Box>
  );
}

interface EditorLike {
  createDecorationsCollection: (d: unknown[]) => unknown;
  revealLineInCenter: (n: number, scrollType?: number) => void;
}

interface LineChange {
  originalStartLineNumber: number;
  originalEndLineNumber: number; // 0 => nothing in Original (pure insertion after the start line)
  modifiedStartLineNumber: number;
  modifiedEndLineNumber: number; // 0 => nothing in Modified
}

interface BlockEditor {
  getModel: () => {
    getValueInRange: (r: unknown) => string;
    getLineMaxColumn: (n: number) => number;
    getLineCount: () => number;
    getEOL: () => string;
    getValue: () => string;
    applyEdits: (e: { range: unknown; text: string }[]) => unknown;
  } | null;
  executeEdits: (source: string, edits: { range: unknown; text: string }[]) => boolean;
  pushUndoStop: () => boolean;
}

interface FoldableEditor {
  getAction: (id: string) => { run: () => Promise<void> } | null;
}

interface FormatEditor {
  getValue: () => string;
  getModel: () => { getFullModelRange: () => unknown; setValue: (v: string) => void } | null;
  executeEdits: (source: string, edits: { range: unknown; text: string }[]) => boolean;
  pushUndoStop: () => boolean;
}

interface ValueEditor {
  getValue: () => string;
  setValue: (v: string) => void;
}
