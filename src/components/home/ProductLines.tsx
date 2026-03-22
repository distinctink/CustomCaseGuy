'use client'

import { useState } from 'react'
import { CASE_TYPES } from '@/lib/constants'
import { SectionHeading } from '@/components/ui/SectionHeading'

export function ProductLines() {
  const [activeTab, setActiveTab] = useState(0)
  const phoneCases = CASE_TYPES.filter((c) => c.id !== 'ipad-defender')
  const active = phoneCases[activeTab]

  return (
    <section className="py-24 bg-charcoal/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Our Case Lineup"
          subtitle="Every case is UV printed in-house at our Orlando studio"
        />

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {phoneCases.map((caseType, i) => (
            <button
              key={caseType.id}
              onClick={() => setActiveTab(i)}
              className={`px-5 py-2.5 rounded-xl font-display font-600 text-sm transition-all duration-200 cursor-pointer ${
                i === activeTab
                  ? 'bg-hot-pink text-white shadow-lg shadow-hot-pink/25'
                  : 'bg-dark-gray text-light-gray hover:text-white hover:bg-dark-gray/80'
              }`}
            >
              {caseType.name.replace('OtterBox ', '')}
            </button>
          ))}
        </div>

        {/* Active case details */}
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Mockup placeholder */}
          <div className="relative">
            <div className="aspect-square rounded-3xl bg-dark-gray border border-mid-gray/10 flex items-center justify-center overflow-hidden">
              <div className="text-center">
                <div className="w-48 h-96 mx-auto rounded-[2.5rem] bg-gradient-to-br from-charcoal to-dark-gray border border-mid-gray/20 shadow-xl flex items-center justify-center">
                  <span className="text-mid-gray text-sm font-body">
                    {active.name}
                  </span>
                </div>
              </div>
            </div>
            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-2/3 rounded-full bg-hot-pink/8 blur-[80px] -z-10" />
          </div>

          {/* Info */}
          <div>
            <span className="inline-block bg-hot-pink/10 text-hot-pink text-xs font-display font-700 uppercase tracking-wider px-3 py-1 rounded-full mb-4">
              {active.tag}
            </span>
            <h3 className="font-display font-800 text-3xl sm:text-4xl text-white mb-4">
              {active.name}
            </h3>
            <p className="text-light-gray text-lg font-body font-300 leading-relaxed mb-6">
              {active.description}
            </p>
            <p className="font-display font-800 text-4xl text-hot-pink mb-8">
              ${active.price.toFixed(2)}
            </p>

            <div className="space-y-3">
              {[
                'UV printed with vibrant, scratch-resistant ink',
                'Precise cutouts for all ports and buttons',
                'Wireless charging compatible',
                'Ships within 24-48 hours',
              ].map((feature) => (
                <div key={feature} className="flex items-center gap-3">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-hot-pink flex-shrink-0"
                  >
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  <span className="text-light-gray text-sm font-body">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
