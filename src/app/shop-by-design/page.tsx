'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { COLLECTIONS } from '@/lib/constants'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { SAMPLE_DESIGNS } from '@/lib/sample-data'

export default function ShopByDesignPage() {
  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('popular')

  const designs = useMemo(() => {
    let filtered = SAMPLE_DESIGNS
    if (selectedCollection) {
      filtered = filtered.filter((d) => d.collectionId === selectedCollection)
    }
    // Deduplicate by base design name + colorway
    return filtered
  }, [selectedCollection])

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Shop by Design"
          subtitle="Browse 400+ designs across 15 collections. Find the artwork, then pick your case."
        />

        {/* Collection filter bar */}
        <div className="flex flex-wrap gap-2 mb-8">
          <button
            onClick={() => setSelectedCollection(null)}
            className={`px-4 py-2 rounded-xl text-sm font-display font-600 transition-all cursor-pointer ${
              !selectedCollection
                ? 'bg-hot-pink text-white'
                : 'bg-dark-gray text-light-gray hover:text-white'
            }`}
          >
            All Designs
          </button>
          {COLLECTIONS.map((col) => (
            <button
              key={col.id}
              onClick={() => setSelectedCollection(col.id)}
              className={`px-4 py-2 rounded-xl text-sm font-display font-600 transition-all cursor-pointer ${
                selectedCollection === col.id
                  ? 'bg-hot-pink text-white'
                  : 'bg-dark-gray text-light-gray hover:text-white'
              }`}
            >
              {col.icon} {col.name.split(' & ')[0]}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center justify-between mb-8">
          <p className="text-light-gray text-sm font-body">
            {designs.length} design{designs.length !== 1 ? 's' : ''}
          </p>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-dark-gray text-light-gray text-sm rounded-xl px-4 py-2 border border-mid-gray/20 font-body cursor-pointer"
          >
            <option value="popular">Popular</option>
            <option value="new">New Arrivals</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {/* Design Grid (artwork only, no cases) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-6">
          {designs.map((design) => (
            <Link
              key={design.slug}
              href={`/shop-by-design/${design.slug}`}
              className="group block"
            >
              <div className="relative overflow-hidden rounded-2xl bg-charcoal border border-mid-gray/10 transition-all duration-300 group-hover:border-hot-pink/30 group-hover:shadow-lg group-hover:shadow-hot-pink/5 group-hover:-translate-y-1">
                {/* Artwork preview */}
                <div className="aspect-[1/2] bg-dark-gray overflow-hidden">
                  <div
                    className="w-full h-full bg-gradient-to-br from-hot-pink/10 to-soft-pink/5 transition-transform duration-500 group-hover:scale-105 flex items-center justify-center"
                  >
                    <span className="text-mid-gray text-xs font-body text-center px-4">
                      {design.colorwayName}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <p className="text-xs text-hot-pink font-display font-600 uppercase tracking-wider mb-0.5">
                    {design.collection}
                  </p>
                  <h3 className="font-display font-700 text-white text-sm truncate">
                    {design.name}
                  </h3>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {designs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-light-gray text-lg font-body">
              No designs found in this collection yet.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
