import { spawnSync } from 'node:child_process'

const [nativePath, browserPath] = process.argv.slice(2)
if (!nativePath || !browserPath) {
  console.error('Usage: KINDLING_CLI=/path/to/kindling-cli node scripts/compare-azw3.mjs <native.azw3> <browser.azw3>')
  process.exit(2)
}

const cli = process.env.KINDLING_CLI || 'kindling-cli'

function semanticFields(path) {
  const result = spawnSync(cli, ['dump', path], { encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) throw new Error(result.stderr || `kindling-cli dump exited ${result.status}`)

  const volatilePalmDbFields = new Set(['palmdb.ctime', 'palmdb.mtime', 'palmdb.uid'])
  const lines = result.stdout.split(/\r?\n/)
  const fields = new Map(lines
    .filter(line => line.includes(' = ') && !line.startsWith('record[') && !volatilePalmDbFields.has(line.slice(0, line.indexOf(' = '))))
    .map(line => {
      const separator = line.indexOf(' = ')
      return [line.slice(0, separator), line.slice(separator + 3)]
    }))
  const records = lines.filter(line => /^record\[\d+\]\.length = /.test(line)).length
  const fonts = lines.filter(line => /^record\[\d+\]\.magic = "FONT"$/.test(line)).length
  return { fields, records, fonts }
}

try {
  const native = semanticFields(nativePath)
  const browser = semanticFields(browserPath)
  const keys = [...new Set([...native.fields.keys(), ...browser.fields.keys()])].sort()
  const differences = keys.filter(key => native.fields.get(key) !== browser.fields.get(key))

  if (differences.length || native.records !== browser.records || native.fonts !== browser.fonts) {
    for (const key of differences) {
      console.error(`${key}\n  native:  ${native.fields.get(key) ?? '<missing>'}\n  browser: ${browser.fields.get(key) ?? '<missing>'}`)
    }
    if (native.records !== browser.records) console.error(`record count: native ${native.records}; browser ${browser.records}`)
    if (native.fonts !== browser.fonts) console.error(`FONT records: native ${native.fonts}; browser ${browser.fonts}`)
    process.exitCode = 1
  } else {
    console.log(`Kindle structure matches: ${nativePath} == ${browserPath} (${native.fields.size} fields, ${native.records} records, ${native.fonts} FONT records; PalmDB timestamps/UID and raw record payloads ignored)`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}
