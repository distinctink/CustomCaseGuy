'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SectionHeading } from '@/components/ui/SectionHeading'

export default function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', message: '', consent: false })
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          message: formData.message,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to send message.')
      }

      setStatus('sent')
      setFormData({ name: '', email: '', message: '', consent: false })
    } catch (err) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    }
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

            {status === 'sent' && (
              <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                <p className="text-green-400 font-display font-600 text-sm">
                  Message sent! We&apos;ll get back to you within 24 hours.
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                <p className="text-red-400 font-body text-sm">{errorMsg}</p>
              </div>
            )}

            <Button type="submit" fullWidth size="lg" disabled={status === 'sending'}>
              {status === 'sending' ? 'Sending...' : 'Send Message'}
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
