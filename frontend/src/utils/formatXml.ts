/**
 * Pretty-print XML text without a parser round-trip, so comments, CDATA, processing
 * instructions, DOCTYPE and entity references are kept exactly as written. Whitespace-only text
 * between elements is dropped and elements are re-indented; text inside an element is only
 * trimmed. Callers should check the XML is well-formed first.
 */
const TOKEN =
  /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^>[]|\[[\s\S]*?\])*>|<\/?[^\s<>/!?]+(?:"[^"]*"|'[^']*'|[^>"'])*>|[^<]+/gi;

type FNode =
  | { kind: 'el'; open: string; close: string; selfClosing: boolean; children: FNode[] }
  | { kind: 'text'; value: string }
  | { kind: 'other'; raw: string };

const closeTag = (open: string) => `</${/^<([^\s>/]+)/.exec(open)?.[1] ?? ''}>`;

function parse(xml: string): FNode[] {
  const root: FNode[] = [];
  const stack: { children: FNode[]; el?: Extract<FNode, { kind: 'el' }> }[] = [{ children: root }];
  for (const [tok] of xml.matchAll(TOKEN)) {
    const top = stack[stack.length - 1];
    if (tok.startsWith('</')) {
      if (stack.length > 1) stack.pop();
    } else if (tok.startsWith('<') && !/^<[!?]/.test(tok)) {
      const selfClosing = tok.endsWith('/>');
      const el: Extract<FNode, { kind: 'el' }> = {
        kind: 'el',
        open: tok,
        close: selfClosing ? '' : closeTag(tok),
        selfClosing,
        children: [],
      };
      top.children.push(el);
      if (!selfClosing) stack.push({ children: el.children, el });
    } else if (tok.startsWith('<')) {
      top.children.push({ kind: 'other', raw: tok });
    } else if (tok.trim()) {
      top.children.push({ kind: 'text', value: tok.trim() });
    }
  }
  return root;
}

function write(nodes: FNode[], depth: number, indent: string, out: string[]) {
  const pad = indent.repeat(depth);
  for (const n of nodes) {
    if (n.kind === 'text') out.push(pad + n.value);
    else if (n.kind === 'other') out.push(pad + n.raw);
    else if (n.selfClosing) out.push(pad + n.open);
    else if (n.children.length === 0) out.push(pad + n.open + n.close);
    else if (n.children.length === 1 && n.children[0].kind === 'text') {
      out.push(pad + n.open + n.children[0].value + n.close); // keep leaf text inline
    } else {
      out.push(pad + n.open);
      write(n.children, depth + 1, indent, out);
      out.push(pad + n.close);
    }
  }
}

export function formatXml(xml: string, indent = '  '): string {
  const out: string[] = [];
  write(parse(xml), 0, indent, out);
  return out.join('\n') + '\n';
}
