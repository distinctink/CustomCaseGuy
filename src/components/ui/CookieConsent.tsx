'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export function CookieConsent() {
  const [visible, setVisible] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true, // always on
    analytics: false,
    marketing: false,
  })

  useEffect(() => {
    const consent = localStorage.getItem('cookie-consent')
    if (!consent) {
      // Small delay so it doesn't flash on load
      const timer = setTimeout(() => setVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleAcceptAll = () => {
    const allConsent = { necessary: true, analytics: true, marketing: true }
    localStorage.setItem('cookie-consent', JSON.stringify(allConsent))
    setVisible(false)
  }

  const handleRejectNonEssential = () => {
    const minConsent = { necessary: true, analytics: false, marketing: false }
    localStorage.setItem('cookie-consent', JSON.stringify(minConsent))
    setVisible(false)
  }

  const handleSavePreferences = () => {
    localStorage.setItem('cookie-consent', JSON.stringify(preferences))
    setVisible(false)
    setShowPreferences(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      aria-modal="false"
      className="fixed bottom-0 left-0 right-0 z-[9998] p-4 sm:p-6"
    >
      <div className="mx-auto max-w-2xl rounded-2xl bg-charcoal border border-mid-gray/20 shadow-2xl shadow-black/50 p-6">
        {!showPreferences ? (
          <>
            <div className="mb-4">
              <h2 className="font-display font-700 text-white text-lg mb-2">
                We value your privacy
              </h2>
              <p className="text-light-gray text-sm font-body leading-relaxed">
                We use essential cookies to make our site work. With your consent, we may also use
                non-essential cookies to improve your experience and analyze traffic. See our{' '}
                <Link href="/privacy" className="text-hot-pink hover:underline">
                  Privacy Policy
                </Link>{' '}
                for details.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAcceptAll}
                className="px-5 py-2.5 rounded-xl bg-hot-pink text-white font-display font-700 text-sm hover:bg-hot-pink/90 transition-colors cursor-pointer"
              >
                Accept All
              </button>
              <button
                onClick={handleRejectNonEssential}
                className="px-5 py-2.5 rounded-xl bg-dark-gray text-light-gray font-display font-600 text-sm hover:text-white transition-colors cursor-pointer border border-mid-gray/20"
              >
                Essential Only
              </button>
              <button
                onClick={() => setShowPreferences(true)}
                className="px-5 py-2.5 rounded-xl text-light-gray font-display font-600 text-sm hover:text-white transition-colors cursor-pointer underline underline-offset-2"
              >
                Manage Preferences
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 className="font-display font-700 text-white text-lg mb-4">
              Cookie Preferences
            </h2>

            <div className="space-y-4 mb-6">
              {/* Necessary - always on */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-dark-gray">
                <div>
                  <p className="text-white text-sm font-display font-600">Essential Cookies</p>
                  <p className="text-mid-gray text-xs font-body mt-0.5">
                    Required for the site to function. Cannot be disabled.
                  </p>
                </div>
                <div className="w-10 h-6 rounded-full bg-hot-pink flex items-center justify-end px-0.5">
                  <div className="w-5 h-5 rounded-full bg-white" />
                </div>
              </div>

              {/* Analytics */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-dark-gray cursor-pointer">
                <div>
                  <p className="text-white text-sm font-display font-600">Analytics Cookies</p>
                  <p className="text-mid-gray text-xs font-body mt-0.5">
                    Help us understand how visitors use our site.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={preferences.analytics}
                  onClick={() => setPreferences((p) => ({ ...p, analytics: !p.analytics }))}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer ${
                    preferences.analytics ? 'bg-hot-pink justify-end' : 'bg-mid-gray justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white" />
                </button>
              </label>

              {/* Marketing */}
              <label className="flex items-center justify-between p-3 rounded-xl bg-dark-gray cursor-pointer">
                <div>
                  <p className="text-white text-sm font-display font-600">Marketing Cookies</p>
                  <p className="text-mid-gray text-xs font-body mt-0.5">
                    Used to deliver relevant ads and track campaigns.
                  </p>
                </div>
                <button
                  role="switch"
                  aria-checked={preferences.marketing}
                  onClick={() => setPreferences((p) => ({ ...p, marketing: !p.marketing }))}
                  className={`w-10 h-6 rounded-full flex items-center px-0.5 transition-colors cursor-pointer ${
                    preferences.marketing ? 'bg-hot-pink justify-end' : 'bg-mid-gray justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white" />
                </button>
              </label>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSavePreferences}
                className="px-5 py-2.5 rounded-xl bg-hot-pink text-white font-display font-700 text-sm hover:bg-hot-pink/90 transition-colors cursor-pointer"
              >
                Save Preferences
              </button>
              <button
                onClick={() => setShowPreferences(false)}
                className="px-5 py-2.5 rounded-xl bg-dark-gray text-light-gray font-display font-600 text-sm hover:text-white transition-colors cursor-pointer border border-mid-gray/20"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
