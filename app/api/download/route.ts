import { NextResponse } from 'next/server'
import { getStored } from '../convert/route'

export async function GET(request: Request) {
  const url = new URL(request.url); const hash = url.searchParams.get('hash'); const font = url.searchParams.get('font')
  if (!hash || !font) return new NextResponse('Missing download link.', { status: 400 })
  const stored = getStored(hash); const file = stored?.files.find(item => item.font === font)
  if (!file) return new NextResponse('This download has expired or does not exist.', { status: 404 })
  return new NextResponse(new Uint8Array(file.data), { headers: { 'Content-Type': 'application/epub+zip', 'Content-Disposition': `attachment; filename="${file.name}"`, 'Cache-Control': 'private, max-age=0' } })
}
