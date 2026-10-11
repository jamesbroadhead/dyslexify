import { NextResponse } from 'next/server'

const GUTENBERG_EPUB = 'https://www.gutenberg.org/cache/epub/11/pg11-images.epub'

export async function GET() {
  const response = await fetch(GUTENBERG_EPUB, { headers: { Accept: 'application/epub+zip' }, next: { revalidate: 86400 } })
  if (!response.ok) return NextResponse.json({ error: 'The sample ebook is temporarily unavailable.' }, { status: 502 })

  return new NextResponse(await response.arrayBuffer(), {
    headers: {
      'Content-Type': 'application/epub+zip',
      'Content-Disposition': 'inline; filename="Alice in Wonderland.epub"',
      'Cache-Control': 'no-store',
    },
  })
}
