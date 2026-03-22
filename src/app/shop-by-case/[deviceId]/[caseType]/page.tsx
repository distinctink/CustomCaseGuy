'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { DEVICES, CASE_TYPES, COLLECTIONS } from '@/lib/constants'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { CaseCard } from '@/components/ui/CaseCard'
import { Button } from '@/components/ui/Button'
import { SAMPLE_DESIGNS } from '@/lib/sample-data'
import { notFound } from 'next/navigation'

export default function DesignBrowsePage({
  params,
}: {
  params: Promise<{ deviceId: string; caseType: string }>
}) {
  const { deviceId, caseType: caseTypeId } = use(params)
  const device = DEVICES.find((d) => d.id === deviceId)
  const caseType = CASE_TYPES.find((c) => c.id === caseTypeId)
  if (!device || !caseType) notFound()

  const [selectedCollection, setSelectedCollection] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState('popular')

  const designs = useMemo(() => {
    let filtered = SAMPLE_DESIGNS
    if (selectedCollection) {
      filtered = filtered.filter((d) => d.collectionId === selectedCollection)
    }
    return filtered
  }, [selectedCollection])

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-light-gray">
          <Link href="/shop-by-case" className="hover:text-white transition-colors">
            Shop by Case
          </Link>
          <span className="text-mid-gray">/</span>
          <Link href={`/shop-by-case/${deviceId}`} className="hover:text-white transition-colors">
            {device.name}
          </Link>
          <span className="text-mid-gray">/</span>
          <span className="text-white">{caseType.name}</span>
        </nav>

        <SectionHeading
          title={`${caseType.name} for ${device.name}`}
          subtitle="Step 3: Pick your design"
        />

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-8 items-center justify-between">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedCollection(null)}
              className={`px-4 py-2 rounded-xl text-sm font-display font-600 transition-all cursor-pointer ${
                !selectedCollection
                  ? 'bg-hot-pink text-white'
                  : 'bg-dark-gray text-light-gray hover:text-white'
              }`}
            >
              All
            </button>
            {COLLECTIONS.slice(0, 8).map((col) => (
              <button
                key={col.id}
                onClick={() => setSelectedCollection(col.id)}
                className={`px-4 py-2 rounded-xl text-sm font-display font-600 transition-all cursor-pointer ${
                  selectedCollection === col.id
                    ? 'bg-hot-pink text-white'
                    : 'bg-dark-gray text-light-gray hover:text-white'
                }`}
              >
                {col.name.split(' & ')[0]}
              </button>
            ))}
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-dark-gray text-light-gray text-sm rounded-xl px-4 py-2 border border-mid-gray/20 font-body cursor-pointer"
          >
            <option value="popular">Popular</option>
            <option value="new">New Arrivals</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>

        {/* Design Your Own CTA */}
        <div className="mb-8 p-4 rounded-2xl bg-gradient-to-r from-hot-pink/10 to-soft-pink/5 border border-hot-pink/20 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="font-display font-700 text-white text-sm">
              Don&apos;t see what you want?
            </p>
            <p className="text-light-gray text-sm font-body">
              Design your own custom case from scratch
            </p>
          </div>
          <Button href="/design-editor" variant="outline" size="sm">
            Open Editor
          </Button>
        </div>

        {/* Design Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
          {designs.map((design) => (
            <CaseCard
              key={design.slug}
              designSlug={design.slug}
              designName={design.name}
              collectionName={design.collection}
              price={caseType.price}
              mockupUrl={`/api/placeholder/mockup/${design.slug}`}
              href={`/product/${design.slug}?case=${caseTypeId}&device=${deviceId}`}
            />
          ))}
        </div>

        {designs.length === 0 && (
          <div className="text-center py-20">
            <p className="text-light-gray text-lg font-body">
              No designs found in this collection yet.
            </p>
            <Button
              onClick={() => setSelectedCollection(null)}
              variant="outline"
              className="mt-4"
            >
              View All Designs
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
