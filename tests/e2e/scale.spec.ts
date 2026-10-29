import { expect, test } from '@playwright/test'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const sourceDir = process.env.DYSLEXIFY_SCALE_SOURCE_DIR
const outputDir = process.env.DYSLEXIFY_BROWSER_OUTPUT_DIR
const availableCases = [
  { id: 'pg1661', title: 'The Adventures of Sherlock Holmes' },
  { id: 'pg11', title: 'Alice in Wonderland' },
  { id: 'pg55', title: 'The Wonderful Wizard of Oz' },
  { id: 'pg1342', title: 'Pride and Prejudice' },
  { id: 'pg120', title: 'Treasure Island' },
]
const selectedIds = new Set(process.env.DYSLEXIFY_SCALE_BOOKS?.split(',').map(id => id.trim()).filter(Boolean))
const cases = selectedIds.size ? availableCases.filter(book => selectedIds.has(book.id)) : availableCases.filter(book => ['pg1342', 'pg120'].includes(book.id))

async function browserMemory(cdp: Awaited<ReturnType<import('@playwright/test').Browser['newBrowserCDPSession']>>) {
  const { processInfo } = await cdp.send('SystemInfo.getProcessInfo')
  const snapshots = await Promise.all(processInfo.map(async process => {
    const status = await readFile(`/proc/${process.id}/status`, 'utf8').catch(() => '')
    const rss = Number(status.match(/^VmRSS:\s+(\d+)\s+kB/m)?.[1] ?? 0)
    return { type: process.type, rss }
  }))
  return {
    browserRssKb: snapshots.reduce((sum, process) => sum + process.rss, 0),
    rendererRssKb: snapshots.filter(process => process.type === 'renderer').reduce((sum, process) => sum + process.rss, 0),
  }
}

test.skip(!sourceDir || !outputDir, 'Set DYSLEXIFY_SCALE_SOURCE_DIR and DYSLEXIFY_BROWSER_OUTPUT_DIR to run large-book measurements.')
test.setTimeout(30 * 60_000)

test('measures large-book browser conversion and writes AZW3 outputs for native comparison', async ({ page, browser }) => {
  await mkdir(outputDir!, { recursive: true })
  const cdp = await browser.newBrowserCDPSession()
  let peakBrowserRssKb = 0
  let peakRendererRssKb = 0
  let activeMeasurement: { book: string; inputBytes: number; startedAt: number; idleBrowserRssKb: number; idleRendererRssKb: number } | null = null
  const memorySampler = setInterval(async () => {
    try {
      const current = await browserMemory(cdp)
      peakBrowserRssKb = Math.max(peakBrowserRssKb, current.browserRssKb)
      peakRendererRssKb = Math.max(peakRendererRssKb, current.rendererRssKb)
    } catch {
      // A browser process can exit between the CDP query and /proc read.
    }
  }, 500)
  const liveReportWriter = setInterval(() => {
    if (!activeMeasurement) return
    void writeFile(join(outputDir!, 'browser-measurement-live.json'), JSON.stringify({
      book: activeMeasurement.book,
      inputBytes: activeMeasurement.inputBytes,
      elapsedSeconds: Number(((performance.now() - activeMeasurement.startedAt) / 1000).toFixed(1)),
      peakBrowserRssMiB: Number((peakBrowserRssKb / 1024).toFixed(1)),
      peakRendererRssMiB: Number((peakRendererRssKb / 1024).toFixed(1)),
      browserRssAbovePageIdleMiB: Number(((peakBrowserRssKb - activeMeasurement.idleBrowserRssKb) / 1024).toFixed(1)),
      rendererRssAbovePageIdleMiB: Number(((peakRendererRssKb - activeMeasurement.idleRendererRssKb) / 1024).toFixed(1)),
    }, null, 2)).catch(() => {})
  }, 10_000)

  const measurements: Array<Record<string, number | string>> = []
  try {
    for (const book of cases) {
      await page.goto('/')
      const pageIdle = await browserMemory(cdp)
      const inputPath = join(sourceDir!, `${book.id}.epub`)
      const input = await readFile(inputPath)
      const fileName = `${book.title}.epub`
      await page.locator('input[type=file]').setInputFiles({ name: fileName, mimeType: 'application/epub+zip', buffer: input })

      const baseline = await browserMemory(cdp)
      peakBrowserRssKb = baseline.browserRssKb
      peakRendererRssKb = baseline.rendererRssKb
      const started = performance.now()
      activeMeasurement = {
        book: book.title,
        inputBytes: input.byteLength,
        startedAt: started,
        idleBrowserRssKb: pageIdle.browserRssKb,
        idleRendererRssKb: pageIdle.rendererRssKb,
      }
      const downloadPromise = page.waitForEvent('download')
      await page.getByRole('button', { name: /Atkinson Hyperlegible/ }).click()
      let previousProgress = ''
      const progressLogger = setInterval(async () => {
        const current = await page.locator('.processing strong').textContent().catch(() => null)
        if (current !== previousProgress) previousProgress = current ?? ''
        console.log(`${book.title}: ${current ?? 'still running'}; ${((performance.now() - started) / 1000).toFixed(0)}s; peak renderer RSS ${(peakRendererRssKb / 1024).toFixed(1)} MiB`)
      }, 5_000)
      const download = await downloadPromise
      clearInterval(progressLogger)
      await expect(page.getByRole('heading', { name: 'Your Kindle book is ready' })).toBeVisible({ timeout: 8 * 60_000 })
      const elapsedSeconds = (performance.now() - started) / 1000
      const browserOutput = join(outputDir!, `${book.title} [Atkinson Hyperlegible].azw3`)
      await download.saveAs(browserOutput)
      const outputSize = (await stat(browserOutput)).size

      measurements.push({
        book: book.title,
        inputBytes: input.byteLength,
        outputBytes: outputSize,
        conversionSeconds: Number(elapsedSeconds.toFixed(2)),
        peakBrowserRssMiB: Number((peakBrowserRssKb / 1024).toFixed(1)),
        peakRendererRssMiB: Number((peakRendererRssKb / 1024).toFixed(1)),
        browserRssAfterFileSelectionMiB: Number((baseline.browserRssKb / 1024).toFixed(1)),
        rendererRssAfterFileSelectionMiB: Number((baseline.rendererRssKb / 1024).toFixed(1)),
        browserRssAbovePageIdleMiB: Number(((peakBrowserRssKb - pageIdle.browserRssKb) / 1024).toFixed(1)),
        rendererRssAbovePageIdleMiB: Number(((peakRendererRssKb - pageIdle.rendererRssKb) / 1024).toFixed(1)),
      })
      activeMeasurement = null
      const partialReport = JSON.stringify({ measuredAt: new Date().toISOString(), measurements }, null, 2)
      await writeFile(join(outputDir!, 'browser-measurements.json'), partialReport)
      console.log(`${book.title} measurement: ${JSON.stringify(measurements.at(-1))}`)
      await page.getByRole('button', { name: 'Remove file' }).click()
    }
  } finally {
    clearInterval(memorySampler)
    clearInterval(liveReportWriter)
    await cdp.detach()
  }

  const report = JSON.stringify({ measuredAt: new Date().toISOString(), measurements }, null, 2)
  await writeFile(join(outputDir!, 'browser-measurements.json'), report)
  console.log(report)
  await test.info().attach('browser-measurements.json', { body: report, contentType: 'application/json' })
})
