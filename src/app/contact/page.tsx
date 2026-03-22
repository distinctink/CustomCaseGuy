'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '', consent: false })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    alert('Message sent! We\'ll get back to you within 24 hours.')
    setFormData({ name: '', email: '', message: '', consent: false })
  }

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-2xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Contact Us"
          subtitle="We'd love to hear from you"
        />

        <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm text-light-gray font-display font-600 mb-2">
                Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body placeholder:text-mid-gray focus:border-hot-pink focus:outline-none"
                placeholder="Your name"
              />
            </div>

            <div>
              <label className="block text-sm text-light-gray font-display font-600 mb-2">
                Email
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body placeholder:text-mid-gray focus:border-hot-pink focus:outline-none"
                placeholder="your@email.com"
              />
            </div>

            <div>
              <label className="block text-sm text-light-gray font-display font-600 mb-2">
                Message
              </label>
              <textarea
                required
                rows={5}
                value={formData.message}
                onChange={(e) => setFormData((p) => ({ ...p, message: e.target.value }))}
                className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body placeholder:text-mid-gray focus:border-hot-pink focus:outline-none resize-none"
                placeholder="How can we help?"
              />
            </div>

            <div>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={formData.consent}
                  onChange={(e) => setFormData((p) => ({ ...p, consent: e.target.checked }))}
                  className="mt-1 w-4 h-4 accent-hot-pink rounded cursor-pointer flex-shrink-0"
                />
                <span className="text-light-gray text-xs font-body leading-relaxed">
                  I agree that my data will be used to respond to my inquiry. See our{' '}
                  <a href="/privacy" className="text-hot-pink hover:underline">Privacy Policy</a>{' '}
                  for how we handle your data. You can request deletion at any time.
                </span>
              </label>
            </div>

            <Button type="submit" fullWidth size="lg">
              Send Message
            </Button>
          </form>
        </div>

        <div className="mt-8 text-center">
          <p className="text-light-gray font-body text-sm mb-2">
            Or email us directly:
          </p>
          <a
            href="mailto:info@customcaseguy.com"
            className="text-hot-pink font-display font-600 text-lg hover:underline"
          >
            info@customcaseguy.com
          </a>
        </div>
      </div>
    </div>
  )
}
