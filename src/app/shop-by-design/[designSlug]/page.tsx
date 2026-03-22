'use client'

import { use } from 'react'
import Link from 'next/link'
import { CASE_TYPES } from '@/lib/constants'
import { SAMPLE_DESIGNS } from '@/lib/sample-data'
import { Button } from '@/components/ui/Button'
import { notFound } from 'next/navigation'

export default function DesignDetailPage({
  params,
}: {
  params: Promise<{ designSlug: string }>
}) {
  const { designSlug } = use(params)
  const design = SAMPLE_DESIGNS.find((d) => d.slug === designSlug)
  if (!design) notFound()

  // Find other colorways
  const baseName = design.name
  const colorways = SAMPLE_DESIGNS.filter(
    (d) => d.name === baseName && d.collectionId === design.collectionId
  )

  const phoneCases = CASE_TYPES.filter((c) => c.id !== 'ipad-defender')

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-light-gray">
          <Link href="/shop-by-design" className="hover:text-white transition-colors">
            Shop by Design
          </Link>
          <span className="text-mid-gray">/</span>
          <Link
            href={`/shop-by-design?collection=${design.collectionId}`}
            className="hover:text-white transition-colors"
          >
            {design.collection}
          </Link>
          <span className="text-mid-gray">/</span>
          <span className="text-white">{design.name}</span>
        </nav>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Left: Large artwork preview */}
          <div>
            <div className="aspect-[1/2] rounded-3xl bg-dark-gray border border-mid-gray/10 overflow-hidden flex items-center justify-center">
              <div className="w-full h-full bg-gradient-to-br from-hot-pink/10 to-soft-pink/5 flex items-center justify-center">
                <div className="text-center">
                  <p className="text-light-gray text-lg font-display font-700">
                    {design.name}
                  </p>
                  <p className="text-mid-gray text-sm font-body mt-2">
                    {design.colorwayName}
                  </p>
                </div>
              </div>
            </div>

            {/* Colorway swatches */}
            {colorways.length > 1 && (
              <div className="mt-4">
                <p className="text-light-gray text-sm font-body mb-2">
                  Colorways:
                </p>
                <div className="flex gap-2">
                  {colorways.map((cw) => (
                    <Link
                      key={cw.slug}
                      href={`/shop-by-design/${cw.slug}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-display font-600 transition-all ${
                        cw.slug === designSlug
                          ? 'bg-hot-pink text-white'
                          : 'bg-dark-gray text-light-gray hover:text-white'
                      }`}
                    >
                      {cw.colorwayName}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Case options */}
          <div>
            <span className="text-hot-pink text-sm font-display font-600 uppercase tracking-wider">
              {design.collection}
            </span>
            <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mt-2 mb-2">
              {design.name}
            </h1>
            <p className="text-light-gray text-lg font-body mb-8">
              {design.colorwayName} colorway
            </p>

            <h2 className="font-display font-700 text-xl text-white mb-6">
              Get {design.name} on...
            </h2>

            <div className="space-y-4">
              {phoneCases.map((caseType) => (
                <Link
                  key={caseType.id}
                  href={`/product/${designSlug}?case=${caseType.id}&device=ip17pm`}
                  className="group flex items-center gap-4 p-4 rounded-2xl bg-charcoal border border-mid-gray/10 transition-all duration-200 hover:border-hot-pink/30 hover:shadow-lg hover:shadow-hot-pink/5"
                >
                  {/* Mini mockup placeholder */}
                  <div className="w-16 h-28 rounded-xl bg-dark-gray border border-mid-gray/20 flex-shrink-0 flex items-center justify-center group-hover:border-hot-pink/20 transition-colors">
                    <div className="w-10 h-18 rounded-lg bg-gradient-to-br from-hot-pink/10 to-transparent" />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="bg-hot-pink/10 text-hot-pink text-xs font-display font-700 uppercase tracking-wider px-2 py-0.5 rounded-full">
                        {caseType.tag}
                      </span>
                    </div>
                    <h3 className="font-display font-700 text-white">
                      {caseType.name}
                    </h3>
                    <p className="text-light-gray text-sm font-body">
                      {caseType.tagline}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <p className="font-display font-800 text-xl text-hot-pink">
                      ${caseType.price.toFixed(2)}
                    </p>
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
                      className="text-mid-gray group-hover:text-hot-pink transition-colors ml-auto mt-1"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </Link>
              ))}
            </div>

            {/* Customize CTA */}
            <div className="mt-8 p-6 rounded-2xl bg-gradient-to-r from-hot-pink/10 to-soft-pink/5 border border-hot-pink/20">
              <h3 className="font-display font-700 text-white mb-2">
                Want to customize this design?
              </h3>
              <p className="text-light-gray text-sm font-body mb-4">
                Add your name, change colors, or layer it with other elements in our live editor.
              </p>
              <Button href="/design-editor" variant="outline" size="sm">
                Open in Editor
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
