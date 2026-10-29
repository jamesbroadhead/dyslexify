'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Download, FileArchive, Heart, Info, LoaderCircle, LockKeyhole, Sparkles, Upload, X } from 'lucide-react'
import { buildAzw3, type FontFile, type FontId } from '../lib/kindling'

type FontChoice = FontId | 'all'
type Result = { name: string; url: string; font: string }

const choices: { id: FontId; name: string; detail: string; sample: string }[] = [
  { id: 'atkinson', name: 'Atkinson Hyperlegible', detail: 'Crisp letterforms designed for readability', sample: 'The quick brown fox jumps over the lazy dog.' },
  { id: 'opendyslexic', name: 'OpenDyslexic', detail: 'Weighted bottoms help letters stay grounded', sample: 'A gentle rhythm for every page.' },
  { id: 'lexend', name: 'Lexend', detail: 'Open spacing reduces visual crowding', sample: 'Comfortable reading at any size.' },
]

const fontAssets: Record<FontId, string[]> = {
  atkinson: [
    '/fonts/atkinson/Regular.ttf', '/fonts/atkinson/Bold.ttf',
    '/fonts/atkinson/Italic.ttf', '/fonts/atkinson/BoldItalic.ttf',
  ],
  opendyslexic: [
    '/fonts/opendyslexic/Regular.ttf', '/fonts/opendyslexic/Bold.ttf',
    '/fonts/opendyslexic/Italic.ttf', '/fonts/opendyslexic/BoldItalic.ttf',
  ],
  lexend: ['/fonts/lexend/Regular.ttf', '/fonts/lexend/Bold.ttf'],
}

const families: Record<FontId, string> = {
  atkinson: 'Atkinson Hyperlegible',
  opendyslexic: 'OpenDyslexic',
  lexend: 'Lexend',
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<FontChoice | null>(null)
  const [selectedChoice, setSelectedChoice] = useState<FontChoice>('atkinson')
  const [progress, setProgress] = useState('')
  const [results, setResults] = useState<Result[]>([])

  useEffect(() => () => results.forEach(result => URL.revokeObjectURL(result.url)), [results])

  function chooseFile(candidate?: File) {
    if (!candidate) return
    if (!candidate.name.toLowerCase().endsWith('.epub')) {
      setError('Please choose an EPUB file.')
      return
    }
    if (candidate.size > 50 * 1024 * 1024) {
      setError('Please choose an EPUB smaller than 50 MB.')
      return
    }
    setError('')
    setResults([])
    setFile(candidate)
  }

  async function loadFontFiles(font: FontId): Promise<FontFile[]> {
    return Promise.all(fontAssets[font].map(async path => {
      const response = await fetch(path)
      if (!response.ok) throw new Error(`Could not load the ${families[font]} font files.`)
      return { data: await response.arrayBuffer() }
    }))
  }

  async function convert(font: FontChoice) {
    if (!file || processing) return
    setError('')
    setProcessing(font)
    setResults([])
    const selected: FontId[] = font === 'all' ? ['atkinson', 'opendyslexic', 'lexend'] : [font]
    const outputs: Result[] = []
    try {
      for (const key of selected) {
        const family = families[key]
        setProgress(`Loading ${family} font files…`)
        const fonts = await loadFontFiles(key)
        const output = await buildAzw3(file, {
          wasmUrl: '/kindling-cli.wasm',
          fonts,
          fontFamily: family,
          onProgress: setProgress,
        })
        const url = URL.createObjectURL(new Blob([output.data.slice().buffer as ArrayBuffer], { type: 'application/vnd.amazon.ebook' }))
        outputs.push({
          name: `${file.name.replace(/\.epub$/i, '')} — ${family}.azw3`,
          url,
          font: family,
        })
      }

      setResults(outputs)
      outputs.forEach((item, index) => setTimeout(() => {
        const link = document.createElement('a')
        link.href = item.url
        link.download = item.name
        link.click()
      }, index * 700))
    } catch (cause) {
      outputs.forEach(output => URL.revokeObjectURL(output.url))
      setError(cause instanceof Error ? cause.message : 'Unable to convert this EPUB. Please try another file.')
    } finally {
      setProcessing(null)
      setProgress('')
    }
  }

  function selectFont(font: FontChoice) {
    setSelectedChoice(font)
    if (file) void convert(font)
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Sparkles /></span><span>dyslexify</span></a><nav className="site-nav" aria-label="Site navigation"><a href="/faq">FAQ</a><a href="/terms">Terms</a></nav><span className="privacy"><LockKeyhole /> files never leave your device</span></header>
    <section className="hero"><p className="eyebrow">A kinder way to read</p><h1>Make any ebook<br /><em>easier to read.</em></h1><p className="lede">A tool for local processing of ebooks by people who are print disabled. Your EPUB is converted to a Kindle book entirely in your browser — it never uploads to our servers.</p></section>
    <section className="workspace">
      <div className="step"><span className="step-number">01</span><div><h2>Upload your ebook</h2><p>EPUB files up to 50 MB. Everything happens locally in your browser.</p></div></div>
      <div className={`dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); chooseFile(event.dataTransfer.files[0]) }}>
        {file ? <><div className="file-icon"><FileArchive /></div><div className="file-info"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to transform</span></div><button className="icon-button" aria-label="Remove file" onClick={() => { setFile(null); setResults([]); setError('') }}><X /></button></> : <><div className="upload-icon"><Upload /></div><div><strong>Drop your ebook here</strong><span>or click to browse from your device</span></div><button className="button secondary" onClick={() => inputRef.current?.click()}><Upload data-icon="inline-start" /> Upload file</button><button className="sample-link" onClick={async () => { setError(''); setProgress('Loading Alice in Wonderland…'); try { const response = await fetch('/api/sample'); if (!response.ok) throw new Error('Could not load the sample ebook.'); const blob = await response.blob(); chooseFile(new File([blob], 'Alice in Wonderland.epub', { type: 'application/epub+zip' })) } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the sample ebook.') } finally { setProgress('') } }}>Use Alice in Wonderland</button><input ref={inputRef} type="file" accept=".epub,application/epub+zip" hidden onChange={event => chooseFile(event.target.files?.[0])} /></>}
      </div>
      {progress && !processing && <div className="sample-loading">{progress}</div>}
      {error && <div className="error"><X />{error}</div>}
      <div className="step second"><span className="step-number">02</span><div><h2>Choose your reading font</h2><p>We&apos;ll build a Kindle AZW3 with the selected font embedded.</p></div></div>
      <div className="font-grid">{choices.map(choice => <div key={choice.id} className="font-card" style={{ fontFamily: choice.id === 'atkinson' ? '"Atkinson Hyperlegible", sans-serif' : choice.id === 'lexend' ? 'Lexend, sans-serif' : '"OpenDyslexic", sans-serif', borderColor: selectedChoice === choice.id ? 'var(--teal)' : undefined, background: selectedChoice === choice.id ? 'var(--teal-light)' : undefined }}><button className="font-card-main" aria-pressed={selectedChoice === choice.id} disabled={!!processing} onClick={() => selectFont(choice.id)}><span className={`font-preview ${choice.id}`} aria-hidden="true">Aa</span><span className="font-card-copy"><strong className={`font-name ${choice.id}`}>{choice.name}</strong><small>{choice.detail}</small><i>{choice.sample}</i></span><span className="arrow">→</span></button><a className="font-info" href={`/font-sample/${choice.id}`} aria-label={`Read a sample in ${choice.name}`}><Info /></a></div>)}<div className="font-card all-card" style={{ fontFamily: '"Atkinson Hyperlegible", sans-serif', borderColor: selectedChoice === 'all' ? 'var(--teal)' : undefined, background: selectedChoice === 'all' ? 'var(--teal-light)' : undefined }}><button className="font-card-main" aria-pressed={selectedChoice === 'all'} disabled={!!processing} onClick={() => selectFont('all')}><span className="font-preview all-preview"><Sparkles /></span><span className="font-card-copy"><strong>Generate all 3</strong><small>Try every font and choose your favorite</small><i>Three embedded-font Kindle books</i></span><span className="arrow">→</span></button></div></div>
      {processing && <div className="processing"><LoaderCircle className="spinner" /><div><strong>{progress}</strong><span>Your EPUB and font files stay in this browser. Keep this tab open.</span></div></div>}
      {results.length > 0 && <div className="results"><div className="results-heading"><div><span className="success-dot"><Check /></span><h2>Your Kindle book is ready</h2><p>Your AZW3 download started. Your files remain in this browser session only.</p></div><div className="result-actions">{results.map(result => <a className="button primary" href={result.url} download={result.name} key={result.name}><Download data-icon="inline-start" /> {results.length > 1 ? result.font : 'Download AZW3'}</a>)}</div></div></div>}
    </section>
    <footer><span><Heart /> Made for more comfortable reading</span><span><a href="/faq">FAQ</a><a href="/terms">Terms</a><span>EPUB in · Kindle AZW3 out</span></span></footer>
  </main>
}
