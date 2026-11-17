// Offline Monaco setup: bundle the editor + workers locally (no CDN).
import { loader } from '@monaco-editor/react';
import * as monaco from 'monaco-editor/esm/vs/editor/edcore.main';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};

// Lightweight JSON highlighting. Monaco's built-in JSON mode pulls in an extra worker we don't need.
monaco.languages.register({ id: 'json' });
monaco.languages.setMonarchTokensProvider('json', {
  tokenizer: {
    root: [
      [/"(?:[^"\\]|\\.)*"(?=\s*:)/, 'type.identifier'],
      [/"(?:[^"\\]|\\.)*"/, 'string'],
      [/-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/, 'number'],
      [/\b(?:true|false)\b/, 'keyword'],
      [/\bnull\b/, 'comment'],
      [/[{}[\]]/, 'delimiter.bracket'],
      [/[,:]/, 'delimiter'],
    ],
  },
});

monaco.editor.defineTheme('xml-compare', {
  base: 'vs',
  inherit: true,
  rules: [],
  colors: {
    'diffEditor.insertedLineBackground': '#d5f1dd',
    'diffEditor.removedLineBackground': '#fbd9dc',
    'diffEditor.insertedTextBackground': '#8fd6a688',
    'diffEditor.removedTextBackground': '#ef8f9788',
    'diffEditor.diagonalFill': '#e6ebf2',
  },
});

loader.config({ monaco: monaco as never });
export { monaco };
