import { Metadata } from 'next'
import { SectionHeading } from '@/components/ui/SectionHeading'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'CustomCaseGuy Privacy Policy — Learn how we collect, use, and protect your personal data. GDPR and CCPA compliant.',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Privacy Policy"
          subtitle="Last updated: March 2026"
        />

        <div className="prose prose-invert max-w-none space-y-8">
          {/* Introduction */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Introduction</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              CustomCaseGuy (&quot;Distinct Ink,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website
              customcaseguy.com. This Privacy Policy explains how we collect, use, disclose, and safeguard
              your information when you visit our website or place an order with us.
            </p>
            <p className="text-light-gray font-body leading-relaxed">
              By using our website, you consent to the data practices described in this policy. If you
              do not agree with the terms of this Privacy Policy, please do not access or use our website.
            </p>
          </div>

          {/* Data Collection */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">What Data We Collect</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              We collect the following types of personal information:
            </p>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">Personal Information:</span> Name,
                email address, shipping address, billing address, and phone number provided when you
                place an order or create an account.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Payment Information:</span> Credit
                card numbers, debit card numbers, and other payment details. Payment processing is handled
                securely by our third-party payment processor (Shopify Payments). We do not store your
                full payment card details on our servers.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Device &amp; Browser Information:</span> IP
                address, browser type and version, operating system, device type, screen resolution,
                referring URLs, and pages visited on our site. This information is collected automatically
                through cookies and similar technologies.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">User-Generated Content:</span> Images,
                text, and designs you upload or create using our design editor, including AI-generated
                design prompts and outputs.
              </p>
            </div>
          </div>

          {/* How Data Is Used */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">How We Use Your Data</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">Order Fulfillment:</span> To process
                and ship your custom phone case orders, send order confirmations, shipping notifications,
                and handle any issues with your order.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Customer Service:</span> To respond
                to your inquiries, provide support, and resolve disputes or issues related to your orders.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Marketing (Opt-In Only):</span> With
                your explicit consent, we may send you promotional emails about new designs, sales, and
                product updates. You can unsubscribe at any time by clicking the unsubscribe link in any
                marketing email or by contacting us directly.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Site Improvement:</span> To analyze
                how visitors use our website, optimize our design editor experience, and improve our
                products and services.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Legal Compliance:</span> To comply
                with applicable laws, regulations, and legal processes.
              </p>
            </div>
          </div>

          {/* Cookies */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Cookies &amp; Tracking Technologies</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              We use cookies and similar tracking technologies to enhance your experience on our site.
              These include:
            </p>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">Essential Cookies:</span> Required
                for the website to function properly, including session management and shopping cart
                functionality.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Analytics Cookies:</span> Help us
                understand how visitors interact with our website by collecting information about page
                views, navigation patterns, and site performance.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Marketing Cookies:</span> Used with
                your consent to deliver relevant advertisements and track the effectiveness of our
                marketing campaigns.
              </p>
            </div>
            <p className="text-light-gray font-body leading-relaxed mt-4">
              You can control cookies through your browser settings. Disabling certain cookies may limit
              your ability to use some features of our website.
            </p>
          </div>

          {/* Third-Party Services */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Third-Party Services</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              We use the following third-party services that may collect or process your data:
            </p>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">Shopify:</span> Our e-commerce
                platform and payment processor. Shopify processes your payment information securely and
                is PCI-DSS compliant. See{' '}
                <a href="https://www.shopify.com/legal/privacy" className="text-hot-pink underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                  Shopify&apos;s Privacy Policy
                </a>.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Google Fonts:</span> We use Google
                Fonts to display typography on our website. Google may collect your IP address and browser
                information when fonts are loaded. See{' '}
                <a href="https://policies.google.com/privacy" className="text-hot-pink underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                  Google&apos;s Privacy Policy
                </a>.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Google Gemini AI:</span> We use
                Google&apos;s Gemini AI to power our AI design generation feature. When you use the AI
                design tool, your text prompts are sent to Google&apos;s servers for processing. We do not
                send your personal information to Google Gemini — only the design prompts you enter. See{' '}
                <a href="https://policies.google.com/privacy" className="text-hot-pink underline hover:no-underline" target="_blank" rel="noopener noreferrer">
                  Google&apos;s Privacy Policy
                </a>.
              </p>
            </div>
          </div>

          {/* Data Retention */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Data Retention</h3>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                We retain your personal information for as long as necessary to fulfill the purposes
                outlined in this Privacy Policy, unless a longer retention period is required or permitted
                by law.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Order Data:</span> Retained for 7
                years after your last purchase to comply with tax and accounting obligations.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Account Data:</span> Retained for as
                long as your account is active. You may request deletion of your account at any time.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Marketing Data:</span> Retained
                until you unsubscribe or request removal from our mailing list.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Analytics Data:</span> Aggregated
                analytics data may be retained indefinitely as it does not identify individual users.
              </p>
            </div>
          </div>

          {/* GDPR Rights */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Your Rights Under GDPR</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              If you are a resident of the European Economic Area (EEA) or the United Kingdom, you have
              the following data protection rights:
            </p>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">Right of Access:</span> You have
                the right to request a copy of the personal data we hold about you.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Rectification:</span> You
                have the right to request that we correct any inaccurate or incomplete personal data.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Erasure:</span> You have
                the right to request that we delete your personal data, subject to certain legal
                exceptions.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Data Portability:</span> You
                have the right to receive your personal data in a structured, commonly used, and
                machine-readable format.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Object:</span> You have the
                right to object to the processing of your personal data for direct marketing purposes.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Restriction:</span> You
                have the right to request that we restrict the processing of your personal data under
                certain circumstances.
              </p>
            </div>
            <p className="text-light-gray font-body leading-relaxed mt-4">
              To exercise any of these rights, please contact us at{' '}
              <a href="mailto:info@customcaseguy.com" className="text-hot-pink underline hover:no-underline">
                info@customcaseguy.com
              </a>. We will respond to your request within 30 days.
            </p>
          </div>

          {/* CCPA Rights */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Your Rights Under CCPA</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              If you are a California resident, you have additional rights under the California Consumer
              Privacy Act (CCPA):
            </p>
            <div className="space-y-3 text-light-gray font-body leading-relaxed">
              <p>
                <span className="text-hot-pink font-display font-700">Right to Know:</span> You have the
                right to request that we disclose what personal information we have collected about you,
                including the categories and specific pieces of data, the sources, the business purposes
                for collecting it, and the third parties with whom we share it.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Delete:</span> You have the
                right to request deletion of your personal information, subject to certain exceptions.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Opt-Out:</span> You have
                the right to opt out of the sale of your personal information. We do not sell your personal
                information.
              </p>
              <p>
                <span className="text-hot-pink font-display font-700">Right to Non-Discrimination:</span> We
                will not discriminate against you for exercising any of your CCPA rights.
              </p>
            </div>
          </div>

          {/* Children's Privacy */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Children&apos;s Privacy</h3>
            <p className="text-light-gray font-body leading-relaxed">
              Our website is not intended for children under the age of 13. We do not knowingly collect
              personal information from children under 13. If we become aware that we have collected
              personal data from a child under 13 without parental consent, we will take steps to delete
              that information as quickly as possible. If you believe we have collected information from
              a child under 13, please contact us at{' '}
              <a href="mailto:info@customcaseguy.com" className="text-hot-pink underline hover:no-underline">
                info@customcaseguy.com
              </a>.
            </p>
          </div>

          {/* International Data Transfers */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">International Data Transfers</h3>
            <p className="text-light-gray font-body leading-relaxed">
              Your information may be transferred to and processed in the United States, where our
              servers and operations are located. If you are accessing our website from outside the
              United States, please be aware that your data may be transferred to, stored, and processed
              in the United States, where data protection laws may differ from those in your country.
              By using our website, you consent to the transfer of your information to the United States.
              We take appropriate safeguards to ensure that your personal data is treated securely and in
              accordance with this Privacy Policy.
            </p>
          </div>

          {/* Contact */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Contact Us</h3>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              If you have any questions about this Privacy Policy, wish to exercise your data protection
              rights, or have concerns about how we handle your personal information, please contact us:
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
                <span className="text-white font-display font-600">Business Name:</span> CustomCaseGuy / Distinct Ink
              </p>
              <p>
                <span className="text-white font-display font-600">Location:</span> Winter Park, FL / New York
              </p>
            </div>
          </div>

          {/* Changes to Policy */}
          <div className="rounded-3xl bg-charcoal border border-mid-gray/10 p-8 sm:p-12">
            <h3 className="font-display font-700 text-2xl text-white mb-4">Changes to This Policy</h3>
            <p className="text-light-gray font-body leading-relaxed">
              We may update this Privacy Policy from time to time. When we make changes, we will update
              the &quot;Last Updated&quot; date at the top of this page. We encourage you to review this
              Privacy Policy periodically to stay informed about how we protect your information. Your
              continued use of our website after any changes constitutes your acceptance of the updated
              policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
