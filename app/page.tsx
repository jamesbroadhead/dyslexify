'use client'

import JSZip from 'jszip'
import { useRef, useState } from 'react'
import { Check, Download, FileArchive, FileText, Heart, Info, LoaderCircle, LockKeyhole, Sparkles, Upload, X } from 'lucide-react'

type FontChoice = 'atkinson' | 'opendyslexic' | 'lexend' | 'all'
type Result = { name: string; url: string; font: string }

const choices: { id: FontChoice; name: string; detail: string; sample: string }[] = [
  { id: 'atkinson', name: 'Atkinson Hyperlegible', detail: 'Crisp letterforms designed for readability', sample: 'The quick brown fox jumps over the lazy dog.' },
  { id: 'opendyslexic', name: 'OpenDyslexic', detail: 'Weighted bottoms help letters stay grounded', sample: 'A gentle rhythm for every page.' },
  { id: 'lexend', name: 'Lexend', detail: 'Open spacing reduces visual crowding', sample: 'Comfortable reading at any size.' },
]

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState<FontChoice | null>(null)
  const [progress, setProgress] = useState('')
  const [results, setResults] = useState<Result[]>([])

  function chooseFile(candidate?: File) {
    if (!candidate) return
    setError(''); setResults([]); setFile(candidate)
  }

  async function convert(font: FontChoice) {
    if (!file) return
    setError(''); setProcessing(font); setProgress(font === 'all' ? 'Preparing three accessible editions…' : 'Inspecting your ebook…')
    try {
      const source = await JSZip.loadAsync(await file.arrayBuffer())
      const entries = Object.keys(source.files)
      if (!entries.includes('mimetype') || !entries.includes('META-INF/container.xml')) throw new Error('That file is not a valid EPUB book.')
      const names = { atkinson: 'Atkinson Hyperlegible', opendyslexic: 'OpenDyslexic', lexend: 'Lexend' } as const
      const selected = font === 'all' ? (Object.keys(names) as Exclude<FontChoice, 'all'>[]) : [font]
      const outputs: Result[] = []
      for (const key of selected) {
        setProgress(`Applying ${names[key]} to every page…`)
        const zip = await JSZip.loadAsync(await file.arrayBuffer())
        const css = `\\n/* Dyslexify local edition */\\nhtml, body, body * { font-family: '${names[key]}', sans-serif !important; }\\n`
        for (const path of Object.keys(zip.files)) {
          if (zip.files[path].dir || !/\\.(x?html?|css)$/i.test(path)) continue
          const entry = zip.file(path); if (!entry) continue
          const original = await entry.async('string')
          zip.file(path, path.toLowerCase().endsWith('.css') ? original + css : original.replace(/<head([^>]*)>/i, `<head$1><style>${css}</style>`))
        }
        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
        const url = URL.createObjectURL(blob)
        outputs.push({ name: `${file.name.replace(/\\.epub$/i, '')} — ${names[key]}.epub`, url, font: names[key] })
      }
      setResults(outputs)
      outputs.forEach((item, index) => setTimeout(() => { const link = document.createElement('a'); link.href = item.url; link.download = item.name; link.click() }, index * 700))
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to inspect this file. Please choose a valid EPUB.') }
    finally { setProcessing(null); setProgress('') }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Sparkles /></span><span>dyslexify</span></a><nav className="site-nav" aria-label="Site navigation"><a href="/faq">FAQ</a><a href="/terms">Terms</a></nav><span className="privacy"><LockKeyhole /> files never leave your device</span></header>
    <section className="hero"><p className="eyebrow">A kinder way to read</p><h1>Make any ebook<br /><em>easier to read.</em></h1><p className="lede">A tool for local processing of ebooks by people who are print disabled. Your EPUB is checked and converted entirely in your browser — it never uploads to our servers.</p></section>
    <section className="workspace">
      <div className="step"><span className="step-number">01</span><div><h2>Upload your ebook</h2><p>EPUB files up to 50 MB. Everything happens locally in your browser.</p></div></div>
      <div className={`dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]) }}>
        {file ? <><div className="file-icon"><FileArchive /></div><div className="file-info"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to transform</span></div><button className="icon-button" aria-label="Remove file" onClick={() => setFile(null)}><X /></button></> : <><div className="upload-icon"><Upload /></div><div><strong>Drop your ebook here</strong><span>or click to browse from your device</span></div><button className="button secondary" onClick={() => inputRef.current?.click()}><Upload data-icon="inline-start" /> Upload file</button><button className="sample-link" onClick={async () => { setError(''); setProgress('Loading Alice in Wonderland…'); try { const response = await fetch('/api/sample'); if (!response.ok) throw new Error('Could not load the sample ebook.'); const blob = await response.blob(); chooseFile(new File([blob], 'Alice in Wonderland.epub', { type: 'application/epub+zip' })) } catch (e) { setError(e instanceof Error ? e.message : 'Could not load the sample ebook.') } finally { setProgress('') } }}>Use Alice in Wonderland</button><input ref={inputRef} type="file" accept=".epub,application/epub+zip" hidden onChange={e => chooseFile(e.target.files?.[0])} /></>}
      </div>
      {progress && !processing && <div className="sample-loading">{progress}</div>}
      {error && <div className="error"><X />{error}</div>}
      <div className="step second"><span className="step-number">02</span><div><h2>Choose your reading font</h2><p>We&apos;ll create a clean, comfortable edition for you.</p></div></div>
      <div className="font-grid">{choices.map(choice => <div key={choice.id} className="font-card" style={{ fontFamily: choice.id === 'atkinson' ? '"Atkinson Hyperlegible", sans-serif' : choice.id === 'lexend' ? 'Lexend, sans-serif' : '"OpenDyslexic", "Comic Sans MS", sans-serif' }}><button className="font-card-main" disabled={!file || !!processing} onClick={() => convert(choice.id)}><span className={`font-preview ${choice.id}`} aria-hidden="true">Aa</span><span className="font-card-copy"><strong className={`font-name ${choice.id}`}>{choice.name}</strong><small>{choice.detail}</small><i>{choice.sample}</i></span><span className="arrow">→</span></button><a className="font-info" href={`/font-sample/${choice.id}`} aria-label={`Read a sample in ${choice.name}`}><Info /></a></div>)}<div className="font-card all-card" style={{ fontFamily: '"Atkinson Hyperlegible", sans-serif' }}><button className="font-card-main" disabled={!file || !!processing} onClick={() => convert('all')}><span className="font-preview all-preview"><Sparkles /></span><span className="font-card-copy"><strong>Generate all 3</strong><small>Try every font and choose your favorite</small><i>Three polished editions, one download</i></span><span className="arrow">→</span></button></div></div>
      {processing && <div className="processing"><LoaderCircle className="spinner" /><div><strong>{progress}</strong><span>This usually takes less than a minute. Please keep this tab open.</span></div></div>}
      {results.length > 0 && <div className="results"><div className="results-heading"><div><span className="success-dot"><Check /></span><h2>Your ebook is ready</h2><p>Your download started automatically. Your files remain in this browser session only.</p></div><div className="result-actions">{results.map(result => <a className="button primary" href={result.url} download={result.name} key={result.name}><Download data-icon="inline-start" /> {results.length > 1 ? result.font : 'Download ebook'}</a>)}</div></div><p className="hash-note">Revisit these files any time using your hash link: <code>{results[0].url.split('hash=')[1]?.split('&')[0]}</code></p></div>}
    </section>
    <footer><span><Heart /> Made for more comfortable reading</span><span><a href="/faq">FAQ</a><a href="/terms">Terms</a><span>EPUB in · accessible EPUB out</span></span></footer>
  </main>
}

