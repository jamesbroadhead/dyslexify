import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'dyslexify — A kinder way to read', description: 'Make an accessible Kindle AZW3 with embedded fonts, locally in your browser.' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
