# Dyslexify

Convert EPUBs into Kindle books with embedded dyslexia-friendly fonts.

Browser-only ebook conversion. EPUBs and font files are processed in memory in
the user's browser; they are not uploaded. KF8/AZW3 generation uses the
MIT-licensed Kindling Rust converter compiled to
`wasm32-wasip1`, executed in a Web Worker with the MIT OR Apache-2.0
`@bjorn3/browser_wasi_shim` runtime.

## Browser AZW3 library

Build the converter from the Kindling checkout (including the local EXTH flag
fix) and serve the resulting WASM as a same-origin static file:

```sh
cd ~/checkouts/github/kindling
cargo build --release --target wasm32-wasip1 --bin kindling-cli
mkdir -p ~/checkouts/github/dyslexify/public
cp target/wasm32-wasip1/release/kindling-cli.wasm \
  ~/checkouts/github/dyslexify/public/kindling-cli.wasm
cp LICENSE ~/checkouts/github/dyslexify/public/KINDLING-LICENSE
```

Include Kindling's `LICENSE` with the shipped WASM. The font files used by the
UI and converter are kept under `public/fonts/`, each family beside its OFL
notice. The WASI shim is dual licensed under MIT or Apache-2.0; its npm package
includes both notices.

The browser API is `lib/kindling/index.ts`:

```ts
import { buildAzw3, downloadAzw3 } from '../lib/kindling'

const result = await buildAzw3(epubFile, {
  wasmUrl: '/kindling-cli.wasm',
  fonts: [{ data: atkinsonRegularTtf }],
  fontFamily: 'Atkinson Hyperlegible',
  onProgress: (message) => setStatus(message),
})
downloadAzw3(result)
```

`buildAzw3` accepts a `Blob`, `ArrayBuffer`, or `Uint8Array`; it returns the
AZW3 bytes and filename. Font faces accept static TTF/OTF bytes. Pass multiple
faces to embed regular, bold, and italic variants. An `AbortSignal` can cancel
work by terminating the worker. The WASM is fetched from the same origin;
conversion itself uses only the supplied in-memory book and fonts and makes no
server conversion request.

Build/check the app with `npm run build`. Run the browser conversion test with
`npm run test:e2e` after installing Playwright's Chromium (`npx playwright
install chromium`). The test generates a minimal EPUB, converts it through the
UI, then checks the downloaded PalmDB signature, embedded-font EXTH flag, and
KF8 `FONT` record; it also asserts that no non-GET request was made.

The local scale test accepts Gutenberg EPUBs via `DYSLEXIFY_SCALE_SOURCE_DIR`
and writes the browser outputs and memory/timing report into
`DYSLEXIFY_BROWSER_OUTPUT_DIR`. Set `DYSLEXIFY_SCALE_BOOKS=pg1342,pg120` to run
the 24 MB and 47 MB examples. To compare a browser output with a native build,
run `KINDLING_CLI=/path/to/kindling-cli npm run compare:azw3 -- native.azw3
browser.azw3`; it compares all Kindling dump fields except volatile PalmDB
timestamps/UID and raw record payloads (which include transcoded image bytes),
and verifies record and embedded-font counts.
