import { Metadata } from 'next'
import { SectionHeading } from '@/components/ui/SectionHeading'
import { Button } from '@/components/ui/Button'

export const metadata: Metadata = {
  title: 'About Us',
  description: 'CustomCaseGuy — Custom phone cases designed & printed in the USA. 12+ years, 400K+ products sold. Meet the team behind your favorite cases.',
}

export default function AboutPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="About CustomCaseGuy"
          subtitle="Designed & printed in the USA"
        />

        <div className="prose prose-invert max-w-none space-y-8">
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Our Story</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              CustomCaseGuy started over 12 years ago with a simple idea: everyone deserves a phone case
              that&apos;s as unique as they are. What began as a small operation has grown into a business
              that&apos;s sold over 400,000 custom products across Amazon, Walmart, Etsy, eBay, and now
              our own site.
            </p>
            <p className="text-light-gray font-body leading-relaxed">
              We&apos;re not a faceless dropshipper. Every single case is UV printed &amp; sublimated in-house at our US studios
              using commercial-grade printers. We print on genuine OtterBox cases
              (Symmetry, Commuter, Defender) and premium clear and MagSafe cases. When you order from us,
              your case is made by real people who care about quality.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8">
              <h3 className="font-display font-700 text-xl text-white mb-2">Daren</h3>
              <p className="text-hot-pink text-sm font-display font-600 mb-3">Founder & Owner</p>
              <p className="text-light-gray text-sm font-body leading-relaxed">
                Based in Winter Park, FL. Runs the business, manages operations,
                and obsesses over making the perfect custom case experience.
              </p>
            </div>
            <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8">
              <h3 className="font-display font-700 text-xl text-white mb-2">Adam</h3>
              <p className="text-hot-pink text-sm font-display font-600 mb-3">Production & Shipping</p>
              <p className="text-light-gray text-sm font-body leading-relaxed">
                Handles production, shipping, and customer service from our US studios.
                Makes sure every case goes out perfect.
              </p>
            </div>
          </div>

          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Our Process</h3>
            <div className="space-y-4 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">1. You design.</span> Pick from 400+
                pre-made designs or create your own with our built-in design tool.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">2. We print.</span> Your design is
                UV printed &amp; sublimated directly onto a genuine case using commercial-grade printers with vibrant,
                scratch-resistant ink.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">3. We ship.</span> Most orders ship
                within 24-48 hours via USPS First Class or FedEx 2-Day.
              </p>
            </div>
          </div>

          <div className="text-center">
            <Button href="/shop-by-design" size="lg">
              Browse Our Designs
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
