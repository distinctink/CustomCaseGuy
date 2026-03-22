'use client'

import { use, useState, useMemo } from 'react'
import Link from 'next/link'
import { DEVICES, CASE_TYPES, getMockupUrl } from '@/lib/constants'
import { SAMPLE_DESIGNS } from '@/lib/sample-data'
import { Button } from '@/components/ui/Button'
import { notFound, useSearchParams } from 'next/navigation'

const ANGLES = ['front', 'angle', 'lifestyle'] as const

export default function ProductPage({
  params,
}: {
  params: Promise<{ designSlug: string }>
}) {
  const { designSlug } = use(params)
  const searchParams = useSearchParams()

  const design = SAMPLE_DESIGNS.find((d) => d.slug === designSlug)
  if (!design) notFound()

  const initialCase = searchParams.get('case') || 'symmetry'
  const initialDevice = searchParams.get('device') || 'ip17pm'

  const [selectedCase, setSelectedCase] = useState(initialCase)
  const [selectedDevice, setSelectedDevice] = useState(initialDevice)
  const [selectedAngle, setSelectedAngle] = useState<(typeof ANGLES)[number]>('front')

  const caseType = CASE_TYPES.find((c) => c.id === selectedCase)!
  const device = DEVICES.find((d) => d.id === selectedDevice)!

  const isIPad = device?.category === 'ipad'
  const availableCases = CASE_TYPES.filter((c) =>
    isIPad ? c.id === 'ipad-defender' : c.id !== 'ipad-defender'
  )
  const availableDevices = DEVICES.filter((d) =>
    selectedCase === 'ipad-defender' ? d.category === 'ipad' : d.category !== 'ipad'
  )

  // Find colorways for this design
  const colorways = SAMPLE_DESIGNS.filter(
    (d) => d.name === design.name && d.collectionId === design.collectionId
  )

  // Build mockup URL (using predictable pattern)
  const mockupUrl = getMockupUrl(designSlug, selectedCase, selectedDevice, selectedAngle)

  const handleAddToCart = () => {
    // Will integrate with Shopify Storefront API
    alert(`Added to cart:\n${design.name} (${design.colorwayName})\n${caseType.name} for ${device.name}\n$${caseType.price.toFixed(2)}`)
  }

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm text-light-gray">
          <Link href="/shop-by-design" className="hover:text-white transition-colors">
            Designs
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

        <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8 lg:gap-12">
          {/* Left: Image Gallery */}
          <div>
            {/* Main Image */}
            <div className="aspect-square rounded-3xl bg-dark-gray border border-mid-gray/10 overflow-hidden flex items-center justify-center relative">
              <div className="w-full h-full bg-gradient-to-br from-charcoal to-dark-gray flex items-center justify-center">
                {/* Placeholder for actual mockup image */}
                <div className="text-center">
                  <div className="w-48 h-96 mx-auto rounded-[2.5rem] bg-gradient-to-br from-hot-pink/15 to-soft-pink/10 border border-mid-gray/20 shadow-2xl flex items-center justify-center">
                    <div className="text-center px-4">
                      <p className="text-light-gray text-sm font-display font-600">{design.name}</p>
                      <p className="text-mid-gray text-xs font-body mt-1">{design.colorwayName}</p>
                      <p className="text-mid-gray text-xs font-body mt-1">{selectedAngle} view</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Glow */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2/3 h-2/3 rounded-full bg-hot-pink/6 blur-[60px] -z-0" />
            </div>

            {/* Angle Thumbnails */}
            <div className="flex gap-3 mt-4">
              {ANGLES.map((angle) => (
                <button
                  key={angle}
                  onClick={() => setSelectedAngle(angle)}
                  className={`flex-1 aspect-square rounded-xl border transition-all cursor-pointer overflow-hidden ${
                    selectedAngle === angle
                      ? 'border-hot-pink shadow-lg shadow-hot-pink/20'
                      : 'border-mid-gray/20 hover:border-mid-gray/40'
                  }`}
                >
                  <div className="w-full h-full bg-dark-gray flex items-center justify-center">
                    <span className="text-mid-gray text-xs font-body capitalize">
                      {angle}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Right: Product Info */}
          <div>
            {/* Badge */}
            <span className="inline-block bg-hot-pink/10 text-hot-pink text-xs font-display font-700 uppercase tracking-wider px-3 py-1 rounded-full mb-3">
              {caseType.tag}
            </span>

            {/* Design Name */}
            <h1 className="font-display font-800 text-3xl sm:text-4xl text-white mb-1">
              {design.name}
            </h1>

            {/* Collection + Case */}
            <p className="text-light-gray text-sm font-body mb-4">
              {design.collection} · {caseType.name}
            </p>

            {/* Price */}
            <p className="font-display font-800 text-4xl text-hot-pink mb-8">
              ${caseType.price.toFixed(2)}
            </p>

            {/* Case Type Selector */}
            <div className="mb-6">
              <label className="block text-sm text-light-gray font-display font-600 mb-3">
                Case Type
              </label>
              <div className="flex flex-wrap gap-2">
                {availableCases.map((ct) => (
                  <button
                    key={ct.id}
                    onClick={() => setSelectedCase(ct.id)}
                    className={`px-4 py-2.5 rounded-xl text-sm font-display font-600 transition-all cursor-pointer ${
                      selectedCase === ct.id
                        ? 'bg-hot-pink text-white shadow-lg shadow-hot-pink/25'
                        : 'bg-dark-gray text-light-gray hover:text-white hover:bg-dark-gray/80'
                    }`}
                  >
                    {ct.name.replace('OtterBox ', '')}
                    <span className="ml-1 text-xs opacity-70">
                      ${ct.price.toFixed(0)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Device Selector */}
            <div className="mb-6">
              <label className="block text-sm text-light-gray font-display font-600 mb-3">
                Device
              </label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body cursor-pointer focus:border-hot-pink focus:outline-none"
              >
                {availableDevices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Colorway Selector */}
            {colorways.length > 1 && (
              <div className="mb-6">
                <label className="block text-sm text-light-gray font-display font-600 mb-3">
                  Colorway
                </label>
                <div className="flex flex-wrap gap-2">
                  {colorways.map((cw) => (
                    <Link
                      key={cw.slug}
                      href={`/product/${cw.slug}?case=${selectedCase}&device=${selectedDevice}`}
                      className={`px-4 py-2.5 rounded-xl text-sm font-display font-600 transition-all ${
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

            {/* Selection Summary */}
            <div className="p-4 rounded-xl bg-dark-gray/50 border border-mid-gray/10 mb-6">
              <p className="text-sm text-light-gray font-body">
                <span className="text-white font-display font-600">{design.name}</span>
                {' '}({design.colorwayName}) on{' '}
                <span className="text-white font-display font-600">{caseType.name}</span>
                {' '}for{' '}
                <span className="text-white font-display font-600">{device.name}</span>
              </p>
            </div>

            {/* Add to Cart */}
            <Button onClick={handleAddToCart} fullWidth size="lg" className="mb-3">
              Add to Cart — ${caseType.price.toFixed(2)}
            </Button>

            {/* Personalize */}
            <Button href="/design-editor" variant="outline" fullWidth size="lg" className="mb-8">
              Personalize This Design
            </Button>

            {/* Trust features */}
            <div className="space-y-3">
              {[
                { icon: '☀️', text: 'Printed in-house in the USA' },
                { icon: '📦', text: 'Free shipping on all U.S. orders' },
                { icon: '🛡️', text: `Genuine ${caseType.name.includes('OtterBox') ? 'OtterBox' : 'premium'} case` },
                { icon: '⚡', text: 'Ships within 24-48 hours' },
                { icon: '📱', text: 'Wireless charging compatible' },
              ].map((item) => (
                <div key={item.text} className="flex items-center gap-3">
                  <span className="text-base">{item.icon}</span>
                  <span className="text-light-gray text-sm font-body">{item.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
