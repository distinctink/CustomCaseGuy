'use client'

import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'

const PATHS = [
  {
    title: 'Shop by Case',
    description:
      'Pick your device, choose a case type, then browse every design that fits. See exactly how it looks on YOUR phone.',
    cta: 'Choose Your Case',
    href: '/shop-by-case',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>
      </svg>
    ),
    gradient: 'from-hot-pink/20 to-transparent',
  },
  {
    title: 'Shop by Design',
    description:
      'Browse 400+ designs across 15 collections. Find the perfect artwork, then pick any case to put it on.',
    cta: 'Browse Designs',
    href: '/shop-by-design',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
    ),
    gradient: 'from-soft-pink/20 to-transparent',
  },
  {
    title: 'Start From Scratch',
    description:
      'Upload your own image, add text, pick fonts and colors. Our live editor lets you design a truly one-of-a-kind case.',
    cta: 'Open Editor',
    href: '/design-editor',
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/>
      </svg>
    ),
    gradient: 'from-warm-pink/20 to-transparent',
  },
]

export function ThreePathCards() {
  return (
    <section className="py-24 relative">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Three Ways to Shop"
          subtitle="However you like to shop, we've got you covered."
        />

        <div className="grid md:grid-cols-3 gap-6">
          {PATHS.map((path) => (
            <div
              key={path.title}
              className="group relative rounded-2xl bg-charcoal border border-mid-gray/10 p-8 transition-all duration-300 hover:border-hot-pink/30 hover:shadow-lg hover:shadow-hot-pink/5 hover:-translate-y-1 overflow-hidden"
            >
              {/* Background gradient */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${path.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
              />

              <div className="relative">
                {/* Icon */}
                <div className="w-14 h-14 rounded-xl bg-dark-gray flex items-center justify-center text-hot-pink mb-6 group-hover:bg-hot-pink/10 transition-colors">
                  {path.icon}
                </div>

                <h3 className="font-display font-700 text-xl text-white mb-3">
                  {path.title}
                </h3>

                <p className="text-light-gray text-sm font-body leading-relaxed mb-8">
                  {path.description}
                </p>

                <Button href={path.href} variant="outline" size="sm">
                  {path.cta}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
