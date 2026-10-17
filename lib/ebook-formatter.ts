import JSZip from 'jszip'

export const FONT_FAMILIES = {
  atkinson: 'Atkinson Hyperlegible',
  opendyslexic: 'OpenDyslexic',
  lexend: 'Lexend',
} as const

export type FontId = keyof typeof FONT_FAMILIES
export type EbookFormat = 'epub'

export interface FormatOptions {
  font: FontId
  signal?: AbortSignal
  onProgress?: (message: string) => void
}

export interface FormattedEbook {
  blob: Blob
  filename: string
  format: EbookFormat
  font: FontId
}

export class InvalidEpubError extends Error {
  constructor(message = 'That file is not a valid EPUB book.') {
    super(message)
    this.name = 'InvalidEpubError'
  }
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Formatting was cancelled.', 'AbortError')
}

function isEpub(zip: JSZip) {
  const mimetype = zip.file('mimetype')
  const container = zip.file('META-INF/container.xml')
  return Boolean(mimetype && container)
}

/** Deterministically inspects a file without uploading or executing its contents. */
export async function inspectEpub(input: Blob | ArrayBuffer | Uint8Array) {
  const zip = await JSZip.loadAsync(input)
  if (!isEpub(zip)) throw new InvalidEpubError()
  const mimetype = await zip.file('mimetype')!.async('string')
  if (mimetype.trim() !== 'application/epub+zip') throw new InvalidEpubError()
  return { type: 'epub' as const, entries: Object.keys(zip.files) }
}

/** Formats an EPUB entirely in the calling browser. No network or server APIs are used. */
export async function formatEpub(input: Blob | ArrayBuffer | Uint8Array, options: FormatOptions): Promise<FormattedEbook> {
  const source = await JSZip.loadAsync(input)
  if (!isEpub(source)) throw new InvalidEpubError()
  const mimetype = await source.file('mimetype')!.async('string')
  if (mimetype.trim() !== 'application/epub+zip') throw new InvalidEpubError()

  throwIfAborted(options.signal)
  const font = FONT_FAMILIES[options.font]
  const css = `\n/* Dyslexify local edition — ${font} */\nhtml, body, body * { font-family: '${font}', sans-serif !important; }\n`
  const zip = await JSZip.loadAsync(input)
  const paths = Object.keys(zip.files)
  for (const [index, path] of paths.entries()) {
    throwIfAborted(options.signal)
    const entry = zip.files[path]
    if (entry.dir || !/\.(x?html?|css)$/i.test(path)) continue
    const file = zip.file(path)
    if (!file) continue
    const original = await file.async('string')
    zip.file(path, path.toLowerCase().endsWith('.css')
      ? `${original}${css}`
      : original.replace(/<head([^>]*)>/i, `<head$1><style>${css}</style>`))
    options.onProgress?.(`Applying ${font} to ebook pages (${index + 1}/${paths.length})…`)
  }

  throwIfAborted(options.signal)
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
  return { blob, filename: `${font}.epub`, format: 'epub', font: options.font }
}

export function downloadEbook(ebook: FormattedEbook) {
  const url = URL.createObjectURL(ebook.blob)
  const link = document.createElement('a')
  link.href = url
  link.download = ebook.filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
