import { Metadata } from 'next'
import { SectionHeading } from '@/components/ui/SectionHeading'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'CustomCaseGuy Terms of Service — Read the terms and conditions for using our custom phone case design and ordering services.',
}

export default function TermsOfServicePage() {
  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Terms of Service"
          subtitle="Last updated: March 2026"
        />

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Acceptance of Terms */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Acceptance of Terms</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              Welcome to CustomCaseGuy (&quot;we,&quot; &quot;us,&quot; or
              &quot;our&quot;). By accessing or using our website at customcaseguy.com, placing an order,
              or using any of our services, you agree to be bound by these Terms of Service.
            </p>
            <p className="text-light-gray font-body leading-relaxed">
              If you do not agree to these terms, you must not use our website or services. We reserve
              the right to update or modify these terms at any time. Your continued use of the website
              after any changes constitutes acceptance of the revised terms.
            </p>
          </div>

          {/* Products and Customization */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Products &amp; Customization</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                CustomCaseGuy offers custom-printed phone cases and accessories. Each product is made to
                order based on your selected design, device model, and case type.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Pre-Made Designs:</span> We offer a
                catalog of pre-made designs that you can apply to your chosen case. These designs are the
                intellectual property of CustomCaseGuy.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Custom Designs:</span> You may
                upload your own images, add text, and customize designs using our design editor. You are
                solely responsible for ensuring you have the right to use any content you upload.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">AI-Generated Designs:</span> Our
                design editor includes an AI design generation feature powered by Google Gemini. AI-generated
                designs are created based on your text prompts. While we strive for high-quality results,
                AI-generated output may vary and we do not guarantee specific results.
              </p>
              <p>
                Product images on our website are for illustration purposes. Colors may vary slightly due
                to differences in screen displays and printing processes. We use commercial-grade UV
                printers and sublimation to ensure the highest quality output.
              </p>
            </div>
          </div>

          {/* Orders and Payments */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Orders &amp; Payments</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                By placing an order, you are making an offer to purchase a product. All orders are subject
                to acceptance and availability. We reserve the right to refuse or cancel any order for
                any reason, including errors in pricing or product information.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Pricing:</span> All prices are
                listed in US dollars (USD) and are subject to change without notice. Prices do not include
                applicable taxes, which will be calculated at checkout.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Payment:</span> We accept major
                credit cards, debit cards, and other payment methods available through our payment
                processor (Shopify Payments). Payment is charged at the time of order placement.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Order Confirmation:</span> You will
                receive an email confirmation once your order has been placed. This confirmation does not
                constitute acceptance of your order. We reserve the right to cancel orders after
                confirmation if there are issues with pricing, availability, or the content of your design.
              </p>
            </div>
          </div>

          {/* Shipping and Delivery */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Shipping &amp; Delivery</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                Since every case is custom-made to order, please allow 24-48 hours for production before
                your order ships.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Domestic Shipping:</span> We offer
                free shipping on all US orders. Orders are shipped via USPS First Class Mail or FedEx
                2-Day, depending on the order size and destination.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Delivery Times:</span> Estimated
                delivery times are provided at checkout but are not guaranteed. We are not responsible for
                delays caused by carriers, weather, customs, or other circumstances beyond our control.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Risk of Loss:</span> All products
                purchased from our website are shipped pursuant to a shipment contract. The risk of loss
                and title for products pass to you upon delivery to the carrier.
              </p>
            </div>
          </div>

          {/* Returns and Refunds */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Returns &amp; Refunds</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                Because every product is custom-made to your specifications, we generally cannot accept
                returns for buyer&apos;s remorse or change of mind.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Defective Products:</span> If your
                case arrives damaged, defective, or with a printing error, please contact us within 14
                days of delivery. We will replace the product free of charge or issue a full refund at
                our discretion.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Wrong Item:</span> If you receive
                the wrong case model or design, contact us and we will send the correct item at no
                additional cost.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">How to Request a Return:</span> Contact
                us at{' '}
                <a href="mailto:info@customcaseguy.com" className="text-hot-pink underline hover:no-underline">
                  info@customcaseguy.com
                </a>{' '}
                with your order number and photos of the issue. We aim to resolve all claims within 5
                business days.
              </p>
            </div>
          </div>

          {/* Intellectual Property */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Intellectual Property</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">Our Content:</span> All content on
                this website, including but not limited to designs, graphics, logos, text, images, and
                software, is the property of CustomCaseGuy or its licensors and is
                protected by copyright, trademark, and other intellectual property laws. You may not
                reproduce, distribute, or create derivative works from our content without written
                permission.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">User-Uploaded Content:</span> You
                retain ownership of any images, text, or other content you upload to our design editor.
                By uploading content, you grant us a limited, non-exclusive license to use that content
                solely for the purpose of producing and delivering your order.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">AI-Generated Designs:</span> Designs
                created using our AI design tool are generated based on your prompts using Google Gemini.
                You may use AI-generated designs for your personal phone case order. We do not claim
                ownership of AI-generated designs created through your prompts, but we also cannot
                guarantee exclusivity of any AI-generated output.
              </p>
            </div>
          </div>

          {/* User Responsibilities */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">User Responsibilities</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              When using our website and services, you agree to the following:
            </p>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">No Infringing Content:</span> You
                must not upload, submit, or use any content that infringes on the intellectual property
                rights of any third party, including copyrighted images, trademarks, or logos you do not
                own or have permission to use.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">No Prohibited Content:</span> You
                must not upload content that is obscene, defamatory, threatening, hateful, or that
                promotes illegal activity.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Accurate Information:</span> You
                must provide accurate and complete information when placing orders, including your
                shipping address and payment details.
              </p>
              <p>
                We reserve the right to refuse to print any design that, in our sole discretion, violates
                these terms or is otherwise objectionable. We may cancel orders containing prohibited
                content without notice and issue a refund.
              </p>
            </div>
          </div>

          {/* Limitation of Liability */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Limitation of Liability</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                To the maximum extent permitted by law, CustomCaseGuy shall not be liable
                for any indirect, incidental, special, consequential, or punitive damages arising out of
                or related to your use of our website or products.
              </p>
              <p>
                Our total liability for any claim arising from your use of our services shall not exceed
                the amount you paid for the specific product giving rise to the claim.
              </p>
              <p>
                We provide our website and products &quot;as is&quot; and &quot;as available&quot; without
                warranties of any kind, either express or implied, including but not limited to warranties
                of merchantability, fitness for a particular purpose, or non-infringement.
              </p>
              <p>
                We do not guarantee that AI-generated designs will meet your expectations, be free from
                errors, or be suitable for any particular purpose. Use of the AI design feature is at
                your own discretion.
              </p>
            </div>
          </div>

          {/* Governing Law */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Governing Law</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              These Terms of Service and any disputes arising out of or related to these terms or your
              use of our website shall be governed by and construed in accordance with the laws of the
              State of Florida, without regard to its conflict of law provisions.
            </p>
            <p className="text-light-gray font-body leading-relaxed">
              Any legal action or proceeding relating to these terms shall be brought exclusively in the
              state or federal courts located in Orange County, Florida. You consent to the personal
              jurisdiction of such courts and waive any objection to venue in such courts.
            </p>
          </div>

          {/* Contact */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Contact Information</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-2 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-white font-display font-600">Email:</span>{' '}
                <a href="mailto:info@customcaseguy.com" className="text-hot-pink underline hover:no-underline">
                  info@customcaseguy.com
                </a>
              </p>
              <p>
                <span className="text-white font-display font-600">Website:</span>{' '}
                <a href="https://customcaseguy.com" className="text-hot-pink underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                  customcaseguy.com
                </a>
              </p>
              <p>
                <span className="text-white font-display font-600">Business Name:</span> CustomCaseGuy
              </p>
              <p>
                <span className="text-white font-display font-600">Location:</span> Winter Park, FL / New York
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
