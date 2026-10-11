import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = { title: 'dyslexify — A kinder way to read', description: 'Convert your ebooks into more comfortable, accessible reading editions.' }

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en"><body>{children}</body></html> }
