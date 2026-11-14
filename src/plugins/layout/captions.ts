import { visit } from 'unist-util-visit';
import { Root, Element, ElementContent, Text } from 'hast';

export interface CaptionsOptions {
  enable?: boolean;
  figures?: boolean;
  tables?: boolean;
  figLabel?: string;
  tabLabel?: string;
}

interface ResolvedCaptions {
  figures: boolean;
  tables: boolean;
  figLabel: string;
  tabLabel: string;
}

const DEFAULTS: ResolvedCaptions = {
  figures: true,
  tables: true,
  figLabel: 'Figure',
  tabLabel: 'Table',
};

function isElement(node: ElementContent | undefined): node is Element {
  return !!node && node.type === 'element';
}

function cleanCaptionText(text: string, label: string, altPrefixes: string[]): string {
  let cleaned = text.trim().replace(/\s+/g, ' ');
  if (!cleaned) return '';

  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixes = [escapedLabel, ...altPrefixes].join('|');
  const prefixRegex = new RegExp(
    `^(?:${prefixes})(?:\\s*\\d+)?\\s*(?:[:.\\-]\\s*|$)`,
    'i'
  );

  while (prefixRegex.test(cleaned)) {
    const next = cleaned.replace(prefixRegex, '').trim();
    if (next === cleaned) break;
    cleaned = next;
  }
  return cleaned;
}

function cleanNodePrefix(nodes: ElementContent[], label: string, altPrefixes: string[]): ElementContent[] {
  if (nodes.length === 0) return nodes;
  const first = nodes[0];
  if (first.type === 'text') {
    const cleaned = cleanCaptionText(first.value, label, altPrefixes);
    if (cleaned !== first.value) {
      if (!cleaned) {
        return cleanNodePrefix(nodes.slice(1), label, altPrefixes);
      }
      return [{ type: 'text', value: cleaned } as Text, ...nodes.slice(1)];
    }
  } else if (first.type === 'element' && first.children?.length) {
    const cleanedChildren = cleanNodePrefix(first.children, label, altPrefixes);
    if (cleanedChildren.length === 0) {
      return cleanNodePrefix(nodes.slice(1), label, altPrefixes);
    }
    return [{ ...first, children: cleanedChildren }, ...nodes.slice(1)];
  }
  return nodes;
}

/**
 * Check if a paragraph contains only a single image or linked image (and optional whitespace text).
 */
function getStandaloneImage(p: Element): { img: Element; link?: Element } | null {
  const nonWhitespace = p.children.filter(c => !(c.type === 'text' && !c.value.trim()));
  if (nonWhitespace.length !== 1) return null;

  const child = nonWhitespace[0];
  if (!isElement(child)) return null;

  if (child.tagName === 'img') {
    return { img: child };
  }

  // Linked image: <p><a href="..."><img ...></a></p>
  if (child.tagName === 'a') {
    const linkNonWhitespace = child.children.filter(c => !(c.type === 'text' && !c.value.trim()));
    if (linkNonWhitespace.length === 1 && isElement(linkNonWhitespace[0]) && linkNonWhitespace[0].tagName === 'img') {
      return { img: linkNonWhitespace[0], link: child };
    }
  }

  return null;
}

export default function rehypeCaptions(options?: CaptionsOptions) {
  if (!options || options.enable === false) return undefined;

  const config: ResolvedCaptions = {
    figures: options.figures ?? DEFAULTS.figures,
    tables: options.tables ?? DEFAULTS.tables,
    figLabel: options.figLabel ?? DEFAULTS.figLabel,
    tabLabel: options.tabLabel ?? DEFAULTS.tabLabel,
  };

  if (!config.figures && !config.tables) return undefined;

  return function transform(tree: Root): void {
    visit(tree, 'element', (node: Element, index, parent) => {
      if (!parent || (parent.type !== 'element' && parent.type !== 'root')) return;
      const parentNode = parent as Element;
      const pos = index ?? -1;
      if (pos < 0) return;
      if (node.tagName === 'figure' || parentNode.tagName === 'figure') return;

      // Handle standalone image paragraphs: <p><img ...></p> or <p><a ...><img ...></a></p>
      if (config.figures && node.tagName === 'p') {
        const standalone = getStandaloneImage(node);
        if (standalone) {
          const { img, link } = standalone;
          const rawAlt = (img.properties?.alt as string) || '';
          const altText = cleanCaptionText(rawAlt, config.figLabel, ['fig(?:ure)?\\.?', 'img', 'image']);

          const prefix: Element = {
            type: 'element',
            tagName: 'span',
            properties: { className: ['caption-prefix'] },
            children: [{ type: 'text', value: config.figLabel } as Text]
          };

          const captionChildren: ElementContent[] = [prefix];
          if (altText) {
            captionChildren.push({
              type: 'text',
              value: `: ${altText}`
            } as Text);
          } else {
            captionChildren.push({
              type: 'text',
              value: '.'
            } as Text);
          }

          const caption: Element = {
            type: 'element',
            tagName: 'figcaption',
            properties: { className: ['caption', 'caption-fig'] },
            children: captionChildren
          };

          const contentNode = link || img;

          const figure: Element = {
            type: 'element',
            tagName: 'figure',
            properties: { className: ['figure', 'figure-fig'] },
            children: [contentNode, caption]
          };

          Object.assign(node, figure);
          return;
        }
      }

      // Handle tables: <table>...</table>
      if (config.tables && node.tagName === 'table') {
        const siblings = parentNode.children;
        const hasFigcaption = [siblings[pos - 1], siblings[pos + 1]].some(
          c => isElement(c) && c.tagName === 'figcaption'
        );
        if (hasFigcaption) return;

        // Check if table has a native <caption> child
        let customNodes: ElementContent[] | null = null;
        const captionIndex = node.children.findIndex(c => isElement(c) && c.tagName === 'caption');
        if (captionIndex !== -1) {
          const captionEl = node.children[captionIndex] as Element;
          node.children.splice(captionIndex, 1);
          if (captionEl.children && captionEl.children.length > 0) {
            const cleaned = cleanNodePrefix(captionEl.children, config.tabLabel, ['tab(?:le)?\\.?', 'tbl']);
            if (cleaned.length > 0) {
              customNodes = cleaned;
            }
          }
        }

        const prefix: Element = {
          type: 'element',
          tagName: 'span',
          properties: { className: ['caption-prefix'] },
          children: [{ type: 'text', value: config.tabLabel } as Text]
        };

        const captionChildren: ElementContent[] = [prefix];
        if (customNodes && customNodes.length > 0) {
          captionChildren.push({ type: 'text', value: ': ' } as Text);
          captionChildren.push(...customNodes);
        } else {
          captionChildren.push({ type: 'text', value: '.' } as Text);
        }

        const caption: Element = {
          type: 'element',
          tagName: 'figcaption',
          properties: { className: ['caption', 'caption-tab'] },
          children: captionChildren
        };

        const figure: Element = {
          type: 'element',
          tagName: 'figure',
          properties: { className: ['figure', 'figure-tab'] },
          children: [caption, node]
        };

        siblings[pos] = figure;
      }
    });
  };
}
