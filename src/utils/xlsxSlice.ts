// Tách riêng một sheet khỏi file .xlsx lớn (chạy trong trình duyệt, không cần thư viện ngoài):
// đọc danh mục zip, chỉ giải nén phần cần dùng rồi đóng gói lại thành xlsx nhỏ chỉ có sheet đó (giá trị đã tính vẫn nằm trong sheet).

const td = new TextDecoder()
const te = new TextEncoder()

interface Entry { name: string; method: number; csize: number; usize: number; offset: number }

function readEntries(u: Uint8Array): Map<string, Entry> {
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength)
  let e = -1
  for (let i = u.length - 22; i >= Math.max(0, u.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { e = i; break }
  if (e < 0) throw new Error('not_zip')
  const count = v.getUint16(e + 10, true)
  let p = v.getUint32(e + 16, true)
  const m = new Map<string, Entry>()
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('bad_cd')
    const method = v.getUint16(p + 10, true)
    const csize = v.getUint32(p + 20, true), usize = v.getUint32(p + 24, true)
    const nl = v.getUint16(p + 28, true), el = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true)
    const offset = v.getUint32(p + 42, true)
    if (csize === 0xffffffff || usize === 0xffffffff || offset === 0xffffffff) throw new Error('zip64')
    m.set(td.decode(u.subarray(p + 46, p + 46 + nl)), { name: td.decode(u.subarray(p + 46, p + 46 + nl)), method, csize, usize, offset })
    p += 46 + nl + el + cl
  }
  return m
}

async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function read(u: Uint8Array, m: Map<string, Entry>, name: string): Promise<Uint8Array | null> {
  const en = m.get(name)
  if (!en) return null
  const v = new DataView(u.buffer, u.byteOffset, u.byteLength)
  const start = en.offset + 30 + v.getUint16(en.offset + 26, true) + v.getUint16(en.offset + 28, true)
  const raw = u.subarray(start, start + en.csize)
  if (en.method === 0) return raw
  if (en.method === 8) return inflateRaw(raw)
  throw new Error('method')
}

let crcTable: Uint32Array | null = null
function crc32(d: Uint8Array): number {
  if (!crcTable) {
    crcTable = new Uint32Array(256)
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcTable[n] = c >>> 0 }
  }
  let c = 0xffffffff
  for (let i = 0; i < d.length; i++) c = crcTable[(c ^ d[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

/** Ghi zip không nén (đủ cho file tạm gửi lên máy chủ; sau đó máy chủ đọc bình thường). */
function writeZip(files: [string, Uint8Array][]): Uint8Array {
  const parts: Uint8Array[] = []
  const central: Uint8Array[] = []
  let off = 0
  for (const [name, data] of files) {
    const nb = te.encode(name), crc = crc32(data)
    const lh = new Uint8Array(30 + nb.length), lv = new DataView(lh.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true)
    lv.setUint32(14, crc, true); lv.setUint32(18, data.length, true); lv.setUint32(22, data.length, true); lv.setUint16(26, nb.length, true)
    lh.set(nb, 30)
    const ch = new Uint8Array(46 + nb.length), cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true)
    cv.setUint32(16, crc, true); cv.setUint32(20, data.length, true); cv.setUint32(24, data.length, true); cv.setUint16(28, nb.length, true)
    cv.setUint32(42, off, true)
    ch.set(nb, 46)
    parts.push(lh, data); central.push(ch)
    off += lh.length + data.length
  }
  const cdSize = central.reduce((s, c) => s + c.length, 0)
  const end = new Uint8Array(22), ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true)
  ev.setUint32(12, cdSize, true); ev.setUint32(16, off, true)
  const all = [...parts, ...central, end]
  const out = new Uint8Array(all.reduce((s, c) => s + c.length, 0))
  let o = 0
  for (const c of all) { out.set(c, o); o += c.length }
  return out
}

const attr = (tag: string, name: string) => new RegExp(`${name}="([^"]*)"`).exec(tag)?.[1]
const unesc = (s: string) => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')


// ---------------- Trợ cấp đi Hưng Yên từ các sheet pivot ----------------
interface Cell { col: number; row: number; v: string | number }
const colNum = (s: string) => s.split('').reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0)

function readCells(xml: string, strs: string[]): Cell[] {
  const out: Cell[] = []
  const re = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const raw = m[4] ? /<v>([^<]*)<\/v>/.exec(m[4])?.[1] : undefined
    if (raw === undefined) continue
    const t = /\bt="(\w+)"/.exec(m[3])?.[1]
    out.push({ col: colNum(m[1]), row: +m[2], v: t === 's' ? (strs[+raw] ?? '') : t === 'str' || t === 'e' ? unesc(raw) : Number(raw) })
  }
  return out
}

/** Sheet pivot "BN-HY…" / "HY-BN…": cột "Row Labels" là Mã NV, cách 2 cột bên phải là số tiền (số ngày × đơn giá); gộp theo Mã NV. */
function pivotAmounts(cells: Cell[], into: Map<string, number>) {
  const at = new Map(cells.map((c) => [`${c.col},${c.row}`, c.v]))
  for (const h of cells.filter((c) => c.v === 'Row Labels')) {
    for (let r = h.row + 1; ; r++) {
      const key = at.get(`${h.col},${r}`)
      if (key === undefined || key === 'Grand Total') break
      const amount = at.get(`${h.col + 2},${r}`)
      if (typeof amount === 'number' && amount > 0) {
        const id = String(key).trim()
        into.set(id, (into.get(id) ?? 0) + amount)
      }
    }
  }
}

const COL_TRAVEL = 46, COL_LODGING = 47   // AT, AU: hai cột trợ cấp của file nhập (xem ClosedFields)
const colName = (n: number) => String.fromCharCode(64 + Math.floor(n / 26)) + String.fromCharCode(64 + ((n - 1) % 26) + 1)

/** Ghi trợ cấp vào cột AT của từng dòng (theo Mã NV ở cột B) và xoá giá trị cũ ở AT / AU (ở file này hai cột đó là số ngày nghỉ, không phải trợ cấp). */
function injectTravel(sheetXml: string, travel: Map<string, number>, strs: string[]): string {
  const cT = colName(COL_TRAVEL), cL = colName(COL_LODGING)
  return sheetXml.replace(/<row\b[^>]*?(?:\/>|>[\s\S]*?<\/row>)/g, (row) => {
    if (row.endsWith('/>') && !row.includes('</row>')) return row
    const n = /\br="(\d+)"/.exec(row)?.[1]
    if (!n) return row
    const mv = readCells(row, strs).find((c) => c.col === 2)?.v
    let out = row.replace(new RegExp(`<c r="(?:${cT}|${cL})${n}"[^>]*?(?:/>|>[\\s\\S]*?</c>)`, 'g'), '')
    const amount = mv === undefined ? undefined : travel.get(String(mv).trim())
    if (amount) {
      const cell = `<c r="${cT}${n}"><v>${amount}</v></c>`
      const re = new RegExp(`<c r="([A-Z]+)${n}"`, 'g')
      let pos = out.lastIndexOf('</row>')
      for (let m = re.exec(out); m; m = re.exec(out)) if (colNum(m[1]) > COL_LODGING) { pos = m.index; break }
      out = out.slice(0, pos) + cell + out.slice(pos)
    }
    return out
  })
}

/**
 * Trả về file xlsx mới chỉ chứa sheet dữ liệu chốt công (đổi tên thành Sheet1), để file gốc nhiều sheet / hàng chục MB vẫn nhập được.
 * Sheet dữ liệu là sheet có ô tiêu đề `header` (vd "Kỳ lương") ở phần đầu; null nếu không tìm thấy hoặc không đọc được
 * (khi đó nơi gọi gửi nguyên file gốc).
 */
export async function extractSheet(file: File, header: string): Promise<{ file: File; travel: number | null } | null> {
  try {
    const u = new Uint8Array(await file.arrayBuffer())
    const m = readEntries(u)
    const wbBytes = await read(u, m, 'xl/workbook.xml'), relBytes = await read(u, m, 'xl/_rels/workbook.xml.rels')
    const sstBytes = await read(u, m, 'xl/sharedStrings.xml')
    if (!wbBytes || !relBytes || !sstBytes) return null
    const wb = td.decode(wbBytes), rels = td.decode(relBytes)
    // Vị trí chuỗi tiêu đề trong sharedStrings.
    const items = td.decode(sstBytes).match(/<si>[\s\S]*?<\/si>/g) ?? []
    const strs = items.map((x) => unesc((x.match(/<t\b[^>]*>([^<]*)<\/t>/g) ?? []).map((t) => t.replace(/<[^>]*>/g, '')).join('')))
    const want = header.trim().toLowerCase()
    const idx = strs.findIndex((x) => x.trim().toLowerCase() === want)
    if (idx < 0) return null
    const hit = new RegExp(`t="s"[^>]*><v>${idx}</v>`)
    let sheetTag: string | undefined, sheetBytes: Uint8Array | null = null
    for (const t of wb.match(/<sheet\b[^>]*>/g) ?? []) {
      const rid = attr(t, 'r:id')
      const rt = (rels.match(/<Relationship\b[^>]*>/g) ?? []).find((x) => attr(x, 'Id') === rid)
      const target = rt && attr(rt, 'Target')
      if (!target) continue
      const path = target.startsWith('/') ? target.slice(1) : `xl/${target}`
      const en = m.get(path)
      if (!en || en.usize > 40 * 1024 * 1024) continue   // sheet quá lớn không phải bảng chốt công
      const bytes = await read(u, m, path)
      if (!bytes) continue
      const head = td.decode(bytes.subarray(0, Math.min(bytes.length, 400_000)))
      if (hit.test(head)) {
        const isSheet1 = unesc(attr(t, 'name') ?? '').toLowerCase() === 'sheet1'
        if (!sheetTag || isSheet1) { sheetTag = t; sheetBytes = bytes }
        if (isSheet1) break
      }
    }
    if (!sheetTag || !sheetBytes) return null
    const sheetName = 'Sheet1'
    // Trợ cấp đi Hưng Yên: cộng số tiền từ các sheet "BN-HY…" và "HY-BN…" (nếu workbook có).
    const travel = new Map<string, number>()
    let hasTravelSheets = false
    for (const t of wb.match(/<sheet\b[^>]*>/g) ?? []) {
      if (!/^(bn-hy|hy-bn)\b/i.test(unesc(attr(t, 'name') ?? '').trim())) continue
      const rt = (rels.match(/<Relationship\b[^>]*>/g) ?? []).find((x) => attr(x, 'Id') === attr(t, 'r:id'))
      const target = rt && attr(rt, 'Target')
      const bytes = target ? await read(u, m, target.startsWith('/') ? target.slice(1) : `xl/${target}`) : null
      if (!bytes) continue
      hasTravelSheets = true
      pivotAmounts(readCells(td.decode(bytes), strs), travel)
    }
    // Bỏ các phần tham chiếu tới quan hệ (hình, bảng, liên kết, máy in) vì file mới không mang theo chúng.
    let sheetXml = td.decode(sheetBytes)
      .replace(/<f\b[^>]*\/>|<f\b[^>]*>[\s\S]*?<\/f>/g, '')   // bỏ công thức (trỏ sang sheet / file khác đã bị cắt), giữ giá trị đã tính
      .replace(/<(drawing|legacyDrawing|legacyDrawingHF|picture|tableParts|hyperlinks|oleObjects|controls)\b[\s\S]*?(\/>|<\/\1>)/g, '')
      .replace(/(<pageSetup\b[^>]*?)\s+r:id="[^"]*"/g, '$1')
    if (hasTravelSheets) sheetXml = injectTravel(sheetXml, travel, strs)

    const styles = await read(u, m, 'xl/styles.xml'), sst = await read(u, m, 'xl/sharedStrings.xml'), theme = await read(u, m, 'xl/theme/theme1.xml')
    const NS = 'http://schemas.openxmlformats.org/officeDocument/2006'
    const R = `${NS}/relationships`
    const relList = [`<Relationship Id="rId1" Type="${R}/worksheet" Target="worksheets/sheet1.xml"/>`]
    const ct = [
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>',
      '<Default Extension="xml" ContentType="application/xml"/>',
      '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
      '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>',
    ]
    const files: [string, Uint8Array][] = []
    if (styles) { relList.push(`<Relationship Id="rId2" Type="${R}/styles" Target="styles.xml"/>`); ct.push('<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'); files.push(['xl/styles.xml', styles]) }
    if (sst) { relList.push(`<Relationship Id="rId3" Type="${R}/sharedStrings" Target="sharedStrings.xml"/>`); ct.push('<Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>'); files.push(['xl/sharedStrings.xml', sst]) }
    if (theme) { relList.push(`<Relationship Id="rId4" Type="${R}/theme" Target="theme/theme1.xml"/>`); ct.push('<Override PartName="/xl/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>'); files.push(['xl/theme/theme1.xml', theme]) }
    const hdr = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
    const date1904 = /<workbookPr\b[^>]*date1904="(1|true)"/.test(wb) ? '<workbookPr date1904="1"/>' : ''
    const out: [string, Uint8Array][] = [
      ['[Content_Types].xml', te.encode(`${hdr}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${ct.join('')}</Types>`)],
      ['_rels/.rels', te.encode(`${hdr}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/officeDocument" Target="xl/workbook.xml"/></Relationships>`)],
      ['xl/workbook.xml', te.encode(`${hdr}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${R}">${date1904}<sheets><sheet name="${sheetName}" sheetId="1" r:id="rId1"/></sheets></workbook>`)],
      ['xl/_rels/workbook.xml.rels', te.encode(`${hdr}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${relList.join('')}</Relationships>`)],
      ['xl/worksheets/sheet1.xml', te.encode(sheetXml)],
      ...files,
    ]
    return { file: new File([writeZip(out) as BlobPart], file.name, { type: file.type }), travel: hasTravelSheets ? travel.size : null }
  } catch {
    return null
  }
}
