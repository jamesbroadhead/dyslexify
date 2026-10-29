import { ConsoleStdout, Directory, File, OpenFile, PreopenDirectory, WASI } from '@bjorn3/browser_wasi_shim'

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<BuildRequest>) => void) | null
  postMessage(message: unknown, transfer?: Transferable[]): void
}

interface BuildRequest {
  id: number
  wasmUrl: string
  epub: ArrayBuffer
  fonts: ArrayBuffer[]
  fontFamily?: string
  filename: string
}

workerScope.onmessage = async (event) => {
  const { id, wasmUrl, epub, fonts, fontFamily, filename } = event.data
  const log = (line: string) => workerScope.postMessage({ id, type: 'progress', message: line })

  try {
    log('Loading the local Kindle converter…')
    const wasmResponse = await fetch(wasmUrl, { credentials: 'same-origin' })
    if (!wasmResponse.ok) throw new Error(`Could not load the Kindle converter (${wasmResponse.status}).`)
    const wasm = await WebAssembly.compile(await wasmResponse.arrayBuffer())

    const fontEntries = fonts.map((data, index) => [`font-${index}.${fontExtension(data)}`, new File(new Uint8Array(data))] as [string, File])
    const output = new File(new Uint8Array())
    const work = new Directory([
      ['input.epub', new File(new Uint8Array(epub))],
      ...fontEntries,
      ['output.azw3', output],
    ])
    const root = new PreopenDirectory('/', new Map([
      ['work', work],
      ['tmp', new Directory([])],
    ]))
    const stdout = ConsoleStdout.lineBuffered(log)
    const stderr = ConsoleStdout.lineBuffered((line) => workerScope.postMessage({ id, type: 'log', message: line }))
    const args = ['kindling-cli', 'build', '/work/input.epub', '--output', '/work/output.azw3', '--no-validate', '--no-embed-source', '--doc-type', 'ebok']
    for (const [name] of fontEntries) args.push('--embed-font', `/work/${name}`)
    if (fontFamily) args.push('--font-family', fontFamily)

    log('Building the AZW3 in this browser…')
    const wasi = new WASI(args, ['TMPDIR=/tmp'], [new OpenFile(new File(new Uint8Array())), stdout, stderr, root], { debug: false })
    const instance = await WebAssembly.instantiate(wasm, { wasi_snapshot_preview1: wasi.wasiImport })
    const exitCode = wasi.start(instance as Parameters<WASI['start']>[0])
    if (exitCode !== 0) throw new Error(`Kindling failed with exit code ${exitCode}. Check the conversion log.`)
    if (!output.data.byteLength) throw new Error('Kindling finished without producing an AZW3 file.')

    const result = output.data.slice()
    workerScope.postMessage({ id, type: 'result', data: result.buffer, filename }, [result.buffer])
  } catch (error) {
    workerScope.postMessage({ id, type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

function fontExtension(data: ArrayBuffer) {
  const bytes = new Uint8Array(data, 0, Math.min(data.byteLength, 4))
  return bytes[0] === 0x4f && bytes[1] === 0x54 && bytes[2] === 0x54 && bytes[3] === 0x4f ? 'otf' : 'ttf'
}
