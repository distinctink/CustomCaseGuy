import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const SHOP_LINKS = [
  { href: '/shop-by-case', label: 'Shop by Case' },
  { href: '/shop-by-design', label: 'Shop by Design' },
  { href: '/design-editor', label: 'Design Your Own' },
]

const COLLECTION_LINKS = [
  { href: '/shop-by-design?collection=florals', label: 'Florals' },
  { href: '/shop-by-design?collection=marble', label: 'Marble' },
  { href: '/shop-by-design?collection=geometric', label: 'Geometric' },
  { href: '/shop-by-design?collection=camo', label: 'Camo' },
  { href: '/shop-by-design?collection=celestial', label: 'Celestial' },
  { href: '/shop-by-design?collection=minimalist', label: 'Minimalist' },
]

const INFO_LINKS = [
  { href: '/about', label: 'About Us' },
  { href: '/faq', label: 'FAQ' },
  { href: '/shipping', label: 'Shipping & Returns' },
  { href: '/contact', label: 'Contact' },
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms of Service' },
]

export function Footer() {
  return (
    <footer className="bg-charcoal border-t border-mid-gray/20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="lg:col-span-1">
            <Logo />
            <p className="mt-4 text-light-gray text-sm font-body leading-relaxed">
              Custom-printed phone cases designed & printed in the USA. Printed in-house
              on genuine OtterBox and premium cases. 12+ years, 400K+ products sold.
            </p>
            <div className="flex gap-4 mt-6">
              <SocialIcon label="Instagram" href="https://instagram.com/customcaseguy">
                <path d="M7.8 2h8.4C19.4 2 22 4.6 22 7.8v8.4a5.8 5.8 0 0 1-5.8 5.8H7.8C4.6 22 2 19.4 2 16.2V7.8A5.8 5.8 0 0 1 7.8 2m-.2 2A3.6 3.6 0 0 0 4 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 0 0 3.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 0 1 1.25 1.25A1.25 1.25 0 0 1 17.25 8 1.25 1.25 0 0 1 16 6.75a1.25 1.25 0 0 1 1.25-1.25M12 7a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5m0 2a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3Z" />
              </SocialIcon>
              <SocialIcon label="Facebook" href="https://facebook.com/customcaseguy">
                <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
              </SocialIcon>
              <SocialIcon label="TikTok" href="https://tiktok.com/@customcaseguy">
                <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
              </SocialIcon>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="font-display font-700 text-sm uppercase tracking-wider text-white mb-4">
              Shop
            </h3>
            <ul className="space-y-3">
              {SHOP_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-light-gray text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Collections */}
          <div>
            <h3 className="font-display font-700 text-sm uppercase tracking-wider text-white mb-4">
              Collections
            </h3>
            <ul className="space-y-3">
              {COLLECTION_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-light-gray text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Info */}
          <div>
            <h3 className="font-display font-700 text-sm uppercase tracking-wider text-white mb-4">
              Info
            </h3>
            <ul className="space-y-3">
              {INFO_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-light-gray text-sm hover:text-white transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-16 pt-8 border-t border-mid-gray/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-mid-gray text-xs">
            &copy; {new Date().getFullYear()} CustomCaseGuy. All rights reserved. Designed &amp; printed in the USA.
          </p>
          <p className="text-mid-gray text-xs">
            Printed in-house on genuine cases.
          </p>
        </div>
      </div>
    </footer>
  )
}

function SocialIcon({
  label,
  href,
  children,
}: {
  label: string
  href: string
  children: React.ReactNode
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-9 h-9 rounded-lg bg-dark-gray flex items-center justify-center text-light-gray hover:text-hot-pink hover:bg-dark-gray/80 transition-all"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </a>
  )
}
