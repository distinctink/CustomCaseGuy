'use client'

import Link from 'next/link'

type CaseCardProps = {
  designSlug: string
  designName: string
  collectionName: string
  price: number
  mockupUrl: string
  href: string
}

export function CaseCard({
  designName,
  collectionName,
  price,
  mockupUrl,
  href,
}: CaseCardProps) {
  return (
    <Link href={href} className="group block">
      <div className="relative overflow-hidden rounded-2xl bg-charcoal border border-mid-gray/10 transition-all duration-300 group-hover:border-hot-pink/30 group-hover:shadow-lg group-hover:shadow-hot-pink/5 group-hover:-translate-y-1">
        {/* Image */}
        <div className="relative aspect-[3/4] overflow-hidden bg-dark-gray">
          <div
            className="absolute inset-0 bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
            style={{
              backgroundImage: `url(${mockupUrl})`,
              backgroundColor: '#2A2A2A',
            }}
          />
          {/* Glow effect on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-charcoal/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
        </div>

        {/* Info */}
        <div className="p-4">
          <p className="text-xs text-hot-pink font-display font-600 uppercase tracking-wider mb-1">
            {collectionName}
          </p>
          <h3 className="font-display font-700 text-white text-sm truncate">
            {designName}
          </h3>
          <p className="mt-1 text-hot-pink font-display font-700 text-lg">
            ${price.toFixed(2)}
          </p>
        </div>
      </div>
    </Link>
  )
}
