import { SectionHeading } from '@/components/ui/SectionHeading'

const STATS = [
  { value: '400K+', label: 'Products Sold' },
  { value: '12+', label: 'Years in Business' },
  { value: '4.8', label: 'Star Rating', suffix: '★' },
  { value: '24-48hr', label: 'Turnaround' },
]

export function SocialProof() {
  return (
    <section className="py-24 bg-charcoal/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading title="Trusted by Thousands" />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="text-center p-8 rounded-2xl bg-dark-gray/50 border border-mid-gray/10"
            >
              <p className="font-display font-800 text-4xl sm:text-5xl text-hot-pink">
                {stat.value}
                {stat.suffix && (
                  <span className="text-warm-pink">{stat.suffix}</span>
                )}
              </p>
              <p className="mt-2 text-light-gray font-body text-sm">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
