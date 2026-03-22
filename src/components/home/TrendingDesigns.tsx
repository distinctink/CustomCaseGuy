'use client'

import { SectionHeading } from '@/components/ui/SectionHeading'
import { CaseCard } from '@/components/ui/CaseCard'

// Placeholder trending designs until DB is connected
const TRENDING = [
  { slug: 'rose-garden-a', name: 'Rose Garden', collection: 'Florals', price: 49.99 },
  { slug: 'midnight-bloom-a', name: 'Midnight Bloom', collection: 'Florals', price: 49.99 },
  { slug: 'cherry-blossom-a', name: 'Cherry Blossom', collection: 'Florals', price: 49.99 },
  { slug: 'peony-burst-a', name: 'Peony Burst', collection: 'Florals', price: 49.99 },
  { slug: 'tropical-paradise-a', name: 'Tropical Paradise', collection: 'Florals', price: 49.99 },
  { slug: 'dahlia-explosion-a', name: 'Dahlia Explosion', collection: 'Florals', price: 49.99 },
  { slug: 'eucalyptus-cascade-a', name: 'Eucalyptus Cascade', collection: 'Florals', price: 49.99 },
  { slug: 'magnolia-branch-a', name: 'Magnolia Branch', collection: 'Florals', price: 49.99 },
]

export function TrendingDesigns() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Trending Now"
          subtitle="Our most popular designs this week"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {TRENDING.map((design) => (
            <CaseCard
              key={design.slug}
              designSlug={design.slug}
              designName={design.name}
              collectionName={design.collection}
              price={design.price}
              mockupUrl={`/api/placeholder/mockup/${design.slug}`}
              href={`/product/${design.slug}?case=symmetry&device=ip17pm`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
