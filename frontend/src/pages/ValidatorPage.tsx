import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import ErrorIcon from '@mui/icons-material/Error';
import FormatAlignLeftIcon from '@mui/icons-material/FormatAlignLeft';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RuleIcon from '@mui/icons-material/Rule';
import {
  Alert,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Container,
  Paper,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { Editor } from '@monaco-editor/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { validateXml } from '../api/validate';
import AppHeader from '../components/AppHeader';
import UploadCard from '../components/UploadCard';
import { FORMATS } from '../formats';
import '../monaco';
import type { ValidationError, ValidationResult } from '../types';
import { copyText, download } from '../utils/format';
import { revealInContainer } from '../utils/scroll';
import type { SelectedFile } from '../state/AppState';

const MAX_BYTES = 20 * 1024 * 1024;
const DEBOUNCE_MS = 600;
const xml = FORMATS.xml;
const XSD = { name: 'XSD', accept: '.xsd,.xml,application/xml,text/xml', extLabel: '.xsd' };

const ABOUT = {
  title: 'About XML Validator',
  paragraphs: [
    'XML Validator runs entirely on this machine. The file is checked in memory and is never stored or sent to the internet.',
    'It reports every well-formedness error with its line and column. Add an XSD schema to also check the structure and data types. The XSD must be a single self-contained file (no include/import of other files).',
    'You can fix errors right in the editor: the file is re-checked as you type, and you can download the corrected version.',
  ],
};

async function read(file: File, exts: string[]): Promise<SelectedFile> {
  let error: string | null = null;
  let text = '';
  if (!exts.some((e) => file.name.toLowerCase().endsWith(e)))
    error = `Only ${exts.join(' or ')} files are accepted.`;
  else if (file.size === 0) error = 'File is empty.';
  else if (file.size > MAX_BYTES) error = 'File is larger than 20 MB.';
  else text = await file.text();
  return { file, text, error }; // an XML file is never rejected for being malformed: that is the point
}

type MonacoEditor = {
  getValue: () => string;
  setValue: (v: string) => void;
  getModel: () => { getLineMaxColumn: (n: number) => number } | null;
  revealLineInCenter: (n: number, t?: number) => void;
  setPosition: (p: { lineNumber: number; column: number }) => void;
  focus: () => void;
};
type MonacoApi = {
  editor: { setModelMarkers: (m: unknown, owner: string, markers: unknown[]) => void };
  MarkerSeverity: { Error: number };
};

export default function ValidatorPage() {
  const [xmlFile, setXmlFile] = useState<SelectedFile | null>(null);
  const [xsdFile, setXsdFile] = useState<SelectedFile | null>(null);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [seed, setSeed] = useState('');
  const [runKey, setRunKey] = useState(0); // remounts the editor for each newly validated file
  const [loading, setLoading] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const [edited, setEdited] = useState(false);
  const [toast, setToast] = useState('');

  const editor = useRef<MonacoEditor | null>(null);
  const monaco = useRef<MonacoApi | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const runId = useRef(0);
  const xsdRef = useRef<SelectedFile | null>(null);
  const nameRef = useRef('document.xml');
  useEffect(() => {
    xsdRef.current = xsdFile;
  }, [xsdFile]);
  useEffect(() => () => clearTimeout(timer.current), []);

  const ready = !!xmlFile && !xmlFile.error && (!xsdFile || !xsdFile.error);

  const mark = useCallback((errors: ValidationError[]) => {
    const ed = editor.current;
    const m = monaco.current;
    const model = ed?.getModel();
    if (!ed || !m || !model) return;
    m.editor.setModelMarkers(
      model,
      'xml-validator',
      errors.map((e) => ({
        severity: m.MarkerSeverity.Error,
        message: e.message,
        startLineNumber: e.line,
        startColumn: e.column,
        endLineNumber: e.line,
        endColumn: Math.max(model.getLineMaxColumn(e.line), e.column + 1),
      })),
    );
  }, []);
  useEffect(() => {
    if (result) mark(result.errors);
  }, [result, mark]);

  const run = async () => {
    if (!xmlFile || !ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await validateXml(xmlFile.file, xsdFile?.file);
      nameRef.current = xmlFile.file.name;
      setSeed(res.text);
      setResult(res);
      setSelected(null);
      setEdited(false);
      setRunKey((k) => k + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Validation failed.');
    } finally {
      setLoading(false);
    }
  };

  // Re-validate shortly after the user stops typing in the editor.
  const onEdit = () => {
    setEdited(true);
    clearTimeout(timer.current);
    const id = ++runId.current;
    timer.current = setTimeout(async () => {
      const text = editor.current?.getValue() ?? '';
      if (!text.trim()) return;
      setRechecking(true);
      try {
        const res = await validateXml(
          new File([text], nameRef.current, { type: 'application/xml' }),
          xsdRef.current?.file,
        );
        if (id === runId.current) {
          setResult(res);
          setError(null);
        }
      } catch (e) {
        if (id === runId.current) setError(e instanceof Error ? e.message : 'Validation failed.');
      } finally {
        if (id === runId.current) setRechecking(false);
      }
    }, DEBOUNCE_MS);
  };

  const jump = (e: ValidationError) => {
    setSelected(e.id);
    const ed = editor.current;
    if (!ed) return;
    ed.revealLineInCenter(e.line, 1);
    ed.setPosition({ lineNumber: e.line, column: e.column });
    ed.focus();
  };

  const reset = () => {
    setXmlFile(null);
    setXsdFile(null);
    setResult(null);
    setError(null);
    setEdited(false);
  };

  const formatDoc = () => {
    const ed = editor.current;
    if (!ed) return;
    if (!result?.well_formed) return setToast("Can't format until the XML is well-formed");
    const next = xml.pretty!(ed.getValue());
    if (next === ed.getValue()) return setToast('Already formatted');
    ed.setValue(next);
  };

  const stats = result?.stats;
  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppHeader title="XML Validator" about={ABOUT} />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          Validate an XML file
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          1. Upload the XML file &nbsp;›&nbsp; 2. Optionally add an XSD schema &nbsp;›&nbsp; 3.
          Validate and fix the errors. Everything stays on this computer.
        </Typography>

        <Grid container spacing={3} sx={{ mb: 2 }}>
          <Grid size={{ xs: 12, md: 6 }}>
            <UploadCard
              title="XML file"
              description="The document to check."
              value={xmlFile}
              onFile={async (f) => {
                setXmlFile(await read(f, ['.xml']));
                setError(null);
              }}
              onRemove={() => setXmlFile(null)}
              kind={{ name: 'XML', accept: xml.accept, extLabel: '.xml' }}
            />
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <UploadCard
              title="XSD schema (optional)"
              description="Also check structure and data types."
              value={xsdFile}
              onFile={async (f) => {
                setXsdFile(await read(f, ['.xsd', '.xml']));
                setError(null);
              }}
              onRemove={() => setXsdFile(null)}
              kind={XSD}
            />
          </Grid>
        </Grid>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
          <Button
            variant="contained"
            size="large"
            disabled={!ready || loading}
            onClick={run}
            startIcon={loading ? <CircularProgress size={18} color="inherit" /> : <RuleIcon />}
          >
            {loading ? 'Validating…' : 'Validate XML'}
          </Button>
          <Button
            variant="outlined"
            size="large"
            startIcon={<RestartAltIcon />}
            onClick={reset}
            disabled={loading}
          >
            Reset
          </Button>
        </Stack>

        {result && (
          <Box>
            <Alert
              severity={result.valid ? 'success' : 'error'}
              icon={result.valid ? <CheckCircleIcon /> : <ErrorIcon />}
              sx={{ mb: 2, alignItems: 'center' }}
            >
              <b>
                {result.valid
                  ? result.schema.provided
                    ? 'Valid: well-formed and matches the schema.'
                    : 'Valid: the XML is well-formed.'
                  : `${result.summary.errors} error${result.summary.errors === 1 ? '' : 's'} found.`}
              </b>{' '}
              {!result.well_formed &&
                'Fix the syntax errors first; schema checks run once it is well-formed.'}
              {rechecking && ' Re-checking…'}
            </Alert>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mb: 2 }}>
              <Chip
                label={`${result.summary.syntax} syntax`}
                color={result.summary.syntax ? 'error' : 'default'}
              />
              {result.schema.provided && (
                <Chip
                  label={`${result.summary.schema} schema`}
                  color={result.summary.schema ? 'error' : 'default'}
                />
              )}
              {stats && (
                <>
                  <Chip variant="outlined" label={`root <${stats.root}>`} />
                  <Chip variant="outlined" label={`${stats.elements} elements`} />
                  <Chip variant="outlined" label={`${stats.attributes} attributes`} />
                  <Chip variant="outlined" label={`depth ${stats.max_depth}`} />
                  {stats.namespaces.map((n) => (
                    <Chip key={n} variant="outlined" label={`ns ${n}`} />
                  ))}
                </>
              )}
            </Stack>

            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', alignItems: 'center', mb: 1 }}>
              <Typography sx={{ fontWeight: 600, flex: 1 }}>
                {result.filename}
                {edited && <Chip size="small" color="warning" label="Edited" sx={{ ml: 1 }} />}
              </Typography>
              <Button size="small" startIcon={<FormatAlignLeftIcon />} onClick={formatDoc}>
                Format
              </Button>
              <Button
                size="small"
                startIcon={<ContentCopyIcon />}
                onClick={async () =>
                  setToast(
                    (await copyText(editor.current?.getValue() ?? ''))
                      ? 'XML copied'
                      : 'Copy failed',
                  )
                }
              >
                Copy
              </Button>
              <Button
                size="small"
                variant={edited ? 'contained' : 'text'}
                startIcon={<DownloadIcon />}
                onClick={() => download(nameRef.current, editor.current?.getValue() ?? '')}
              >
                {edited ? 'Download corrected XML' : 'Download XML'}
              </Button>
            </Stack>

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 8 }}>
                <Paper variant="outlined" sx={{ height: 520, overflow: 'hidden', borderRadius: 3 }}>
                  <Editor
                    key={runKey}
                    defaultValue={seed}
                    language="xml"
                    theme="xml-compare"
                    onMount={(ed, m) => {
                      editor.current = ed as never;
                      monaco.current = m as never;
                      mark(result.errors);
                    }}
                    onChange={onEdit}
                    options={{
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      fontSize: 13,
                      glyphMargin: true,
                      folding: true,
                      stickyScroll: { enabled: false },
                    }}
                  />
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Card
                  variant="outlined"
                  sx={{ height: 520, borderRadius: 3, overflow: 'auto', p: 0 }}
                >
                  <Typography sx={{ p: 1.5, fontWeight: 600 }}>
                    Errors ({result.errors.length})
                  </Typography>
                  {result.errors.length === 0 && (
                    <Typography color="text.secondary" sx={{ px: 1.5, pb: 1.5 }}>
                      Nothing to fix.
                    </Typography>
                  )}
                  {result.errors.map((e) => (
                    <ErrorRow
                      key={e.id}
                      e={e}
                      selected={selected === e.id}
                      onClick={() => jump(e)}
                    />
                  ))}
                </Card>
              </Grid>
            </Grid>
          </Box>
        )}
      </Container>
      <Snackbar
        open={!!toast}
        autoHideDuration={2000}
        onClose={() => setToast('')}
        message={toast}
      />
    </Box>
  );
}

function ErrorRow({
  e,
  selected,
  onClick,
}: {
  e: ValidationError;
  selected: boolean;
  onClick: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) revealInContainer(ref.current);
  }, [selected]);
  return (
    <Box
      ref={ref}
      onClick={onClick}
      sx={{
        px: 1.5,
        py: 1,
        cursor: 'pointer',
        borderTop: 1,
        borderColor: 'divider',
        borderLeft: 3,
        borderLeftColor: selected ? 'error.main' : 'transparent',
        bgcolor: selected ? 'rgba(198,40,40,0.06)' : 'transparent',
        '&:hover': { bgcolor: 'action.hover' },
      }}
    >
      <Stack direction="row" sx={{ gap: 1, alignItems: 'center', mb: 0.25 }}>
        <Chip
          size="small"
          color={e.kind === 'syntax' ? 'error' : 'warning'}
          label={e.kind}
          sx={{ height: 20 }}
        />
        <Typography variant="caption" color="text.secondary">
          Line {e.line}, column {e.column}
        </Typography>
      </Stack>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
        {e.message}
      </Typography>
    </Box>
  );
}
