import type { Metadata } from 'next'
import { Inter, Lora } from 'next/font/google'
import './globals.css'

const sans = Inter({ subsets: ['latin'], variable: '--font-sans' })
const serif = Lora({ subsets: ['latin'], variable: '--font-serif' })

export const metadata: Metadata = {
  title: 'Conforme',
  description: 'Distribución de recibos de sueldo con conformidad del empleado.',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Conforme', statusBarStyle: 'default' },
}

export const viewport = {
  themeColor: '#fbf7ef',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="es" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  )
}
