import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: {
    default: 'CustomCaseGuy — Your Case. Your Design. Your Rules.',
    template: '%s | CustomCaseGuy',
  },
  description:
    'Custom-printed phone cases designed & printed in the USA. Printed on genuine OtterBox, MagSafe, and clear cases. Design your own or choose from 400+ designs.',
  keywords: [
    'custom phone case',
    'OtterBox custom',
    'phone case design',
    'personalized case',
    'CustomCaseGuy',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'CustomCaseGuy',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
