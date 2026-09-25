import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  LevelFormat,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Tab,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ParagraphChild,
} from 'docx';
import type { List, PhrasingContent, Root, RootContent, Table as MarkdownTable } from 'mdast';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

export interface DocxInput {
  title: string;
  /** One line under the title: document type, client, project, version, date. */
  subtitle: string;
  markdown: string;
}

const FONT = 'Calibri';
const MONO = 'Consolas';
const INK = '0B3954';
const MUTED = '5F6B7A';
const CODE_FILL = 'F1F3F5';
const HEADER_FILL = 'E7EEF5';
const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

interface Marks {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  link?: boolean;
}

interface BlockContext {
  /** Nesting depth inside lists: 0 at the top. */
  listLevel: number;
  quote: boolean;
}

type Block = Paragraph | Table;

const SAFE_LINK = /^(https?:|mailto:)/i;

/** Turns a page's Markdown (GitHub-flavoured: tables, task lists) into Word paragraphs. */
class Converter {
  /** Each ordered list restarts at 1, so each gets its own numbering instance. */
  private orderedLists = 0;
  /** The shallowest heading level in the page becomes Heading 1. */
  private readonly topHeading: number;

  constructor(tree: Root) {
    const depths: number[] = [];
    const visit = (nodes: RootContent[]) => {
      for (const node of nodes) {
        if (node.type === 'heading') depths.push(node.depth);
        else if ('children' in node && node.type !== 'paragraph')
          visit(node.children as RootContent[]);
      }
    };
    visit(tree.children);
    this.topHeading = depths.length ? Math.min(...depths) : 1;
  }

  blocks(nodes: RootContent[], context: BlockContext = { listLevel: 0, quote: false }): Block[] {
    const out: Block[] = [];
    for (const node of nodes) out.push(...this.block(node, context));
    return out;
  }

  private block(node: RootContent, context: BlockContext): Block[] {
    const quote = context.quote
      ? {
          indent: { left: 360 },
          border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'C5CCD6', space: 8 } },
        }
      : {};
    switch (node.type) {
      case 'heading': {
        const level = Math.min(Math.max(node.depth - this.topHeading, 0), 5);
        return [new Paragraph({ heading: HEADINGS[level], children: this.inlines(node.children) })];
      }
      case 'paragraph':
        return [
          new Paragraph({
            ...quote,
            children: this.inlines(node.children, context.quote ? { italics: true } : {}),
          }),
        ];
      case 'list':
        return this.list(node, context);
      case 'code':
        return [this.codeBlock(node.value)];
      case 'blockquote':
        return this.blocks(node.children, { ...context, quote: true });
      case 'table':
        // Word needs a paragraph between two tables, and after a table at the end of a cell.
        return [this.table(node), new Paragraph({})];
      case 'thematicBreak':
        return [
          new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'C5CCD6', space: 1 } },
          }),
        ];
      case 'html':
        return node.value.trim()
          ? [new Paragraph({ ...quote, children: [this.run(node.value)] })]
          : [];
      case 'footnoteDefinition':
        return this.blocks(node.children, context);
      default:
        return [];
    }
  }

  private list(node: List, context: BlockContext): Block[] {
    const level = Math.min(context.listLevel, 8);
    const instance = node.ordered ? ++this.orderedLists : 0;
    const out: Block[] = [];
    for (const item of node.children) {
      let first = true;
      for (const child of item.children) {
        if (child.type === 'list') {
          out.push(...this.list(child, { ...context, listLevel: context.listLevel + 1 }));
          continue;
        }
        if (child.type !== 'paragraph' || !first) {
          // A second paragraph (or a code block) inside a list item: indented, no marker.
          for (const block of this.blocks([child], context)) {
            out.push(
              block instanceof Paragraph && child.type === 'paragraph'
                ? new Paragraph({
                    indent: { left: 720 * (level + 1) },
                    children: this.inlines(child.children),
                  })
                : block,
            );
          }
          continue;
        }
        first = false;
        if (item.checked === true || item.checked === false) {
          // A checklist item: its box is the marker, so no bullet or number as well.
          out.push(
            new Paragraph({
              indent: { left: 720 * (level + 1), hanging: 360 },
              children: [
                new TextRun({ children: [item.checked ? '☑' : '☐', new Tab()] }),
                ...this.inlines(child.children),
              ],
            }),
          );
          continue;
        }
        out.push(
          new Paragraph({
            ...(node.ordered
              ? { numbering: { reference: 'ordered', level, instance } }
              : { bullet: { level } }),
            children: this.inlines(child.children),
          }),
        );
      }
    }
    return out;
  }

  private table(node: MarkdownTable): Table {
    const columns = Math.max(...node.children.map((row) => row.children.length), 1);
    return new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: node.children.map((row, index) => {
        const header = index === 0;
        const cells = row.children.map((cell) => cell.children);
        while (cells.length < columns) cells.push([]);
        return new TableRow({
          tableHeader: header,
          children: cells.map(
            (content) =>
              new TableCell({
                margins: { top: 60, bottom: 60, left: 100, right: 100 },
                shading: header
                  ? { type: ShadingType.CLEAR, fill: HEADER_FILL, color: 'auto' }
                  : undefined,
                children: [
                  new Paragraph({
                    spacing: { after: 0 },
                    children: this.inlines(content, header ? { bold: true } : {}),
                  }),
                ],
              }),
          ),
        });
      }),
    });
  }

  private codeBlock(value: string): Paragraph {
    const lines = value.replace(/\t/g, '    ').split('\n');
    return new Paragraph({
      shading: { type: ShadingType.CLEAR, fill: CODE_FILL, color: 'auto' },
      spacing: { before: 80, after: 160, line: 240 },
      children: lines.map(
        (line, index) => new TextRun({ text: line, font: MONO, size: 19, break: index ? 1 : 0 }),
      ),
    });
  }

  private run(text: string, marks: Marks = {}): TextRun {
    return new TextRun({
      // A line break inside a Markdown paragraph is a space when rendered.
      text: text.replace(/\s*\n\s*/g, ' '),
      bold: marks.bold,
      italics: marks.italics,
      strike: marks.strike,
      ...(marks.link ? { style: 'Hyperlink' } : {}),
    });
  }

  private inlines(nodes: PhrasingContent[], marks: Marks = {}): ParagraphChild[] {
    const out: ParagraphChild[] = [];
    for (const node of nodes) {
      switch (node.type) {
        case 'text':
          out.push(this.run(node.value, marks));
          break;
        case 'strong':
          out.push(...this.inlines(node.children, { ...marks, bold: true }));
          break;
        case 'emphasis':
          out.push(...this.inlines(node.children, { ...marks, italics: true }));
          break;
        case 'delete':
          out.push(...this.inlines(node.children, { ...marks, strike: true }));
          break;
        case 'inlineCode':
          out.push(
            new TextRun({
              text: node.value,
              font: MONO,
              size: 20,
              bold: marks.bold,
              shading: { type: ShadingType.CLEAR, fill: CODE_FILL, color: 'auto' },
            }),
          );
          break;
        case 'break':
          out.push(new TextRun({ text: '', break: 1 }));
          break;
        case 'link':
          if (SAFE_LINK.test(node.url)) {
            out.push(
              new ExternalHyperlink({
                link: node.url,
                children: this.inlines(node.children, { ...marks, link: true }),
              }),
            );
          } else {
            out.push(...this.inlines(node.children, marks));
          }
          break;
        case 'image':
          out.push(this.run(node.alt ? `[image: ${node.alt}]` : '[image]', { italics: true }));
          break;
        case 'footnoteReference':
          out.push(this.run(`[${node.label ?? node.identifier}]`, marks));
          break;
        case 'html':
          out.push(this.run(node.value, marks));
          break;
        default:
          if ('children' in node) out.push(...this.inlines(node.children, marks));
          else if ('value' in node) out.push(this.run(String(node.value), marks));
      }
    }
    return out;
  }
}

/** Builds a Word document: the title, a line of details, then the page's Markdown. */
export async function markdownToDocx(input: DocxInput): Promise<Buffer> {
  const tree = fromMarkdown(input.markdown, {
    extensions: [gfm()],
    mdastExtensions: [gfmFromMarkdown()],
  });
  const body = new Converter(tree).blocks(tree.children);
  const ordered = Array.from({ length: 9 }, (_, level) => ({
    level,
    format: LevelFormat.DECIMAL,
    text: `%${level + 1}.`,
    alignment: AlignmentType.START,
    style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
  }));
  const document = new Document({
    creator: 'Helm',
    title: input.title,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 },
          paragraph: { spacing: { after: 120, line: 276 } },
        },
        title: { run: { font: FONT, size: 40, bold: true, color: INK } },
        heading1: {
          run: { font: FONT, size: 30, bold: true, color: INK },
          paragraph: { spacing: { before: 360, after: 120 }, keepNext: true },
        },
        heading2: {
          run: { font: FONT, size: 26, bold: true, color: INK },
          paragraph: { spacing: { before: 240, after: 100 }, keepNext: true },
        },
        heading3: {
          run: { font: FONT, size: 23, bold: true, color: '26323F' },
          paragraph: { spacing: { before: 200, after: 80 }, keepNext: true },
        },
        hyperlink: { run: { color: '1565C0', underline: {} } },
      },
      // Page numbers are fields; some readers size them from the paragraph's style, not the run.
      paragraphStyles: [
        {
          id: 'HelmFooter',
          name: 'Helm footer',
          basedOn: 'Normal',
          run: { font: FONT, size: 18, color: MUTED },
          paragraph: { spacing: { after: 0 } },
        },
      ],
    },
    numbering: { config: [{ reference: 'ordered', levels: ordered }] },
    sections: [
      {
        properties: { page: { margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                style: 'HelmFooter',
                alignment: AlignmentType.RIGHT,
                // One run per part: a page-number field does not take the formatting of the
                // text around it, so each part carries its own.
                children: [
                  `${input.title} · Page `,
                  PageNumber.CURRENT,
                  ' of ',
                  PageNumber.TOTAL_PAGES,
                ].map((part) =>
                  part === PageNumber.CURRENT || part === PageNumber.TOTAL_PAGES
                    ? new TextRun({ color: MUTED, size: 18, children: [part] })
                    : new TextRun({ color: MUTED, size: 18, text: part }),
                ),
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun(input.title)] }),
          new Paragraph({
            spacing: { after: 240 },
            children: [new TextRun({ text: input.subtitle, color: MUTED, size: 20 })],
          }),
          ...(body.length ? body : [new Paragraph({ children: [new TextRun('')] })]),
        ],
      },
    ],
  });
  return Packer.toBuffer(document);
}
