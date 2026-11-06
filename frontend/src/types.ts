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

export interface CompareResult {
  options: CompareOptions;
  original: DocumentInfo;
  modified: DocumentInfo;
  source: { summary: Summary; differences: SourceDifference[] };
  content: { summary: Summary; differences: ContentDifference[]; tree: TreeNode };
}
