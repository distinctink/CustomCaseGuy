'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'

// All uploaded trending design images
const TRENDING_IMAGES = [
  'classic-marble-a.png',
  'chevron-bold-a.png',
  'classic-marble-b.png',
  'color-block-a.png',
  'cottage-garden-a.png',
  'dahlia-explosion-a.png',
  'dragonfly-b.png',
  'fluid-pour-c.png',
  'gold-vein-marble-a.png',
  'golden-retriever-a.png',
  'gradient-mesh-c.png',
  'hummingbird-a.png',
  'hummingbird-b.png',
  'ink-flow-b.png',
  'marble-swirl-a.png',
  'midnight-bloom-a.png',
  'mountain-range-a.png',
  'noise-gradient-a.png',
  'northern-lights-b.png',
  'palm-sunset-b.png',
  'paper-collage-b.png',
  'polka-dot-b.png',
  'sea-turtle-a.png',
  'snow-camo-c.png',
  'stripe-a.png',
  'victorian-toile-c.png',
  'watercolor-wash-a.png',
  'watercolor-wash-c.png',
  'wildfire-sky-b.png',
  'wildflower-meadow-c.png',
  'woven-texture-a.png',
]

function pickRandom(arr: string[], count: number): string[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}

export function CtaSection() {
  const featured = useMemo(() => pickRandom(TRENDING_IMAGES, 5), [])

  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full bg-hot-pink/8 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Mini case mockups row — randomly rotated from trending uploads */}
        <div className="flex justify-center gap-4 mb-12">
          {featured.map((filename, i) => (
            <div
              key={filename}
              className="w-16 h-32 sm:w-20 sm:h-40 rounded-2xl border border-mid-gray/20 shadow-lg overflow-hidden relative bg-gradient-to-br from-charcoal to-dark-gray"
              style={{
                transform: `rotate(${(i - 2) * 8}deg) translateY(${Math.abs(i - 2) * 8}px)`,
              }}
            >
              <Image
                src={`/images/trending/${filename}`}
                alt={filename.replace(/\.png$/, '').replace(/-/g, ' ')}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          ))}
        </div>

        <div className="text-center">
          <h2 className="font-display font-800 text-4xl sm:text-5xl lg:text-6xl text-white mb-6">
            Ready to Make It{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-hot-pink to-soft-pink">
              Yours
            </span>
            ?
          </h2>
          <p className="text-light-gray text-lg font-body font-300 max-w-xl mx-auto mb-10">
            Join 400,000+ happy customers. Design your perfect case today.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Button href="/shop-by-design" size="lg">
              Browse Designs
            </Button>
            <Button href="/design-editor" variant="outline" size="lg">
              Design Your Own
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
