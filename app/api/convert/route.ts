import { createHash } from 'node:crypto'
import JSZip from 'jszip'
import { NextResponse } from 'next/server'

type Stored = { files: { name: string; data: Buffer; font: string }[]; expires: number }
const cache = new Map<string, Stored>()
const fonts = { atkinson: 'Atkinson Hyperlegible', opendyslexic: 'OpenDyslexic', lexend: 'Lexend' } as const
const cssFor = (font: string) => `/* Dyslexify reading edition */\n@font-face { font-family: '${font}'; }\nhtml, body { font-family: '${font}', sans-serif !important; }\nbody * { font-family: '${font}', sans-serif !important; }\n`

function validEpub(buffer: Buffer, name: string) {
  if (!name.toLowerCase().endsWith('.epub') || buffer.subarray(0, 2).toString() !== 'PK') return false
  return true
}

async function buildEdition(source: Buffer, font: string) {
  const zip = await JSZip.loadAsync(source)
  const entries = Object.keys(zip.files)
  if (!entries.includes('mimetype') || !entries.some(path => path.toLowerCase().includes('container.xml'))) throw new Error('That file is not a valid EPUB book.')
  const styles = Object.keys(zip.files).filter(path => /\.(x?html?|css)$/i.test(path))
  for (const path of styles) {
    const entry = zip.file(path)
    if (!entry || zip.files[path].dir) continue
    const original = await entry.async('string')
    const updated = path.toLowerCase().endsWith('.css') ? `${original}\n${cssFor(font)}` : original.replace(/<head([^>]*)>/i, `<head$1><style>${cssFor(font)}</style>`)
    zip.file(path, updated)
  }
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

export async function POST(request: Request) {
  try {
    const form = await request.formData(); const input = form.get('file'); const choice = String(form.get('font'))
    if (!(input instanceof File) || !['atkinson', 'opendyslexic', 'lexend', 'all'].includes(choice)) return NextResponse.json({ error: 'Please choose a valid EPUB and reading font.' }, { status: 400 })
    const source = Buffer.from(await input.arrayBuffer())
    if (!validEpub(source, input.name)) return NextResponse.json({ error: 'Please upload a valid EPUB file. Other ebook formats are not supported yet.' }, { status: 415 })
    const hash = createHash('sha256').update(source).digest('hex').slice(0, 24)
    const selected = choice === 'all' ? Object.keys(fonts) as (keyof typeof fonts)[] : [choice as keyof typeof fonts]
    const files = await Promise.all(selected.map(async key => ({ name: `${input.name.replace(/\.epub$/i, '')} — ${fonts[key]}.epub`, data: await buildEdition(source, fonts[key]), font: fonts[key] })))
    cache.set(hash, { files, expires: Date.now() + 24 * 60 * 60 * 1000 })
    return NextResponse.json({ files: files.map(file => ({ name: file.name, font: file.font, url: `/api/download?hash=${hash}&font=${encodeURIComponent(file.font)}` })) })
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not inspect this ebook.' }, { status: 400 }) }
}

export function getStored(hash: string) { const item = cache.get(hash); if (!item || item.expires < Date.now()) { cache.delete(hash); return null }; return item }
