import { Metadata } from 'next'
import Link from 'next/link'
import { DEVICES } from '@/lib/constants'
import { SectionHeading } from '@/components/ui/SectionHeading'

export const metadata: Metadata = {
  title: 'Shop by Case',
  description: 'Pick your device and case type, then browse every design available. Custom-printed phone cases from CustomCaseGuy.',
}

const DEVICE_GROUPS = [
  {
    label: 'iPhone 17',
    devices: DEVICES.filter((d) => d.id.startsWith('ip17')),
  },
  {
    label: 'iPhone 16',
    devices: DEVICES.filter((d) => d.id.startsWith('ip16')),
  },
  {
    label: 'Samsung Galaxy',
    devices: DEVICES.filter((d) => d.category === 'samsung'),
  },
  {
    label: 'iPad',
    devices: DEVICES.filter((d) => d.category === 'ipad'),
  },
]

export default function ShopByCasePage() {
  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Shop by Case"
          subtitle="Step 1: Pick your device"
        />

        <div className="space-y-12">
          {DEVICE_GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="font-display font-700 text-xl text-white mb-4 flex items-center gap-3">
                <span className="w-8 h-0.5 bg-hot-pink rounded-full" />
                {group.label}
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {group.devices.map((device) => (
                  <Link
                    key={device.id}
                    href={`/shop-by-case/${device.id}`}
                    className="group relative p-6 rounded-2xl bg-charcoal border border-mid-gray/10 transition-all duration-200 hover:border-hot-pink/30 hover:shadow-lg hover:shadow-hot-pink/5 hover:-translate-y-0.5 text-center"
                  >
                    {/* Phone icon placeholder */}
                    <div className="w-12 h-20 mx-auto mb-4 rounded-xl bg-dark-gray border border-mid-gray/20 flex items-center justify-center group-hover:border-hot-pink/20 transition-colors">
                      <div className="w-8 h-14 rounded-lg bg-gradient-to-br from-mid-gray/20 to-transparent" />
                    </div>
                    <p className="font-display font-600 text-sm text-white">
                      {device.name}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
