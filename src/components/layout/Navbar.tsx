'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'
import { useCart } from '@/lib/cart-context'
import { SAMPLE_DESIGNS } from '@/lib/sample-data'

const NAV_LINKS = [
  { href: '/shop-by-case', label: 'Shop by Case' },
  { href: '/shop-by-design', label: 'Shop by Design' },
  { href: '/design-editor', label: 'Start From Scratch' },
]

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { totalItems, setIsOpen: setCartOpen } = useCart()

  // Search state
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const searchResults = searchQuery.trim().length >= 2
    ? SAMPLE_DESIGNS.filter(
        (d) =>
          d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.collection.toLowerCase().includes(searchQuery.toLowerCase()) ||
          d.colorwayName.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 8)
    : []

  useEffect(() => {
    if (searchOpen) {
      searchInputRef.current?.focus()
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      setSearchQuery('')
    }
    return () => { document.body.style.overflow = '' }
  }, [searchOpen])

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSearchOpen(false)
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-primary-black/90 backdrop-blur-md border-b border-mid-gray/20">
        {/* Skip to content link for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-hot-pink focus:text-white focus:rounded-lg focus:font-display focus:font-600 focus:text-sm"
        >
          Skip to main content
        </a>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            {/* Logo */}
            <Link href="/" className="flex-shrink-0">
              <Logo />
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="font-display text-sm font-600 text-light-gray hover:text-white transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* Right side: Search + Cart */}
            <div className="flex items-center gap-4">
              {/* Search */}
              <button
                aria-label="Search designs"
                onClick={() => setSearchOpen(true)}
                className="text-light-gray hover:text-white transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </button>

              {/* Cart */}
              <button
                aria-label="Open cart"
                onClick={() => setCartOpen(true)}
                className="relative text-light-gray hover:text-white transition-colors cursor-pointer"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="8" cy="21" r="1" />
                  <circle cx="19" cy="21" r="1" />
                  <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
                </svg>
                {totalItems > 0 && (
                  <span className="absolute -top-2 -right-2 bg-hot-pink text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                    {totalItems}
                  </span>
                )}
              </button>

              {/* Mobile menu button */}
              <button
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                className="md:hidden text-light-gray hover:text-white transition-colors cursor-pointer"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18" /><path d="m6 6 12 12" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileOpen && (
          <div className="md:hidden bg-charcoal border-t border-mid-gray/20">
            <nav className="flex flex-col px-4 py-4 gap-1">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="font-display text-base font-600 text-light-gray hover:text-white hover:bg-dark-gray rounded-lg px-4 py-3 transition-colors duration-200"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Search Modal */}
      {searchOpen && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm"
            onClick={() => setSearchOpen(false)}
            aria-hidden
          />
          <div className="fixed top-0 left-0 right-0 z-[60] flex justify-center pt-[15vh] px-4">
            <div className="w-full max-w-lg bg-charcoal rounded-2xl border border-mid-gray/20 shadow-2xl overflow-hidden">
              {/* Search input */}
              <div className="flex items-center gap-3 px-5 py-4 border-b border-mid-gray/20">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mid-gray flex-shrink-0">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search designs, collections..."
                  className="flex-1 bg-transparent text-white font-body text-sm placeholder:text-mid-gray focus:outline-none"
                />
                <kbd className="hidden sm:inline-block text-mid-gray text-xs font-body border border-mid-gray/30 rounded px-1.5 py-0.5">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-80 overflow-y-auto">
                {searchQuery.trim().length < 2 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-mid-gray text-sm font-body">
                      Type at least 2 characters to search
                    </p>
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="px-5 py-6 text-center">
                    <p className="text-light-gray text-sm font-body">
                      No designs found for &ldquo;{searchQuery}&rdquo;
                    </p>
                    <Link
                      href="/design-editor"
                      onClick={() => setSearchOpen(false)}
                      className="text-hot-pink text-sm font-display font-600 hover:underline mt-2 inline-block"
                    >
                      Create a custom design instead
                    </Link>
                  </div>
                ) : (
                  <ul>
                    {searchResults.map((design) => (
                      <li key={design.slug}>
                        <Link
                          href={`/product/${design.slug}`}
                          onClick={() => setSearchOpen(false)}
                          className="flex items-center gap-4 px-5 py-3 hover:bg-dark-gray/50 transition-colors"
                        >
                          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-hot-pink/10 to-soft-pink/5 border border-mid-gray/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-mid-gray text-[8px] font-body">
                              {design.colorwayName.charAt(0)}
                            </span>
                          </div>
                          <div className="min-w-0">
                            <p className="text-white text-sm font-display font-600 truncate">
                              {design.name}
                            </p>
                            <p className="text-mid-gray text-xs font-body truncate">
                              {design.collection} · {design.colorwayName}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
