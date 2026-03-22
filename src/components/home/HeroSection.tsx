'use client'

import { Button } from '@/components/ui/Button'

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden pt-16">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 -left-1/4 w-[600px] h-[600px] rounded-full bg-hot-pink/8 blur-[120px]" />
        <div className="absolute bottom-1/4 right-0 w-[500px] h-[500px] rounded-full bg-soft-pink/6 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text Content */}
          <div>
            <div className="inline-flex items-center gap-2 bg-dark-gray/80 border border-mid-gray/20 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 rounded-full bg-hot-pink animate-pulse" />
              <span className="text-light-gray text-sm font-body">
                Printed In-House in the USA
              </span>
            </div>

            <h1 className="font-display font-800 text-5xl sm:text-6xl lg:text-7xl leading-tight tracking-normal">
              Your Case.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-hot-pink to-soft-pink">
                Your Design.
              </span>{' '}
              Your Rules.
            </h1>

            <p className="mt-6 text-light-gray text-lg sm:text-xl font-body font-300 max-w-lg leading-relaxed">
              Custom-printed on genuine OtterBox and premium cases.
              Choose from 400+ designs or create your own with our live editor.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Button href="/shop-by-design" size="lg">
                Browse Designs
              </Button>
              <Button href="/design-editor" variant="outline" size="lg">
                Design Your Own
              </Button>
            </div>

            {/* Mini trust bar */}
            <div className="mt-12 flex flex-wrap gap-6 text-mid-gray text-sm font-body">
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>
                Genuine OtterBox
              </span>
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>
                24-48hr Turnaround
              </span>
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                Free Shipping
              </span>
            </div>
          </div>

          {/* Right: Floating phone mockups (placeholder) */}
          <div className="hidden lg:block relative">
            <div className="relative h-[600px]">
              {/* Phone 1 - center */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[480px] rounded-[2.5rem] bg-gradient-to-br from-charcoal to-dark-gray border border-mid-gray/20 shadow-2xl shadow-hot-pink/10 animate-float">
                <div className="absolute inset-3 rounded-[2rem] bg-gradient-to-br from-hot-pink/20 to-soft-pink/10 flex items-center justify-center">
                  <span className="text-light-gray text-sm font-body">Rose Garden</span>
                </div>
              </div>

              {/* Phone 2 - left */}
              <div className="absolute top-1/3 left-0 w-[200px] h-[400px] rounded-[2rem] bg-gradient-to-br from-charcoal to-dark-gray border border-mid-gray/20 shadow-xl rotate-[-8deg] animate-float-delayed opacity-80">
                <div className="absolute inset-3 rounded-[1.5rem] bg-gradient-to-br from-soft-pink/15 to-warm-pink/10 flex items-center justify-center">
                  <span className="text-light-gray text-xs font-body">Midnight Bloom</span>
                </div>
              </div>

              {/* Phone 3 - right */}
              <div className="absolute top-[45%] right-0 w-[200px] h-[400px] rounded-[2rem] bg-gradient-to-br from-charcoal to-dark-gray border border-mid-gray/20 shadow-xl rotate-[8deg] animate-float-slow opacity-80">
                <div className="absolute inset-3 rounded-[1.5rem] bg-gradient-to-br from-hot-pink/10 to-charcoal flex items-center justify-center">
                  <span className="text-light-gray text-xs font-body">Cherry Blossom</span>
                </div>
              </div>

              {/* Glow behind phones */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-hot-pink/10 blur-[80px]" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-primary-black to-transparent" />
    </section>
  )
}
