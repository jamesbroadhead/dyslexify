import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const samples = {
  atkinson: { name: 'Atkinson Hyperlegible', className: 'sample-atkinson' },
  opendyslexic: { name: 'OpenDyslexic', className: 'sample-opendyslexic' },
  lexend: { name: 'Lexend', className: 'sample-lexend' },
} as const

const passage = [
  'Dorothy lived in the midst of the great Kansas prairies, with Uncle Henry, who was a farmer, and Aunt Em, who was the farmer’s wife.',
  'Their house was small, for the lumber to build it had to be carried by wagon many miles. There were four walls, a floor and a roof, which made one room; and this room contained a rusty cookstove, a cupboard for the dishes, a table, three or four chairs, and the beds.',
  'When Dorothy stood in the doorway and looked around, she could see nothing but the great gray prairie on every side. Not a tree nor a house broke the broad sweep of flat country that reached to the edge of the sky.',
  'The sun had baked the plowed land into a gray mass, with little cracks running through it. Even the grass was not green, for the sun had burned the tops of the long blades until they were the same gray color to be seen everywhere.',
  'Once the house had been painted, but the sun blistered the paint and the rains washed it away, and now the house was as dull and gray as everything else.',
  'When Aunt Em came there she was a young, pretty wife. The sun and wind had changed her, too. They had taken the sparkle from her eyes and left them a sober gray; they had taken the red from her cheeks and lips, and they were gray also.',
] as const

export default async function FontSample({ params }: { params: Promise<{ font: string }> }) {
  const { font: fontId } = await params
  const font = samples[fontId as keyof typeof samples] ?? samples.atkinson
  return <main className="sample-page">
    <header className="sample-header"><Link className="back-link" href="/"><ArrowLeft data-icon="inline-start" /> Back to dyslexify</Link><span>Reading preview</span></header>
    <article className={`sample-reading ${font.className}`}>
      <p className="sample-kicker">A reading sample from <em>The Wonderful Wizard of Oz</em></p>
      <h1>{font.name}</h1>
      <p className="sample-intro">Notice how this typeface feels on a longer page of text.</p>
      <div className="sample-copy"><h2>The Cyclone</h2>{passage.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
    </article>
  </main>
}
