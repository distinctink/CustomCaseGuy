import type { Metadata } from 'next'
import './globals.css'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import { CookieConsent } from '@/components/ui/CookieConsent'
import { CartProvider } from '@/lib/cart-context'
import { CartDrawer } from '@/components/ui/CartDrawer'

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
        <CartProvider>
          <Navbar />
          <main id="main-content" className="flex-1">{children}</main>
          <Footer />
          <CartDrawer />
          <CookieConsent />
        </CartProvider>
      </body>
    </html>
  )
}
