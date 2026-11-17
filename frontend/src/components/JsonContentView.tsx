import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import {
  Box,
  Button,
  Chip,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useFormat } from '../formats';
import { statusColors } from '../theme';
import type { DiffFilter, JsonCompareResult, JsonDifference, JsonNode, JsonType } from '../types';
import { download } from '../utils/format';
import { buildReport } from '../utils/report';
import { revealInContainer } from '../utils/scroll';
import DiffNav from './DiffNav';
import FileTitles from './FileTitles';

interface Props {
  result: JsonCompareResult;
  visible: JsonDifference[];
  filter: DiffFilter;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5 };
// Chrome DevTools-style JSON colours
const C = {
  key: '#881280',
  string: '#c41a16',
  number: '#1c00cf',
  boolean: '#0d22aa',
  null: '#808080',
};
const del = {
  bgcolor: '#f8c9cd',
  color: '#a4161a',
  textDecoration: 'line-through',
  borderRadius: '2px',
  px: '3px',
};
const ins = { bgcolor: '#bfe8cb', color: '#0f5f2a', borderRadius: '2px', px: '3px' };

function indexTree(root: JsonNode) {
  const parent = new Map<string, string | null>();
  const byId = new Map<string, JsonNode>();
  const walk = (n: JsonNode, p: string | null) => {
    parent.set(n.id, p);
    byId.set(n.id, n);
    n.children.forEach((c) => walk(c, n.id));
  };
  walk(root, null);
  return { parent, byId };
}

const changedExpanded = (root: JsonNode) => {
  const s = new Set<string>([root.id]);
  const walk = (n: JsonNode) => {
    if (n.has_changes && n.children.length) s.add(n.id);
    n.children.forEach(walk);
  };
  walk(root);
  return s;
};

function scalar(value: string | null, type: JsonType | null): ReactNode {
  return <span style={{ color: type ? C[type as keyof typeof C] : undefined }}>{value}</span>;
}

/** `{3}` / `[2]` for containers, or the value for scalars. */
function container(type: JsonType | null, count: number | null) {
  if (type === 'object') return `{${count ?? 0}}`;
  if (type === 'array') return `[${count ?? 0}]`;
  return '';
}

function Value({ n, moved }: { n: JsonNode; moved: boolean }) {
  const oType = n.original_type;
  const mType = n.modified_type;
  const isContainer = (t: JsonType | null) => t === 'object' || t === 'array';
  const show = (side: 'original' | 'modified') => {
    const t = side === 'original' ? oType : mType;
    const v = side === 'original' ? n.original_value : n.modified_value;
    const c = side === 'original' ? n.original_count : n.modified_count;
    return isContainer(t) ? container(t, c) : scalar(v, t);
  };
  let body: ReactNode;
  if (n.status === 'added')
    body = (
      <Box component="span" sx={ins}>
        {show('modified')}
      </Box>
    );
  else if (n.status === 'removed')
    body = (
      <Box component="span" sx={del}>
        {show('original')}
      </Box>
    );
  else if (
    n.status === 'modified' &&
    oType &&
    mType &&
    (oType !== mType || (!isContainer(oType) && n.original_value !== n.modified_value))
  ) {
    body = (
      <>
        <Box component="span" sx={del}>
          {show('original')}
        </Box>{' '}
        <Box component="span" sx={ins}>
          {show('modified')}
        </Box>
        {oType !== mType && (
          <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
            {oType} → {mType}
          </Typography>
        )}
      </>
    );
  } else if (isContainer(mType)) {
    const changedCount = n.original_count !== n.modified_count;
    body = (
      <span style={{ color: '#808080' }}>
        {changedCount ? `${container(oType, n.original_count)} → ` : ''}
        {container(mType, n.modified_count)}
      </span>
    );
  } else body = show('modified');
  return (
    <>
      {body}
      {moved && (
        <Chip size="small" label="moved" color="warning" sx={{ ml: 1, height: 18, fontSize: 11 }} />
      )}
    </>
  );
}

interface RowProps {
  node: JsonNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  isVisible: Map<string, boolean>;
  focusId: string | null;
  movedIds: Set<string>;
  onClick: (n: JsonNode) => void;
}

function Row({ node, depth, expanded, toggle, isVisible, focusId, movedIds, onClick }: RowProps) {
  if (!isVisible.get(node.id)) return null;
  const open = expanded.has(node.id);
  const hasKids = node.children.length > 0;
  // A container that merely holds changes stays plain; its changed children carry the colour.
  const holdsChanges = node.status === 'modified' && hasKids;
  const tint = node.status === 'unchanged' ? null : statusColors[node.status];
  const fill = holdsChanges ? null : tint;
  return (
    <Box role="treeitem" aria-expanded={hasKids ? open : undefined}>
      <Box
        id={`node-${node.id}`}
        onClick={() => onClick(node)}
        sx={{
          ...mono,
          display: 'flex',
          alignItems: 'baseline',
          pl: `${depth * 18 + 8}px`,
          pr: 1,
          py: '1px',
          cursor: 'pointer',
          bgcolor: fill ? fill.bg : 'transparent',
          borderLeft: `3px solid ${tint ? tint.main : 'transparent'}`,
          outline: focusId === node.id ? '2px solid #1565c0' : 'none',
          outlineOffset: '-2px',
          '&:hover': { bgcolor: fill ? fill.line : 'action.hover' },
        }}
      >
        <Box
          component="span"
          onClick={(e) => {
            if (!hasKids) return;
            e.stopPropagation();
            toggle(node.id);
          }}
          sx={{ width: 18, flex: '0 0 18px', alignSelf: 'center', display: 'inline-flex' }}
        >
          {hasKids ? (
            open ? (
              <ExpandMoreIcon sx={{ fontSize: 16 }} />
            ) : (
              <ChevronRightIcon sx={{ fontSize: 16 }} />
            )
          ) : null}
        </Box>
        <span style={{ color: C.key }}>{node.key}</span>
        <span>:&nbsp;</span>
        <Box component="span" sx={{ wordBreak: 'break-word' }}>
          <Value n={node} moved={movedIds.has(node.id)} />
        </Box>
      </Box>
      {hasKids && open && (
        <Box role="group">
          {node.children.map((c) => (
            <Row
              key={c.id}
              node={c}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              isVisible={isVisible}
              focusId={focusId}
              movedIds={movedIds}
              onClick={onClick}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

export default function JsonContentView({ result, visible, filter, selectedId, onSelect }: Props) {
  const cfg = useFormat();
  const tree = result.content.tree;
  const diffs = result.content.differences;
  const { parent, byId } = useMemo(() => indexTree(tree), [tree]);
  const movedIds = useMemo(
    () => new Set(diffs.filter((d) => d.kind === 'order').map((d) => d.node_id)),
    [diffs],
  );
  const [expanded, setExpanded] = useState<Set<string>>(() => changedExpanded(tree));
  const [showUnchanged, setShowUnchanged] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);

  // A difference selected anywhere (panel, prev/next) focuses and reveals its node.
  const [lastSelected, setLastSelected] = useState<number | null>(null);
  if (selectedId !== lastSelected) {
    setLastSelected(selectedId);
    const d = selectedId == null ? undefined : diffs.find((x) => x.id === selectedId);
    if (d) {
      setFocusId(d.node_id);
      const next = new Set(expanded);
      for (let p = parent.get(d.node_id) ?? null; p; p = parent.get(p) ?? null) next.add(p);
      setExpanded(next);
    }
  }
  useEffect(() => {
    const d = selectedId == null ? undefined : diffs.find((x) => x.id === selectedId);
    if (d) revealInContainer(document.getElementById(`node-${d.node_id}`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const isVisible = useMemo(() => {
    const memo = new Map<string, boolean>();
    const calc = (n: JsonNode): boolean => {
      const own =
        showUnchanged || (filter === 'all' ? n.status !== 'unchanged' : n.status === filter);
      const kids = n.children.map(calc);
      const v = own || kids.some(Boolean);
      memo.set(n.id, v);
      return v;
    };
    calc(tree);
    return memo;
  }, [tree, filter, showUnchanged]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const click = (n: JsonNode) => {
    setFocusId(n.id);
    onSelect(n.difference_ids[0] ?? null);
  };
  const focused = focusId ? byId.get(focusId) : null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, gap: 1 }}>
      <Stack direction="row" sx={{ flexWrap: 'wrap', alignItems: 'center', gap: 1 }}>
        <DiffNav ids={visible.map((d) => d.id)} selectedId={selectedId} onSelect={onSelect} />
        <Box sx={{ flex: 1 }} />
        <FormControlLabel
          control={
            <Switch
              size="small"
              checked={showUnchanged}
              onChange={(e) => setShowUnchanged(e.target.checked)}
            />
          }
          label="Show unchanged values"
        />
        <Button size="small" onClick={() => setExpanded(changedExpanded(tree))}>
          Expand changed
        </Button>
        <Button size="small" onClick={() => setExpanded(new Set(byId.keys()))}>
          Expand all
        </Button>
        <Button size="small" onClick={() => setExpanded(new Set([tree.id]))}>
          Collapse all
        </Button>
        <Button
          size="small"
          variant="outlined"
          startIcon={<DownloadIcon />}
          onClick={() =>
            download('json-compare-report.html', buildReport(result, cfg), 'text/html')
          }
        >
          Download Comparison Report
        </Button>
      </Stack>
      <FileTitles original={result.original.filename} modified={result.modified.filename} />
      <Paper
        variant="outlined"
        sx={{ flex: 1, minHeight: 320, overflow: 'auto', borderRadius: 3, py: 1 }}
        role="tree"
        aria-label="JSON tree"
      >
        {isVisible.get(tree.id) ? (
          <Row
            node={tree}
            depth={0}
            expanded={expanded}
            toggle={toggle}
            isVisible={isVisible}
            focusId={focusId}
            movedIds={movedIds}
            onClick={click}
          />
        ) : (
          <Typography color="text.secondary" sx={{ p: 2 }}>
            No matching values.
          </Typography>
        )}
      </Paper>
      {focused && focused.difference_ids.length > 0 && (
        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 3 }}>
          <Typography variant="caption" color="text.secondary">
            <code>{focused.path}</code>
          </Typography>
          {diffs
            .filter((d) => d.node_id === focused.id)
            .map((d) => (
              <Typography key={d.id} variant="body2">
                {d.description}
              </Typography>
            ))}
        </Paper>
      )}
    </Box>
  );
}
