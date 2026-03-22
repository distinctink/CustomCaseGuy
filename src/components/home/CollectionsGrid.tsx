'use client'

import Link from 'next/link'
import { COLLECTIONS } from '@/lib/constants'
import { SectionHeading } from '@/components/ui/SectionHeading'

const GRADIENT_COLORS: Record<string, string> = {
  florals: 'from-pink-900/40 to-rose-800/20',
  marble: 'from-gray-700/40 to-slate-600/20',
  monogram: 'from-amber-900/40 to-yellow-800/20',
  abstract: 'from-purple-900/40 to-indigo-800/20',
  geometric: 'from-blue-900/40 to-cyan-800/20',
  nature: 'from-green-900/40 to-emerald-800/20',
  animals: 'from-orange-900/40 to-amber-800/20',
  camo: 'from-green-900/40 to-lime-900/20',
  celestial: 'from-indigo-900/40 to-violet-800/20',
  sports: 'from-red-900/40 to-orange-800/20',
  patriotic: 'from-blue-900/40 to-red-900/20',
  holiday: 'from-red-900/40 to-green-900/20',
  occupation: 'from-teal-900/40 to-cyan-800/20',
  minimalist: 'from-gray-800/40 to-gray-700/20',
  tiedye: 'from-fuchsia-900/40 to-yellow-800/20',
}

export function CollectionsGrid() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Browse Collections"
          subtitle="15 curated collections for every style"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {COLLECTIONS.map((collection) => (
            <Link
              key={collection.id}
              href={`/shop-by-design?collection=${collection.id}`}
              className="group relative aspect-square rounded-2xl overflow-hidden bg-charcoal border border-mid-gray/10 transition-all duration-300 hover:border-hot-pink/30 hover:shadow-lg hover:shadow-hot-pink/5 hover:-translate-y-1"
            >
              {/* Pattern background */}
              <div
                className={`absolute inset-0 bg-gradient-to-br ${GRADIENT_COLORS[collection.id] || 'from-gray-800/40 to-gray-700/20'} transition-opacity group-hover:opacity-80`}
              />

              {/* Content */}
              <div className="relative h-full flex flex-col items-center justify-center p-4 text-center">
                <span className="text-3xl mb-3">{collection.icon}</span>
                <h3 className="font-display font-700 text-sm text-white leading-tight">
                  {collection.name}
                </h3>
              </div>

              {/* Hover glow */}
              <div className="absolute inset-0 bg-hot-pink/5 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
