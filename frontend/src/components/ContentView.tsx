import DownloadIcon from '@mui/icons-material/Download';
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
import { statusColors } from '../theme';
import type { Attrs, CompareResult, ContentDifference, DiffFilter, TreeNode } from '../types';
import { download } from '../utils/format';
import { buildReport } from '../utils/report';
import DiffNav from './DiffNav';
import FileTitles from './FileTitles';

interface Props {
  result: CompareResult;
  visible: ContentDifference[];
  filter: DiffFilter;
  selectedId: number | null;
  onSelect: (id: number | null) => void;
}

const mono = { fontFamily: 'ui-monospace, Menlo, Consolas, monospace', fontSize: 12.5 };

function indexTree(root: TreeNode) {
  const parent = new Map<string, string | null>();
  const byId = new Map<string, TreeNode>();
  const walk = (n: TreeNode, p: string | null) => {
    parent.set(n.id, p);
    byId.set(n.id, n);
    n.children.forEach((c) => walk(c, n.id));
  };
  walk(root, null);
  return { parent, byId };
}

const changedExpanded = (root: TreeNode) => {
  const s = new Set<string>();
  const walk = (n: TreeNode) => {
    if (n.has_changes && n.children.length) s.add(n.id);
    n.children.forEach(walk);
  };
  walk(root);
  s.add(root.id);
  return s;
};

export default function ContentView({ result, visible, filter, selectedId, onSelect }: Props) {
  const tree = result.content.tree;
  const { parent, byId } = useMemo(() => indexTree(tree), [tree]);
  const diffs = result.content.differences;
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
    if (d) {
      const n = byId.get(d.node_id);
      const rowId = n?.kind === 'attribute' ? parent.get(d.node_id) : d.node_id;
      document.getElementById(`node-${rowId}`)?.scrollIntoView({ block: 'nearest' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const matchesFilter = (n: TreeNode) =>
    filter === 'all' ? n.status !== 'unchanged' : n.status === filter;
  const isVisible = useMemo(() => {
    const memo = new Map<string, boolean>();
    const calc = (n: TreeNode): boolean => {
      const own = showUnchanged || matchesFilter(n);
      const kids = n.children.map(calc);
      const v = own || kids.some(Boolean);
      memo.set(n.id, v);
      return v;
    };
    calc(tree);
    return memo;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tree, filter, showUnchanged]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const focused = focusId ? (byId.get(focusId) ?? null) : null;
  const focusedDiffs = focused ? diffs.filter((d) => d.node_id === focused.id) : [];

  const click = (n: TreeNode) => {
    setFocusId(n.id);
    onSelect(n.difference_ids[0] ?? null);
  };

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
          label="Show unchanged elements"
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
          onClick={() => download('xml-compare-report.html', buildReport(result), 'text/html')}
        >
          Download Comparison Report
        </Button>
      </Stack>

      <FileTitles original={result.original.filename} modified={result.modified.filename} />
      <Box
        sx={{
          flex: 1,
          minHeight: 320,
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', lg: '3fr 2fr' },
          gridTemplateRows: { xs: 'minmax(260px, 1fr) auto', lg: 'minmax(0, 1fr)' },
        }}
      >
        <Paper
          variant="outlined"
          sx={{ overflow: 'auto', borderRadius: 3, py: 1 }}
          role="tree"
          aria-label="XML tree"
        >
          {isVisible.get(tree.id) ? (
            tree.children.map((c) => (
              <TreeRow
                key={c.id}
                node={c}
                depth={0}
                expanded={expanded}
                toggle={toggle}
                isVisible={isVisible}
                focusId={focusId}
                onClick={click}
              />
            ))
          ) : (
            <Typography color="text.secondary" sx={{ p: 2 }}>
              No matching elements.
            </Typography>
          )}
        </Paper>
        <Inspector node={focused} diffs={focusedDiffs} />
      </Box>
    </Box>
  );
}

// Chrome XML-viewer palette
const C = { tag: '#881280', attr: '#994500', val: '#1a1aa6', comment: '#236e25', text: '#202124' };
const del = {
  bgcolor: '#f8c9cd',
  color: '#a4161a',
  textDecoration: 'line-through',
  borderRadius: '2px',
  px: '2px',
};
const ins = { bgcolor: '#bfe8cb', color: '#0f5f2a', borderRadius: '2px', px: '2px' };

function Attrs({
  node,
  attrNodes,
  focusId,
  onClick,
}: {
  node: TreeNode;
  attrNodes: TreeNode[];
  focusId: string | null;
  onClick: (n: TreeNode) => void;
}) {
  const o = node.original_attributes ?? {};
  const m = node.modified_attributes ?? {};
  const keys = [...Object.keys(m), ...Object.keys(o).filter((k) => !(k in m))];
  return (
    <>
      {keys.map((k) => {
        const an = attrNodes.find((x) => x.name === `@${k}`);
        const ov = o[k],
          mv = m[k];
        const hasO = k in o,
          hasM = k in m;
        let value: ReactNode = <span style={{ color: C.val }}>{mv ?? ov}</span>;
        let box = {};
        if (hasO && hasM && ov !== mv) {
          value = (
            <>
              <Box component="span" sx={del}>
                {ov}
              </Box>{' '}
              <Box component="span" sx={ins}>
                {mv}
              </Box>
            </>
          );
        } else if (!hasO && hasM && node.status !== 'added') box = ins;
        else if (hasO && !hasM && node.status !== 'removed') box = del;
        return (
          <Box
            key={k}
            component="span"
            onClick={
              an
                ? (e) => {
                    e.stopPropagation();
                    onClick(an);
                  }
                : undefined
            }
            sx={{
              ml: '6px',
              ...box,
              outline: an && focusId === an.id ? '2px solid #1565c0' : 'none',
              cursor: an ? 'pointer' : 'inherit',
            }}
          >
            <span style={{ color: C.attr }}>{k}</span>
            <span style={{ color: C.text }}>="</span>
            {value}
            <span style={{ color: C.text }}>"</span>
          </Box>
        );
      })}
    </>
  );
}

function TextValue({ node }: { node: TreeNode }) {
  const o = node.original_value,
    m = node.modified_value;
  if (node.status === 'modified' && o !== m && (o || m)) {
    return (
      <>
        {o && (
          <Box component="span" sx={del}>
            {o}
          </Box>
        )}
        {o && m && ' '}
        {m && (
          <Box component="span" sx={ins}>
            {m}
          </Box>
        )}
      </>
    );
  }
  return <span style={{ color: C.text }}>{m ?? o}</span>;
}

function TreeRow({
  node,
  depth,
  expanded,
  toggle,
  isVisible,
  focusId,
  onClick,
}: {
  node: TreeNode;
  depth: number;
  expanded: Set<string>;
  toggle: (id: string) => void;
  isVisible: Map<string, boolean>;
  focusId: string | null;
  onClick: (n: TreeNode) => void;
}) {
  if (node.kind === 'attribute' || !isVisible.get(node.id)) return null;
  const c = statusColors[node.status];
  const attrNodes = node.children.filter((x) => x.kind === 'attribute');
  const kids = node.children.filter((x) => x.kind !== 'attribute');
  const open = expanded.has(node.id);
  const hasKids = kids.length > 0;
  const hasText = !!(node.original_value || node.modified_value);
  const focused = focusId === node.id || attrNodes.some((x) => x.id === focusId);
  const changed = node.status !== 'unchanged';

  const rowSx = (n: TreeNode, f: boolean) => ({
    display: 'flex',
    alignItems: 'baseline',
    pl: `${12 + depth * 20}px`,
    pr: 1,
    py: '1px',
    cursor: 'pointer',
    borderLeft: 4,
    borderColor: n.status === 'unchanged' ? 'transparent' : statusColors[n.status].main,
    bgcolor: n.status === 'unchanged' ? 'transparent' : statusColors[n.status].bg,
    outline: f
      ? `2px solid ${n.status === 'unchanged' ? '#1565c0' : statusColors[n.status].main}`
      : 'none',
    outlineOffset: -2,
    ...mono,
    fontSize: 13,
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  });
  const toggler = (
    <Box
      component="span"
      onClick={(e) => {
        if (hasKids) {
          e.stopPropagation();
          toggle(node.id);
        }
      }}
      sx={{
        width: 16,
        flex: '0 0 16px',
        color: '#5f6368',
        fontSize: 10,
        userSelect: 'none',
        visibility: hasKids ? 'visible' : 'hidden',
      }}
    >
      {open ? '▼' : '▶'}
    </Box>
  );
  const badge = changed && (
    <Chip
      size="small"
      label={c.label}
      sx={{
        ml: 1,
        height: 16,
        fontSize: 10,
        bgcolor: '#fff',
        color: c.main,
        border: `1px solid ${c.main}`,
      }}
    />
  );

  if (node.kind === 'comment') {
    return (
      <Box
        id={`node-${node.id}`}
        role="treeitem"
        aria-selected={focused}
        onClick={() => onClick(node)}
        sx={rowSx(node, focused)}
      >
        {toggler}
        <span style={{ color: C.comment }}>
          {'<!-- '}
          <TextValue node={node} />
          {' -->'}
        </span>
        {badge}
      </Box>
    );
  }

  const open_ = (selfClose: boolean) => (
    <>
      <span style={{ color: C.tag }}>{'<' + node.name}</span>
      <Attrs node={node} attrNodes={attrNodes} focusId={focusId} onClick={onClick} />
      <span style={{ color: C.tag }}>{selfClose ? '/>' : '>'}</span>
    </>
  );
  const close = <span style={{ color: C.tag }}>{`</${node.name}>`}</span>;

  // One line: leaf (self-closing / text) or collapsed element.
  const oneLine = !hasKids || !open;
  return (
    <>
      <Box
        id={`node-${node.id}`}
        role="treeitem"
        aria-expanded={hasKids ? open : undefined}
        aria-selected={focused}
        onClick={() => onClick(node)}
        sx={rowSx(node, focused)}
      >
        {toggler}
        <Box component="span" sx={{ minWidth: 0 }}>
          {oneLine && !hasKids && !hasText ? (
            open_(true)
          ) : oneLine ? (
            <>
              {open_(false)}
              {hasKids ? <span style={{ color: '#5f6368' }}>…</span> : <TextValue node={node} />}
              {close}
            </>
          ) : (
            <>
              {open_(false)}
              {hasText && (
                <>
                  {' '}
                  <TextValue node={node} />
                </>
              )}
            </>
          )}
          {badge}
        </Box>
      </Box>
      {hasKids && open && (
        <>
          {kids.map((ch) => (
            <TreeRow
              key={ch.id}
              node={ch}
              depth={depth + 1}
              expanded={expanded}
              toggle={toggle}
              isVisible={isVisible}
              focusId={focusId}
              onClick={onClick}
            />
          ))}
          <Box
            onClick={() => onClick(node)}
            sx={{ ...rowSx(node, false), cursor: 'pointer', outline: 'none' }}
          >
            <Box component="span" sx={{ width: 16, flex: '0 0 16px' }} />
            {close}
          </Box>
        </>
      )}
    </>
  );
}

function AttrList({ attrs, other }: { attrs: Attrs; other: Attrs }) {
  if (!attrs || !Object.keys(attrs).length)
    return (
      <Typography variant="body2" color="text.secondary">
        None
      </Typography>
    );
  return (
    <Box>
      {Object.entries(attrs).map(([k, v]) => {
        const changed = other == null || other[k] !== v;
        return (
          <Typography
            key={k}
            sx={{
              ...mono,
              bgcolor: changed ? statusColors.modified.bg : 'transparent',
              px: 0.5,
              borderRadius: 0.5,
            }}
          >
            {k}="{v}"
          </Typography>
        );
      })}
    </Box>
  );
}

function ValueBox({ title, value, color }: { title: string; value: string | null; color: string }) {
  return (
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="caption" color="text.secondary">
        {title}
      </Typography>
      <Box
        sx={{
          ...mono,
          p: 1,
          borderRadius: 1.5,
          border: 1,
          borderColor: 'divider',
          bgcolor: value == null ? 'transparent' : color,
          minHeight: 34,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {value == null ? (
          <Typography variant="body2" color="text.disabled">
            —
          </Typography>
        ) : (
          value
        )}
      </Box>
    </Box>
  );
}

function Inspector({ node, diffs }: { node: TreeNode | null; diffs: ContentDifference[] }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, overflow: 'auto', borderRadius: 3 }}
      aria-label="Difference details"
    >
      <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
        Details
      </Typography>
      {!node ? (
        <Typography color="text.secondary">
          Select an element or a difference to inspect it.
        </Typography>
      ) : (
        <Stack spacing={1.5}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              XML Path
            </Typography>
            <Typography sx={{ ...mono, wordBreak: 'break-all' }} data-testid="inspector-path">
              {node.path}
            </Typography>
          </Box>
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Element
              </Typography>
              <Typography sx={mono}>{node.name}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                Change
              </Typography>
              <br />
              <Chip
                size="small"
                label={statusColors[node.status].label}
                sx={{
                  bgcolor: statusColors[node.status].bg,
                  color: statusColors[node.status].main,
                  fontWeight: 600,
                }}
              />
            </Box>
          </Stack>
          {diffs.map((d) => (
            <Typography key={d.id} variant="body2" color="text.secondary">
              • {d.description}
            </Typography>
          ))}
          <Stack direction="row" spacing={1}>
            <ValueBox
              title="Original value"
              value={node.original_value}
              color={statusColors.removed.bg}
            />
            <ValueBox
              title="Modified value"
              value={node.modified_value}
              color={statusColors.added.bg}
            />
          </Stack>
          {node.kind === 'element' && (
            <Stack direction="row" spacing={1}>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  Original attributes
                </Typography>
                <AttrList attrs={node.original_attributes} other={node.modified_attributes} />
              </Box>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  Modified attributes
                </Typography>
                <AttrList attrs={node.modified_attributes} other={node.original_attributes} />
              </Box>
            </Stack>
          )}
        </Stack>
      )}
    </Paper>
  );
}
