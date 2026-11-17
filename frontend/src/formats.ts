import { createContext, useContext } from 'react';
import originalJson from './mock/original.json?raw';
import modifiedJson from './mock/modified.json?raw';
import originalText from './mock/original.txt?raw';
import originalXml from './mock/original.xml?raw';
import modifiedText from './mock/modified.txt?raw';
import modifiedXml from './mock/modified.xml?raw';
import type { CompareOptions } from './types';
import { checkWellFormed } from './utils/format';
import { formatXml } from './utils/formatXml';

export type Format = 'xml' | 'json' | 'text';

export interface OptionItem {
  key: keyof CompareOptions;
  label: string;
  tip: string;
}

/** Everything that differs between the comparison tools; the pages themselves are shared. */
export interface FormatConfig {
  id: Format;
  name: string; // "XML"
  tool: string; // "XML Compare"
  base: string; // route prefix
  ext: string; // default extension (sample file names)
  extLabel: string; // shown on the upload card
  accepts: string[]; // allowed extensions; empty = any text file
  accept: string; // <input accept=...>; empty = anything
  hasContent: boolean; // false => no structural Content view
  language: string; // Monaco language id
  contentUnit: string; // what "unchanged" counts in the Content view
  foldNoun: string; // "Tags" / "Blocks" for the fold buttons
  historyKey: string;
  validate: (text: string) => string | null; // null => valid
  pretty?: (text: string) => string; // omitted => no Format buttons
  sample: { original: string; modified: string };
  options: OptionItem[];
  help: { source: string; content: string };
}

function validateJson(text: string): string | null {
  try {
    JSON.parse(text);
    return null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid JSON';
    return msg.length > 160 ? msg.slice(0, 157) + '…' : msg;
  }
}

export const FORMATS: Record<Format, FormatConfig> = {
  xml: {
    id: 'xml',
    name: 'XML',
    tool: 'XML Compare',
    base: '/xml-compare',
    ext: '.xml',
    extLabel: '.xml',
    accepts: ['.xml'],
    accept: '.xml,application/xml,text/xml',
    hasContent: true,
    language: 'xml',
    contentUnit: 'elements',
    foldNoun: 'Tags',
    historyKey: 'xml-compare-history',
    validate: checkWellFormed,
    pretty: formatXml,
    sample: { original: originalXml, modified: modifiedXml },
    options: [
      {
        key: 'ignore_whitespace',
        label: 'Ignore insignificant whitespace',
        tip: 'Ignores indentation, line breaks and repeated spaces that only affect formatting. Whitespace inside text content is still compared as a single space.',
      },
      {
        key: 'ignore_comments',
        label: 'Ignore XML comment differences',
        tip: 'Skips <!-- comments --> in both views so that changes to comments are not reported.',
      },
      {
        key: 'ignore_order',
        label: 'Ignore element ordering',
        tip: 'Element order is significant by default. Enable this only if sibling elements may appear in any order.',
      },
    ],
    help: {
      source:
        'Compares the raw XML text line by line, exactly as written. Your files are never reformatted.',
      content:
        'Compares the parsed structure: elements, attributes, text values, namespaces and ordering, ignoring formatting-only differences.',
    },
  },
  text: {
    id: 'text',
    name: 'Text',
    tool: 'Text Compare',
    base: '/text-compare',
    ext: '.txt',
    extLabel: 'any text file (.txt, .md, .csv, .log, code…)',
    accepts: [],
    accept: '',
    hasContent: false,
    language: 'plaintext',
    contentUnit: 'lines',
    foldNoun: 'Blocks',
    historyKey: 'text-compare-history',
    validate: (t) => (t.includes('\u0000') ? 'This looks like a binary file, not text.' : null),
    sample: { original: originalText, modified: modifiedText },
    options: [
      {
        key: 'ignore_whitespace',
        label: 'Ignore whitespace differences',
        tip: 'Ignores leading/trailing spaces, repeated spaces and blank lines, so only real wording changes are reported.',
      },
    ],
    help: {
      source:
        'Compares the two files line by line, exactly as written, like a code review diff. Your files are never reformatted.',
      content: 'Plain text has no structure, so only the Source view is available.',
    },
  },
  json: {
    id: 'json',
    name: 'JSON',
    tool: 'JSON Compare',
    base: '/json-compare',
    ext: '.json',
    extLabel: '.json',
    accepts: ['.json'],
    accept: '.json,application/json',
    hasContent: true,
    language: 'json',
    contentUnit: 'values',
    foldNoun: 'Blocks',
    historyKey: 'json-compare-history',
    validate: validateJson,
    pretty: (t) => JSON.stringify(JSON.parse(t), null, 2) + '\n',
    sample: { original: originalJson, modified: modifiedJson },
    options: [
      {
        key: 'ignore_whitespace',
        label: 'Ignore insignificant whitespace',
        tip: 'Ignores indentation and line-break differences in the Source view. The Content view never sees formatting.',
      },
      {
        key: 'ignore_order',
        label: 'Ignore array item order',
        tip: 'Array order is significant by default. Enable this if items may appear in any order. Object property order is always ignored.',
      },
    ],
    help: {
      source:
        'Compares the raw JSON text line by line, exactly as written. Your files are never reformatted.',
      content:
        'Compares the parsed data: object properties, array items (matched by id/name/key where present), value types and values. Property order never matters.',
    },
  },
};

export const accepts = (cfg: FormatConfig, filename: string) =>
  cfg.accepts.length === 0 || cfg.accepts.some((e) => filename.toLowerCase().endsWith(e));

export const FormatCtx = createContext<Format>('xml');
export const useFormat = (): FormatConfig => FORMATS[useContext(FormatCtx)];
