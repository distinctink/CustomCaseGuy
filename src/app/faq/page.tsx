'use client'

import { useState } from 'react'

const FAQS = [
  {
    q: 'What cases do you print on?',
    a: 'We print on genuine OtterBox Symmetry ($49.99), Commuter ($54.99), and Defender ($64.99) cases, plus Clear Shockproof ($34.99) and MagSafe Tough ($44.99) cases. For iPads, we offer the iPad Defender ($74.99).',
  },
  {
    q: 'What devices do you support?',
    a: 'We currently support iPhone 17 series (Pro Max, Pro, standard, Air), iPhone 16 series (Pro Max, Pro, standard), Samsung Galaxy S25 series (Ultra, +, standard), and iPads (Pro 13", Pro 11", Air). We add new devices as they launch.',
  },
  {
    q: 'How is the design printed?',
    a: 'We use the most advanced printing technology available — printing directly onto the case surface. The colors are stunningly vivid, scratch-resistant, and built to last. It won\'t peel, crack, or fade like vinyl wraps or stickers.',
  },
  {
    q: 'Can I design my own case?',
    a: 'Yes! Use our "Start From Scratch" editor to add text, upload images, choose fonts and colors, and see a live preview of your design on the case. You can also customize any of our pre-made designs.',
  },
  {
    q: 'How long does shipping take?',
    a: 'Most orders are printed and shipped within 24-48 hours. We ship via USPS First Class Mail for smaller items and FedEx OneRate 2-Day for larger orders. Free shipping on all U.S. orders.',
  },
  {
    q: 'What is your return policy?',
    a: 'Since every case is custom-made to order, we cannot accept returns for buyer\'s remorse. However, if your case arrives damaged or with a printing defect, we\'ll replace it free of charge. Contact us at info@customcaseguy.com.',
  },
  {
    q: 'Are these real OtterBox cases?',
    a: 'Yes! We purchase genuine OtterBox cases and print your design directly onto them. You get the same OtterBox protection you trust, with a custom design.',
  },
  {
    q: 'Do the cases support wireless charging?',
    a: 'Yes, all our cases are wireless charging compatible. The MagSafe Tough Case also includes built-in magnets for MagSafe accessories.',
  },
  {
    q: 'Where are you located?',
    a: 'We\'re based in Orlando/Winter Park, Florida and New York. Every case is printed in-house at our US studios — we don\'t outsource or dropship.',
  },
]

export default function FaqPage() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="font-display font-800 text-4xl sm:text-5xl text-white mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-light-gray text-lg font-body">
            Got questions? We&apos;ve got answers.
          </p>
        </div>

        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <div
              key={i}
              className="rounded-2xl bg-charcoal border border-mid-gray/10 overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(openIndex === i ? null : i)}
                aria-expanded={openIndex === i}
                aria-controls={`faq-answer-${i}`}
                className="w-full flex items-center justify-between p-6 text-left cursor-pointer"
              >
                <span id={`faq-question-${i}`} className="font-display font-700 text-white pr-4">
                  {faq.q}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`text-hot-pink flex-shrink-0 transition-transform duration-200 ${
                    openIndex === i ? 'rotate-180' : ''
                  }`}
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {openIndex === i && (
                <div id={`faq-answer-${i}`} role="region" aria-labelledby={`faq-question-${i}`} className="px-6 pb-6 -mt-2">
                  <p className="text-light-gray text-sm font-body leading-relaxed">
                    {faq.a}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center p-8 rounded-2xl bg-dark-gray/50 border border-mid-gray/10">
          <p className="text-light-gray font-body mb-2">Still have questions?</p>
          <p className="text-white font-display font-600">
            Email us at{' '}
            <a href="mailto:info@customcaseguy.com" className="text-hot-pink hover:underline">
              info@customcaseguy.com
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
