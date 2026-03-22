import { Metadata } from 'next'
import { SectionHeading } from '@/components/ui/SectionHeading'

export const metadata: Metadata = {
  title: 'Shipping & Returns',
  description: 'Free shipping on all U.S. orders. 24-48 hour turnaround. Learn about our shipping and return policies.',
}

export default function ShippingPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Shipping & Returns"
          subtitle="Fast, free, and made to order"
        />

        <div className="space-y-8">
          <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8">
            <h3 className="font-display font-700 text-xl text-white mb-4">Shipping</h3>
            <div className="space-y-4 text-light-gray text-sm font-body leading-relaxed">
              <p>
                <span className="text-white font-display font-600">Free shipping</span> on all U.S. orders. No minimums, no codes needed.
              </p>
              <p>
                <span className="text-white font-display font-600">USPS First Class Mail</span> — Standard shipping for phone cases. Typically arrives in 3-5 business days after printing.
              </p>
              <p>
                <span className="text-white font-display font-600">FedEx OneRate 2-Day</span> — Available for iPad cases and larger orders. Arrives in 2 business days after printing.
              </p>
              <p>
                <span className="text-white font-display font-600">Production time:</span> Most orders are printed and shipped within 24-48 hours. During peak seasons (holidays), production may take up to 3 business days.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8">
            <h3 className="font-display font-700 text-xl text-white mb-4">Returns & Exchanges</h3>
            <div className="space-y-4 text-light-gray text-sm font-body leading-relaxed">
              <p>
                Because every case is <span className="text-white font-display font-600">custom-made to order</span>, we cannot accept returns for change of mind or buyer&apos;s remorse.
              </p>
              <p>
                If your case arrives <span className="text-white font-display font-600">damaged, defective, or with a printing error</span>, we&apos;ll replace it at no charge. Simply email us at{' '}
                <a href="mailto:info@customcaseguy.com" className="text-hot-pink hover:underline">info@customcaseguy.com</a> with:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your order number</li>
                <li>A photo of the issue</li>
                <li>A brief description of the problem</li>
              </ul>
              <p>We&apos;ll review and respond within 24 hours.</p>
            </div>
          </div>

          <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8">
            <h3 className="font-display font-700 text-xl text-white mb-4">Order Tracking</h3>
            <p className="text-light-gray text-sm font-body leading-relaxed">
              You&apos;ll receive a tracking number via email once your order ships. If you haven&apos;t received tracking within 3 business days, please email us at{' '}
              <a href="mailto:info@customcaseguy.com" className="text-hot-pink hover:underline">info@customcaseguy.com</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
