import type { BuildAzw3Options, BuiltAzw3, FontFile } from './types'

export type { BuildAzw3Options, BuiltAzw3, FontFile, FontId } from './types'

let nextId = 0

/** Build an embedded-font KF8/AZW3 entirely on-device in a Web Worker. */
export function buildAzw3(
  epub: Blob | ArrayBuffer | Uint8Array,
  options: BuildAzw3Options,
): Promise<BuiltAzw3> {
  if (typeof Worker === 'undefined') return Promise.reject(new Error('AZW3 conversion requires a browser with Web Worker support.'))
  if (new URL(options.wasmUrl, location.href).origin !== location.origin) {
    return Promise.reject(new Error('The Kindling WASM must be hosted on this site so conversion stays local.'))
  }
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  const id = ++nextId
  const filename = 'book.azw3'
  let settled = false

  const finish = (callback: () => void) => {
    if (settled) return
    settled = true
    options.signal?.removeEventListener('abort', abort)
    worker.terminate()
    callback()
  }

  const abort = () => finish(() => reject(new DOMException('AZW3 conversion was cancelled.', 'AbortError')))
  let reject!: (reason?: unknown) => void
  const promise = new Promise<BuiltAzw3>((resolve, rejectPromise) => {
    reject = rejectPromise
    worker.onmessage = (event: MessageEvent) => {
      const message = event.data
      if (message.id !== id) return
      if (message.type === 'progress') options.onProgress?.(message.message)
      else if (message.type === 'log') options.onProgress?.(message.message)
      else if (message.type === 'error') finish(() => rejectPromise(new Error(message.message)))
      else if (message.type === 'result') finish(() => resolve({ data: new Uint8Array(message.data), filename: message.filename, format: 'azw3' }))
    }
    worker.onerror = (event) => finish(() => rejectPromise(new Error(event.message || 'The AZW3 worker failed.')))
  })

  if (options.signal?.aborted) abort()
  else options.signal?.addEventListener('abort', abort, { once: true })

  void toArrayBuffer(epub).then(async (epubBytes) => {
    if (settled) return
    const fontBytes = await Promise.all((options.fonts ?? []).map((font) => toArrayBuffer(font.data)))
    if (settled) return
    worker.postMessage({ id, wasmUrl: options.wasmUrl, epub: epubBytes, fonts: fontBytes, fontFamily: options.fontFamily, filename }, [epubBytes, ...fontBytes])
  }).catch((error) => finish(() => reject(error)))

  return promise
}

async function toArrayBuffer(input: Blob | ArrayBuffer | Uint8Array): Promise<ArrayBuffer> {
  if (input instanceof Blob) return input.arrayBuffer()
  if (input instanceof Uint8Array) return input.slice().buffer
  return input.slice(0)
}

export function downloadAzw3(book: BuiltAzw3) {
  const url = URL.createObjectURL(new Blob([book.data.slice().buffer as ArrayBuffer], { type: 'application/vnd.amazon.ebook' }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = book.filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
