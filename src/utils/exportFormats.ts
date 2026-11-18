// Dependency-free exporters: real .xlsx and .docx files (zip container written by hand, "stored" method), plus JSON.

export interface ExportRow {
  n: number;
  label: string;
  key: string;
  views: string;
  layer: string;
  given: number;
  reference: number | null; // matching dimension read on the reference images (between given and required)
  required: number | null;
  change: number | null;
  unit: string;
  source: string; // "extracted from drawing" | "shell model"
}

export interface ExportMeta {
  model: string;
  referenceModel?: string;
  referenceTons?: number | null;
  referencePower?: number | null;
  conversion?: string;
  givenTons: number;
  requiredTons: number;
  file: string;
  when: string;
}

// ---------- minimal zip ----------
const CRC_TABLE = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t.push(c >>> 0);
  }
  return t;
})();
const crc32 = (b: Uint8Array) => {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function zip(files: { name: string; text: string }[]): Blob {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true);
    lh.setUint16(4, 20, true);
    lh.setUint16(6, 0x0800, true); // utf-8 names
    lh.setUint16(8, 0, true); // stored
    lh.setUint16(10, dosTime, true);
    lh.setUint16(12, dosDate, true);
    lh.setUint32(14, crc, true);
    lh.setUint32(18, data.length, true);
    lh.setUint32(22, data.length, true);
    lh.setUint16(26, name.length, true);
    lh.setUint16(28, 0, true);
    chunks.push(new Uint8Array(lh.buffer), name, data);

    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true);
    ch.setUint16(4, 20, true);
    ch.setUint16(6, 20, true);
    ch.setUint16(8, 0x0800, true);
    ch.setUint16(10, 0, true);
    ch.setUint16(12, dosTime, true);
    ch.setUint16(14, dosDate, true);
    ch.setUint32(16, crc, true);
    ch.setUint32(20, data.length, true);
    ch.setUint32(24, data.length, true);
    ch.setUint16(28, name.length, true);
    ch.setUint32(42, offset, true);
    central.push(new Uint8Array(ch.buffer), name);
    offset += 30 + name.length + data.length;
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, new Uint8Array(end.buffer)] as BlobPart[]);
}

const esc = (s: string) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

const HEAD = ['#', 'Dimension', 'Key', 'Views', 'Layer', 'Base', 'Reference', 'Target', 'Change', 'Unit', 'Source'];
const cells = (r: ExportRow) => [r.n, r.label, r.key, r.views, r.layer, r.given, r.reference, r.required, r.change, r.unit, r.source];

// ---------- xlsx ----------
export function buildXlsx(rows: ExportRow[], meta: ExportMeta): Blob {
  const col = (i: number) => String.fromCharCode(65 + i);
  const cell = (v: string | number | null, r: number, c: number) => {
    const ref = `${col(c)}${r}`;
    if (v === null || v === '') return '';
    return typeof v === 'number'
      ? `<c r="${ref}"><v>${v}</v></c>`
      : `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  };
  const info: [string, string | number][] = [
    ['Extraction model', meta.model],
    ['Drawing file', meta.file],
    ['Base capacity (t)', meta.givenTons],
    ['Target capacity (t)', meta.requiredTons],
    ...(meta.referenceTons != null ? ([['Reference image capacity (t)', meta.referenceTons]] as [string, string | number][]) : []),
    ...(meta.referencePower != null ? ([['Reference image power (MW)', meta.referencePower]] as [string, string | number][]) : []),
    ...(meta.referenceModel ? ([['Reference read by', meta.referenceModel]] as [string, string | number][]) : []),
    ...(meta.conversion ? ([['Conversion', meta.conversion]] as [string, string | number][]) : []),
    ['Exported', meta.when],
  ];
  let sheetRows = '';
  let r = 1;
  info.forEach(([k, v]) => {
    sheetRows += `<row r="${r}">${cell(k, r, 0)}${cell(v, r, 1)}</row>`;
    r++;
  });
  r++;
  sheetRows += `<row r="${r}">${HEAD.map((h, c) => cell(h, r, c)).join('')}</row>`;
  r++;
  rows.forEach((row) => {
    sheetRows += `<row r="${r}">${cells(row).map((v, c) => cell(v as any, r, c)).join('')}</row>`;
    r++;
  });
  const widths = [5, 38, 26, 14, 24, 12, 12, 12, 12, 8, 40];
  const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
  return zip([
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    },
    {
      name: 'xl/workbook.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Dimensions" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
    },
    {
      name: 'xl/worksheets/sheet1.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><cols>${cols}</cols><sheetData>${sheetRows}</sheetData></worksheet>`,
    },
  ]);
}

// ---------- docx ----------
export function buildDocx(rows: ExportRow[], meta: ExportMeta): Blob {
  const p = (t: string, bold = false, size = 22) =>
    `<w:p><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p>`;
  const num = (v: number | null) => (v === null ? '—' : String(v));
  const tc = (t: string, w: number, bold = false) =>
    `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/></w:tcPr><w:p><w:r><w:rPr>${bold ? '<w:b/>' : ''}<w:sz w:val="16"/></w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r></w:p></w:tc>`;
  const W = [500, 2900, 1200, 1300, 1000, 1000, 1100, 1000, 700];
  const head = ['#', 'Dimension', 'Views', 'Layer', 'Base', 'Reference', 'Target', 'Change', 'Unit'];
  const tr = (cs: string[], bold = false) => `<w:tr>${cs.map((c, i) => tc(c, W[i], bold)).join('')}</w:tr>`;
  const table = `<w:tbl><w:tblPr><w:tblBorders>${['top', 'left', 'bottom', 'right', 'insideH', 'insideV']
    .map((s) => `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`)
    .join('')}</w:tblBorders></w:tblPr>${tr(head, true)}${rows
    .map((r) => tr([String(r.n), r.label, r.views, r.layer, String(r.given), num(r.reference), num(r.required), r.change === null ? '—' : String(r.change), r.unit]))
    .join('')}</w:tbl>`;
  const body =
    p('Dimensions extracted across tri-view images', true, 32) +
    p(`Extraction model: ${meta.model}`) +
    p(`Drawing file: ${meta.file}`) +
    p(`Base ${meta.givenTons} t → Target ${meta.requiredTons} t`) +
    (meta.referenceTons != null || meta.referencePower != null
      ? p(`Reference image: ${meta.referenceTons ?? '?'} t, ${meta.referencePower ?? '?'} MW${meta.referenceModel ? ` (read by ${meta.referenceModel})` : ''}`)
      : '') +
    (meta.conversion ? p(`Conversion: ${meta.conversion}`) : '') +
    p(`Exported: ${meta.when}`) +
    table;
  return zip([
    {
      name: '[Content_Types].xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`,
    },
    {
      name: '_rels/.rels',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`,
    },
    {
      name: 'word/document.xml',
      text: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="900" w:right="900" w:bottom="900" w:left="900" w:header="400" w:footer="400" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    },
  ]);
}

export function buildJson(rows: ExportRow[], meta: ExportMeta): Blob {
  return new Blob(
    [
      JSON.stringify(
        {
          model: meta.model,
          file: meta.file,
          baseCapacityTons: meta.givenTons,
          referenceImage:
            meta.referenceTons != null || meta.referencePower != null
              ? { capacityTons: meta.referenceTons ?? null, powerMW: meta.referencePower ?? null, readBy: meta.referenceModel ?? null }
              : undefined,
          conversion: meta.conversion,
          requiredCapacityTons: meta.requiredTons,
          exported: meta.when,
          dimensions: rows.map((r) => ({
            n: r.n,
            label: r.label,
            key: r.key,
            views: r.views.split(', '),
            layer: r.layer,
            base: r.given,
            reference: r.reference,
            required: r.required,
            change: r.change,
            unit: r.unit,
            source: r.source,
          })),
        },
        null,
        2
      ),
    ],
    { type: 'application/json' }
  );
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
