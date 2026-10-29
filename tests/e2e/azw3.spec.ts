import { expect, test } from '@playwright/test'
import JSZip from 'jszip'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

async function minimalEpub() {
  const zip = new JSZip()
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
  zip.file('META-INF/container.xml', `<?xml version="1.0"?>
    <container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
      <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
    </container>`)
  zip.file('OEBPS/content.opf', `<?xml version="1.0" encoding="UTF-8"?>
    <package xmlns="http://www.idpf.org/2007/opf" xmlns:dc="http://purl.org/dc/elements/1.1/" version="3.0" unique-identifier="book-id">
      <metadata><dc:identifier id="book-id">urn:uuid:8a2d8202-e245-4f2d-8c8a-eab44652c019</dc:identifier><dc:title>Browser Conversion Test</dc:title><dc:language>en</dc:language></metadata>
      <manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/><item id="chapter" href="chapter.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="chapter"/></spine>
    </package>`)
  zip.file('OEBPS/nav.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops"><head><title>Contents</title></head><body><nav epub:type="toc"><h1>Contents</h1><ol><li><a href="chapter.xhtml">Chapter one</a></li></ol></nav></body></html>`)
  zip.file('OEBPS/chapter.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>Chapter one</title></head><body><h1>Chapter one</h1><p>A small book for verifying local Kindle conversion.</p></body></html>`)
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}

test('builds a Kindle AZW3 with an embedded selected font entirely in the browser', async ({ page }) => {
  const postRequests: string[] = []
  page.on('request', request => {
    if (request.method() !== 'GET') postRequests.push(`${request.method()} ${request.url()}`)
  })

  await page.goto('/')
  const expectedSha = (process.env.VERCEL_GIT_COMMIT_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })).slice(0, 12)
  await expect(page.locator('[data-build-sha]')).toHaveText(expectedSha)
  await page.locator('input[type=file]').setInputFiles({
    name: 'browser-conversion-test.epub',
    mimeType: 'application/epub+zip',
    buffer: await minimalEpub(),
  })
  await expect(page.getByText('browser-conversion-test.epub')).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: /Atkinson Hyperlegible/ }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('browser-conversion-test — Atkinson Hyperlegible.azw3')
  await expect(page.getByRole('heading', { name: 'Your Kindle book is ready' })).toBeVisible({ timeout: 60_000 })

  const output = await readFile(await download.path() as string)
  expect(output.toString('ascii', 60, 68)).toBe('BOOKMOBI')
  const recordCount = output.readUInt16BE(76)
  const firstRecord = 78 + recordCount * 8 + 2
  const exthFlags = output.readUInt32BE(firstRecord + 16 + 112)
  expect(exthFlags & 0x1000).toBe(0x1000)
  expect(output.includes(Buffer.from('FONT'))).toBe(true)
  expect(postRequests).toEqual([])
})
