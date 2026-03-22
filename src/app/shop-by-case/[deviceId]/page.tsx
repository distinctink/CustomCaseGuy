import Link from 'next/link'
import { DEVICES, CASE_TYPES } from '@/lib/constants'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { notFound } from 'next/navigation'

export function generateStaticParams() {
  return DEVICES.map((d) => ({ deviceId: d.id }))
}

export default async function CaseTypePage({
  params,
}: {
  params: Promise<{ deviceId: string }>
}) {
  const { deviceId } = await params
  const device = DEVICES.find((d) => d.id === deviceId)
  if (!device) notFound()

  const isIPad = device.category === 'ipad'
  const availableCases = CASE_TYPES.filter((c) =>
    isIPad ? c.id === 'ipad-defender' : c.id !== 'ipad-defender'
  )

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-8 flex items-center gap-2 text-sm text-light-gray">
          <Link href="/shop-by-case" className="hover:text-white transition-colors">
            Shop by Case
          </Link>
          <span className="text-mid-gray">/</span>
          <span className="text-white">{device.name}</span>
        </nav>

        <SectionHeading
          title={device.name}
          subtitle="Step 2: Choose your case type"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {availableCases.map((caseType) => (
            <Link
              key={caseType.id}
              href={`/shop-by-case/${deviceId}/${caseType.id}`}
              className="group relative rounded-2xl bg-charcoal border border-mid-gray/10 overflow-hidden transition-all duration-300 hover:border-hot-pink/30 hover:shadow-lg hover:shadow-hot-pink/5 hover:-translate-y-1"
            >
              {/* Case mockup placeholder */}
              <div className="aspect-[4/3] bg-dark-gray flex items-center justify-center relative overflow-hidden">
                <div className="w-24 h-44 rounded-[1.5rem] bg-gradient-to-br from-charcoal to-dark-gray border border-mid-gray/20 shadow-xl group-hover:scale-105 transition-transform duration-300" />
                <div className="absolute top-3 right-3">
                  <span className="bg-hot-pink/10 text-hot-pink text-xs font-display font-700 uppercase tracking-wider px-2 py-1 rounded-full">
                    {caseType.tag}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-6">
                <h3 className="font-display font-700 text-lg text-white mb-1">
                  {caseType.name}
                </h3>
                <p className="text-light-gray text-sm font-body mb-3">
                  {caseType.tagline}
                </p>
                <p className="font-display font-800 text-2xl text-hot-pink">
                  ${caseType.price.toFixed(2)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
