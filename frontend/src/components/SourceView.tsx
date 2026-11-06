import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import SaveIcon from '@mui/icons-material/Save';
import SummarizeOutlinedIcon from '@mui/icons-material/SummarizeOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import { Alert, Box, Button, Chip, Paper, Snackbar, Stack } from '@mui/material';
import { DiffEditor } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import '../monaco';
import type { CompareResult, SourceDifference } from '../types';
import { checkWellFormed, copyText, download } from '../utils/format';
import { buildReport } from '../utils/report';
import DiffNav from './DiffNav';
import FileTitles from './FileTitles';

interface Props {
  result: CompareResult;
  visible: SourceDifference[]; // filtered
  selectedId: number | null;
  onSelect: (id: number) => void;
  /** Re-compare with edited Modified text; resolves to an error message or null. */
  onEdit: (text: string) => Promise<string | null>;
}

type Collection = { clear: () => void; set: (d: unknown[]) => void };

const EDIT_DEBOUNCE_MS = 600;

function editedName(name: string) {
  const i = name.lastIndexOf('.');
  return i > 0 ? `${name.slice(0, i)}-edited${name.slice(i)}` : `${name}-edited`;
}

export default function SourceView({ result, visible, selectedId, onSelect, onEdit }: Props) {
  const diffRef = useRef<{ getOriginalEditor: () => never; getModifiedEditor: () => never } | null>(
    null,
  );
  const decorations = useRef<Collection[]>([]);
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
        const sel = d.id === selectedId;
        if (d.type === 'modified' || sel) {
          decs.push({
            range: { startLineNumber: s, startColumn: 1, endLineNumber: e, endColumn: 1 },
            options: {
              isWholeLine: true,
              className: [
                d.type === 'modified' ? 'xc-line-modified' : '',
                sel ? 'xc-line-selected' : '',
              ].join(' '),
              linesDecorationsClassName: sel ? 'xc-gutter-selected' : undefined,
            },
          });
        }
      }
      const c = editor.createDecorationsCollection(decs);
      return c as Collection;
    });
    const sel = all.find((d) => d.id === selectedId);
    if (sel) {
      if (sel.modified_start != null) sides[1].editor.revealLineInCenter(sel.modified_start);
      else if (sel.original_start != null) sides[0].editor.revealLineInCenter(sel.original_start);
    }
  }, [all, selectedId]);

  useEffect(() => {
    apply();
  }, [apply]);

  // Collapse Tags: fold the root's child elements (root stays open). Expand Tags: unfold all. Both panes.
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
      const problem = checkWellFormed(text);
      if (problem) {
        setComparing(false);
        setEditError(problem);
        return;
      }
      setComparing(true);
      const err = await onEditRef.current(text);
      if (id !== runId.current) return; // superseded by a newer edit
      setComparing(false);
      setEditError(err);
    }, EDIT_DEBOUNCE_MS);
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
          Collapse Tags
        </Button>
        <Button size="small" startIcon={<UnfoldMoreIcon />} onClick={() => fold('expand')}>
          Expand Tags
        </Button>
        <Box sx={{ flex: 1 }} />
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
          Save Edited XML
        </Button>
        <Button
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={() => say(result.original.text, 'Original XML')}
        >
          Copy Original XML
        </Button>
        <Button
          size="small"
          startIcon={<ContentCopyIcon />}
          onClick={() => say(liveText(), 'Modified XML')}
        >
          Copy Modified XML
        </Button>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => download(result.original.filename, result.original.text)}
        >
          Download Original XML
        </Button>
        <Button
          size="small"
          startIcon={<DownloadIcon />}
          onClick={() => download(result.modified.filename, liveText())}
        >
          Download Modified XML
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<SummarizeOutlinedIcon />}
          onClick={() => download('xml-compare-report.html', buildReport(result), 'text/html')}
        >
          Download Comparison Report
        </Button>
      </Stack>
      {editError && (
        <Alert severity="warning" sx={{ py: 0 }}>
          Edited XML can't be compared yet:{' '}
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
          language="xml"
          theme="xml-compare"
          onMount={(editor) => {
            diffRef.current = editor as never;
            for (const e of [editor.getOriginalEditor(), editor.getModifiedEditor()]) {
              e.updateOptions({
                folding: true,
                foldingStrategy: 'indentation',
                showFoldingControls: 'always',
              });
            }
            apply();
            editor.getModifiedEditor().onDidChangeModelContent(() => onModifiedChange());
            editor.onDidUpdateDiff(() => apply());
          }}
          options={{
            readOnly: false, // Modified pane is editable
            originalEditable: false, // Original stays read-only
            renderMarginRevertIcon: true,
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
  revealLineInCenter: (n: number) => void;
}

interface FoldableEditor {
  getAction: (id: string) => { run: () => Promise<void> } | null;
}

interface ValueEditor {
  getValue: () => string;
  setValue: (v: string) => void;
}
