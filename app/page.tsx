'use client'

import { useRef, useState } from 'react'
import { Check, Download, FileArchive, FileText, Heart, LoaderCircle, LockKeyhole, Sparkles, Upload, X } from 'lucide-react'

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
      const body = new FormData(); body.append('file', file); body.append('font', font)
      setTimeout(() => setProgress(font === 'all' ? 'Applying each reading font…' : 'Applying your reading font…'), 550)
      const response = await fetch('/api/convert', { method: 'POST', body })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Something went wrong.')
      setResults(data.files)
      data.files.forEach((item: Result, index: number) => setTimeout(() => {
        const link = document.createElement('a'); link.href = item.url; link.download = item.name; link.click()
      }, index * 500))
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to convert this file.') }
    finally { setProcessing(null); setProgress('') }
  }

  return <main className="shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Sparkles /></span><span>dyslexify</span></a><span className="privacy"><LockKeyhole /> files are never saved</span></header>
    <section className="hero"><p className="eyebrow">A kinder way to read</p><h1>Make any ebook<br /><em>easier to read.</em></h1><p className="lede">Upload an ebook and get a beautifully typeset copy in a font that works for you. Your original file is checked, converted, and then forgotten.</p></section>
    <section className="workspace">
      <div className="step"><span className="step-number">01</span><div><h2>Upload your ebook</h2><p>EPUB files up to 50 MB. Nothing is stored.</p></div></div>
      <div className={`dropzone ${dragging ? 'is-dragging' : ''} ${file ? 'has-file' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); chooseFile(e.dataTransfer.files[0]) }}>
        {file ? <><div className="file-icon"><FileArchive /></div><div className="file-info"><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to transform</span></div><button className="icon-button" aria-label="Remove file" onClick={() => setFile(null)}><X /></button></> : <><div className="upload-icon"><Upload /></div><div><strong>Drop your ebook here</strong><span>or click to browse from your device</span></div><button className="button secondary" onClick={() => inputRef.current?.click()}><Upload data-icon="inline-start" /> Upload file</button><input ref={inputRef} type="file" accept=".epub,application/epub+zip" hidden onChange={e => chooseFile(e.target.files?.[0])} /></>}
      </div>
      {error && <div className="error"><X />{error}</div>}
      <div className="step second"><span className="step-number">02</span><div><h2>Choose your reading font</h2><p>We&apos;ll create a clean, comfortable edition for you.</p></div></div>
      <div className="font-grid">{choices.map(choice => <button key={choice.id} className="font-card" style={{ fontFamily: choice.id === 'atkinson' ? '"Atkinson Hyperlegible", sans-serif' : choice.id === 'lexend' ? 'Lexend, sans-serif' : '"OpenDyslexic", "Comic Sans MS", sans-serif' }} disabled={!file || !!processing} onClick={() => convert(choice.id)}><span className={`font-preview ${choice.id}`} aria-hidden="true">Aa</span><span className="font-card-copy"><strong className={`font-name ${choice.id}`}>{choice.name}</strong><small>{choice.detail}</small><i>{choice.sample}</i></span><span className="arrow">→</span></button>)}<button className="font-card all-card" style={{ fontFamily: '"Atkinson Hyperlegible", sans-serif' }} disabled={!file || !!processing} onClick={() => convert('all')}><span className="font-preview all-preview"><Sparkles /></span><span className="font-card-copy"><strong>Generate all 3</strong><small>Try every font and choose your favorite</small><i>Three polished editions, one download</i></span><span className="arrow">→</span></button></div>
      {processing && <div className="processing"><LoaderCircle className="spinner" /><div><strong>{progress}</strong><span>This usually takes less than a minute. Please keep this tab open.</span></div></div>}
      {results.length > 0 && <div className="results"><div className="results-heading"><div><span className="success-dot"><Check /></span><h2>Your ebook is ready</h2><p>Your download started automatically. Links stay live for 24 hours.</p></div><div className="result-actions">{results.map(result => <a className="button primary" href={result.url} download={result.name} key={result.name}><Download data-icon="inline-start" /> {results.length > 1 ? result.font : 'Download ebook'}</a>)}</div></div><p className="hash-note">Revisit these files any time using your hash link: <code>{results[0].url.split('hash=')[1]?.split('&')[0]}</code></p></div>}
    </section>
    <footer><span><Heart /> Made for more comfortable reading</span><span>EPUB in · accessible EPUB out</span></footer>
  </main>
}

