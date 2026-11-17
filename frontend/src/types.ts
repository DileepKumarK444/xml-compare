export type ChangeType = 'added' | 'removed' | 'modified';
export type NodeStatus = ChangeType | 'unchanged';
export type ViewMode = 'source' | 'content';
export type DiffFilter = 'all' | ChangeType;

export interface CompareOptions {
  ignore_whitespace: boolean;
  ignore_comments: boolean;
  ignore_order: boolean;
}

export interface Summary {
  total: number;
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
}

export interface SourceDifference {
  id: number;
  type: ChangeType;
  original_start: number | null;
  original_end: number | null;
  modified_start: number | null;
  modified_end: number | null;
  description: string;
  preview: string;
}

export type Attrs = Record<string, string> | null;

export interface ContentDifference {
  id: number;
  type: ChangeType;
  kind: 'element' | 'attribute' | 'text' | 'comment' | 'order';
  path: string;
  name: string;
  original_value: string | null;
  modified_value: string | null;
  original_attributes: Attrs;
  modified_attributes: Attrs;
  description: string;
  node_id: string;
}

export interface TreeNode {
  id: string;
  kind: 'element' | 'attribute' | 'comment';
  name: string;
  path: string;
  status: NodeStatus;
  original_value: string | null;
  modified_value: string | null;
  original_attributes: Attrs;
  modified_attributes: Attrs;
  difference_ids: number[];
  has_changes: boolean;
  children: TreeNode[];
}

/** A single difference as shown in the differences panel (either mode). */
export interface PanelDifference {
  id: number;
  type: ChangeType;
  path: string;
  description: string;
}

export interface DocumentInfo {
  filename: string;
  size: number;
  text: string;
}

/** What every format returns: both documents plus the line-level (source) comparison. */
export interface BaseResult {
  options: CompareOptions;
  original: DocumentInfo;
  modified: DocumentInfo;
  source: { summary: Summary; differences: SourceDifference[] };
}

export interface CompareResult extends BaseResult {
  content: { summary: Summary; differences: ContentDifference[]; tree: TreeNode };
}

export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null';

export interface JsonDifference {
  id: number;
  type: ChangeType;
  kind: 'property' | 'item' | 'value' | 'type' | 'order';
  path: string; // JSONPath-like, e.g. $.products[2].price
  name: string;
  original_value: string | null;
  modified_value: string | null;
  description: string;
  node_id: string;
}

export interface JsonNode {
  id: string;
  key: string; // property name, "[3]" for array items, "$" for the root
  path: string;
  status: NodeStatus;
  original_type: JsonType | null;
  modified_type: JsonType | null;
  original_value: string | null; // JSON text for scalars, null for containers
  modified_value: string | null;
  original_count: number | null; // property / item count for containers
  modified_count: number | null;
  difference_ids: number[];
  has_changes: boolean;
  children: JsonNode[];
}

export interface JsonCompareResult extends BaseResult {
  content: { summary: Summary; differences: JsonDifference[]; tree: JsonNode };
}

/** Plain text has only the line-level comparison. */
export interface TextCompareResult extends BaseResult {
  content: null;
}

export type AnyResult = CompareResult | JsonCompareResult | TextCompareResult;

export interface ValidationError {
  id: number;
  kind: 'syntax' | 'schema';
  line: number;
  column: number;
  message: string;
}

export interface ValidationResult {
  filename: string;
  size: number;
  text: string;
  well_formed: boolean;
  schema: { provided: boolean; filename: string | null; valid: boolean | null };
  valid: boolean;
  summary: { errors: number; syntax: number; schema: number };
  errors: ValidationError[];
  stats: {
    root: string;
    elements: number;
    attributes: number;
    max_depth: number;
    namespaces: string[];
  } | null;
}
