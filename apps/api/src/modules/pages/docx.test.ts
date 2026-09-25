import JSZip from 'jszip';
import { describe, expect, it } from 'vitest';
import { markdownToDocx } from './docx';

async function unpack(markdown: string) {
  const data = await markdownToDocx({
    title: 'Sales mart load',
    subtitle: 'Technical specification · Acme · Retail (ACME) · Version 2 · 2026-09-25',
    markdown,
  });
  const zip = await JSZip.loadAsync(data);
  const read = (name: string) => zip.file(name)!.async('string');
  const footer = Object.keys(zip.files).find((name) => /^word\/footer\d*\.xml$/.test(name))!;
  return { data, document: await read('word/document.xml'), footer: await read(footer) };
}

describe('Markdown to Word', () => {
  it('writes a Word file with the title, the details line and the page', async () => {
    const { data, document, footer } = await unpack('## Overview\n\nLoads **daily** sales.');
    expect(data.subarray(0, 2).toString()).toBe('PK');
    expect(document).toContain('w:val="Title"');
    expect(document).toContain('Sales mart load');
    expect(document).toContain('Technical specification · Acme · Retail (ACME)');
    expect(document).toMatch(/w:val="Heading1"[\s\S]*Overview/);
    expect(document).toMatch(/<w:b\/>[\s\S]*daily/);
    expect(footer).toContain('PAGE');
    expect(footer).toContain('NUMPAGES');
    // Every part of the footer, the page numbers included, is small and grey.
    expect(footer.match(/<w:r>/g)!.length).toBe(footer.match(/<w:sz w:val="18"\/>/g)!.length);
  });

  it('keeps tables, lists, code, quotes and links', async () => {
    const { document } = await unpack(
      [
        '## Sources',
        '',
        '| Source | Type |',
        '| --- | --- |',
        '| POS | `postgres` |',
        '| ERP |',
        '',
        '1. Extract',
        '2. Load',
        '    - into staging',
        '',
        '- [ ] Which warehouse?',
        '- [x] Agree the grain',
        '',
        '```sql',
        'select 1;',
        'select 2;',
        '```',
        '',
        '> Finance closes the day at 02:00 UTC.',
        '',
        'See [the runbook](https://example.com/runbook) and [this](javascript:alert(1)).',
      ].join('\n'),
    );
    expect(document).toContain('<w:tbl>');
    expect(document).toContain('<w:tblHeader/>');
    // The short row is padded to two cells, so Word does not report the file as damaged.
    expect(document.match(/<w:tc>/g)).toHaveLength(6);
    // Two numbered items and one nested bullet; checklist items use their box as the marker.
    expect(document.match(/<w:numPr>/g)).toHaveLength(3);
    expect(document).toMatch(/☐<\/w:t><w:tab\/>[\s\S]*Which warehouse\?/);
    expect(document).toMatch(/☑<\/w:t><w:tab\/>[\s\S]*Agree the grain/);
    expect(document).toContain('Consolas');
    expect(document).toMatch(/select 1;[\s\S]*<w:br\/>[\s\S]*select 2;/);
    expect(document).toContain('02:00 UTC');
    expect(document).toContain('<w:hyperlink');
    expect(document.match(/<w:hyperlink/g)).toHaveLength(1);
    expect(document).toContain('this');
  });

  it('makes the shallowest heading in the page Heading 1', async () => {
    const { document } = await unpack('### Deep\n\n#### Deeper');
    expect(document).toMatch(/w:val="Heading1"[\s\S]*Deep/);
    expect(document).toMatch(/w:val="Heading2"[\s\S]*Deeper/);
  });

  it('writes an empty page without failing', async () => {
    const { document } = await unpack('');
    expect(document).toContain('Sales mart load');
  });
});
