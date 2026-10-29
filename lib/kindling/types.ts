export type FontId = 'atkinson' | 'opendyslexic' | 'lexend'

export interface FontFile {
  /** Font file bytes. Kindling accepts static TTF and OTF files. */
  data: ArrayBuffer | Uint8Array
}

export interface BuildAzw3Options {
  /** URL of a kindling-cli.wasm built for wasm32-wasip1. */
  wasmUrl: string
  /** Optional embedded font faces; use multiple faces for bold/italic styles. */
  fonts?: FontFile[]
  /** Family name to apply to the body, defaults to the first font's metadata. */
  fontFamily?: string
  signal?: AbortSignal
  onProgress?: (message: string) => void
}

export interface BuiltAzw3 {
  data: Uint8Array
  filename: string
  format: 'azw3'
}
