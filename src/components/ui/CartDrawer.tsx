'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useCart } from '@/lib/cart-context'
import { createCheckout } from '@/lib/shopify'
import { Button } from '@/components/ui/Button'

export function CartDrawer() {
  const { items, isOpen, setIsOpen, removeItem, updateQuantity, totalItems, totalPrice, clearCart } = useCart()
  const [checkingOut, setCheckingOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const drawerRef = useRef<HTMLDivElement>(null)

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, setIsOpen])

  const handleCheckout = async () => {
    setCheckingOut(true)
    setError(null)

    try {
      // Build line items with custom attributes for each cart item
      const lineItems = items.map((item) => ({
        variantId: btoa(`gid://shopify/ProductVariant/${item.caseType}`), // placeholder mapping
        quantity: item.quantity,
        customAttributes: [
          { key: '_design_slug', value: item.designSlug },
          { key: '_colorway', value: item.colorwayName },
          { key: '_case_type', value: item.caseType },
          { key: '_case_name', value: item.caseName },
          { key: '_device', value: item.deviceId },
          { key: '_device_name', value: item.deviceName },
          ...(item.customizationImageUrl
            ? [{ key: '_customization_image', value: item.customizationImageUrl }]
            : []),
        ],
      }))

      // Create Shopify checkout with all items
      const checkout = await createCheckout(
        lineItems[0].variantId,
        lineItems[0].quantity,
        lineItems[0].customAttributes
      )

      clearCart()
      setIsOpen(false)
      window.location.href = checkout.webUrl
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Checkout failed. Please try again.'
      )
      setCheckingOut(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsOpen(false)}
        aria-hidden
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-label="Shopping cart"
        className="fixed top-0 right-0 z-50 h-full w-full max-w-md bg-charcoal border-l border-mid-gray/20 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-mid-gray/20">
          <h2 className="font-display font-700 text-xl text-white">
            Cart{totalItems > 0 && ` (${totalItems})`}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            aria-label="Close cart"
            className="text-light-gray hover:text-white transition-colors cursor-pointer"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-mid-gray mb-4">
                <circle cx="8" cy="21" r="1" /><circle cx="19" cy="21" r="1" />
                <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
              </svg>
              <p className="text-light-gray font-body mb-2">Your cart is empty</p>
              <p className="text-mid-gray text-sm font-body mb-6">
                Find a design you love and add it to your cart.
              </p>
              <Button
                href="/shop-by-design"
                size="sm"
                onClick={() => setIsOpen(false)}
              >
                Browse Designs
              </Button>
            </div>
          ) : (
            <ul className="space-y-4">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-4 p-4 rounded-xl bg-dark-gray/50 border border-mid-gray/10"
                >
                  {/* Thumbnail placeholder */}
                  <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-hot-pink/10 to-soft-pink/5 border border-mid-gray/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-mid-gray text-[10px] font-body text-center leading-tight px-1">
                      {item.designName}
                    </span>
                  </div>

                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/product/${item.designSlug}?case=${item.caseType}&device=${item.deviceId}`}
                      className="font-display font-600 text-sm text-white hover:text-hot-pink transition-colors line-clamp-1"
                      onClick={() => setIsOpen(false)}
                    >
                      {item.designName}
                    </Link>
                    <p className="text-mid-gray text-xs font-body mt-0.5 line-clamp-1">
                      {item.colorwayName} · {item.caseName}
                    </p>
                    <p className="text-mid-gray text-xs font-body line-clamp-1">
                      {item.deviceName}
                    </p>

                    <div className="flex items-center justify-between mt-2">
                      {/* Quantity */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          aria-label="Decrease quantity"
                          className="w-7 h-7 rounded-lg bg-dark-gray border border-mid-gray/20 text-light-gray hover:text-white hover:border-mid-gray/40 flex items-center justify-center text-sm cursor-pointer transition-colors"
                        >
                          -
                        </button>
                        <span className="w-8 text-center text-sm text-white font-body">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          aria-label="Increase quantity"
                          className="w-7 h-7 rounded-lg bg-dark-gray border border-mid-gray/20 text-light-gray hover:text-white hover:border-mid-gray/40 flex items-center justify-center text-sm cursor-pointer transition-colors"
                        >
                          +
                        </button>
                      </div>

                      {/* Price + remove */}
                      <div className="flex items-center gap-3">
                        <span className="text-hot-pink font-display font-600 text-sm">
                          ${(item.price * item.quantity).toFixed(2)}
                        </span>
                        <button
                          onClick={() => removeItem(item.id)}
                          aria-label={`Remove ${item.designName}`}
                          className="text-mid-gray hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-mid-gray/20 px-6 py-5 space-y-4">
            {error && (
              <p className="text-red-400 text-sm font-body text-center">{error}</p>
            )}

            <div className="flex items-center justify-between">
              <span className="text-light-gray font-body text-sm">Subtotal</span>
              <span className="text-white font-display font-700 text-xl">
                ${totalPrice.toFixed(2)}
              </span>
            </div>

            <p className="text-mid-gray text-xs font-body">
              Free shipping on all U.S. orders. Taxes calculated at checkout.
            </p>

            <Button
              onClick={handleCheckout}
              fullWidth
              size="lg"
              disabled={checkingOut}
            >
              {checkingOut ? 'Redirecting to Checkout...' : `Checkout — $${totalPrice.toFixed(2)}`}
            </Button>

            <button
              onClick={() => setIsOpen(false)}
              className="w-full text-center text-light-gray text-sm font-display font-600 hover:text-white transition-colors cursor-pointer py-1"
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  )
}
