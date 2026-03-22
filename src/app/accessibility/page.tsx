import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Accessibility Statement',
  description:
    'CustomCaseGuy is committed to ensuring digital accessibility for all users, including those with disabilities.',
}

export default function AccessibilityPage() {
  return (
    <div className="pt-24 pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <h1 className="text-4xl sm:text-5xl font-display font-800 text-white mb-6">
          Accessibility Statement
        </h1>
        <p className="text-light-gray font-body text-lg mb-12 leading-relaxed">
          CustomCaseGuy is committed to ensuring digital accessibility for people with
          disabilities. We are continually improving the user experience for everyone and
          applying the relevant accessibility standards.
        </p>

        <div className="space-y-12">
          <section>
            <h2 className="text-2xl font-display font-700 text-white mb-4">
              Our Commitment
            </h2>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1
              at Level AA. These guidelines explain how to make web content more accessible
              for people with disabilities and more user-friendly for everyone.
            </p>
            <p className="text-light-gray font-body leading-relaxed">
              We also aim to comply with the European Accessibility Act (EAA) and the
              Americans with Disabilities Act (ADA) to ensure our website is accessible to
              all users regardless of ability.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-display font-700 text-white mb-4">
              Accessibility Features
            </h2>
            <ul className="space-y-3 text-light-gray font-body leading-relaxed">
              <li className="flex items-start gap-3">
                <span className="text-hot-pink mt-1 flex-shrink-0">&#10003;</span>
                <span>
                  <strong className="text-white">Keyboard Navigation:</strong> All
                  interactive elements are accessible via keyboard. A &quot;Skip to main
                  content&quot; link is provided to bypass navigation.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-hot-pink mt-1 flex-shrink-0">&#10003;</span>
                <span>
                  <strong className="text-white">Screen Reader Support:</strong> We use
                  semantic HTML, ARIA labels, and proper heading hierarchy to support
                  assistive technologies.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-hot-pink mt-1 flex-shrink-0">&#10003;</span>
                <span>
                  <strong className="text-white">Color Contrast:</strong> Text and
                  interactive elements meet WCAG AA contrast ratio requirements.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-hot-pink mt-1 flex-shrink-0">&#10003;</span>
                <span>
                  <strong className="text-white">Focus Indicators:</strong> Visible focus
                  outlines are provided on all interactive elements for keyboard users.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-hot-pink mt-1 flex-shrink-0">&#10003;</span>
                <span>
                  <strong className="text-white">Form Accessibility:</strong> All form
                  fields have associated labels and clear error messaging.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-hot-pink mt-1 flex-shrink-0">&#10003;</span>
                <span>
                  <strong className="text-white">Responsive Design:</strong> The site is
                  fully responsive and works across all screen sizes and devices.
                </span>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-700 text-white mb-4">
              Standards We Follow
            </h2>
            <ul className="space-y-2 text-light-gray font-body leading-relaxed list-disc list-inside">
              <li>WCAG 2.1 Level AA (Web Content Accessibility Guidelines)</li>
              <li>European Accessibility Act (EAA) — Directive (EU) 2019/882</li>
              <li>Americans with Disabilities Act (ADA) — Title III</li>
              <li>Section 508 of the Rehabilitation Act</li>
              <li>EN 301 549 (European ICT Accessibility Standard)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-700 text-white mb-4">
              Known Limitations
            </h2>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              While we strive for full accessibility, some areas may have limitations:
            </p>
            <ul className="space-y-2 text-light-gray font-body leading-relaxed list-disc list-inside">
              <li>
                The design editor uses a visual canvas that may have limited screen reader
                support. We are working on improving the text-based alternative.
              </li>
              <li>
                AI-generated design images may not have fully descriptive alt text, as
                their content is dynamically created.
              </li>
              <li>
                Some third-party content (embedded fonts, payment processors) may not be
                fully within our control.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-display font-700 text-white mb-4">
              Feedback & Contact
            </h2>
            <p className="text-light-gray font-body leading-relaxed mb-4">
              We welcome your feedback on the accessibility of CustomCaseGuy. If you
              encounter accessibility barriers or have suggestions for improvement, please
              contact us:
            </p>
            <div className="bg-charcoal rounded-2xl p-6 border border-mid-gray/10 space-y-2">
              <p className="text-white font-body">
                <strong className="font-display font-600">Email:</strong>{' '}
                <a
                  href="mailto:hello@distinctink.com"
                  className="text-hot-pink hover:underline"
                >
                  hello@distinctink.com
                </a>
              </p>
              <p className="text-white font-body">
                <strong className="font-display font-600">Subject Line:</strong>{' '}
                <span className="text-light-gray">Accessibility Feedback</span>
              </p>
              <p className="text-light-gray font-body text-sm mt-3">
                We aim to respond to accessibility feedback within 2 business days.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-2xl font-display font-700 text-white mb-4">
              Enforcement Procedure
            </h2>
            <p className="text-light-gray font-body leading-relaxed">
              If you are not satisfied with our response to your accessibility concern, you
              may escalate the matter to the relevant national enforcement body. For EU
              customers, you can contact your national equality body or the European
              Commission. For US customers, you may file a complaint with the Department of
              Justice or your state attorney general.
            </p>
          </section>

          <div className="border-t border-mid-gray/20 pt-8">
            <p className="text-mid-gray text-sm font-body">
              This statement was last updated on March 22, 2026.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
