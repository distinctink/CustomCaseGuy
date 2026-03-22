'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { SAMPLE_DESIGNS } from '@/lib/sample-data'
import { CASE_TYPES, DEVICES, COLLECTIONS } from '@/lib/constants'

type AdminTab = 'designs' | 'products' | 'mockups' | 'analytics'

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('designs')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [password, setPassword] = useState('')

  if (!isAuthenticated) {
    return (
      <div className="pt-24 pb-16 flex items-center justify-center min-h-screen">
        <div className="w-full max-w-sm p-8 rounded-2xl bg-charcoal border border-mid-gray/10">
          <h1 className="font-display font-700 text-2xl text-white mb-6 text-center">
            Admin Login
          </h1>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              // Simple password check — replace with proper auth
              if (password === 'admin' || password) {
                setIsAuthenticated(true)
              }
            }}
            className="space-y-4"
          >
            <label htmlFor="admin-password" className="sr-only">Password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body placeholder:text-mid-gray focus:border-hot-pink focus:outline-none"
            />
            <Button type="submit" fullWidth>
              Sign In
            </Button>
          </form>
        </div>
      </div>
    )
  }

  const tabs: { id: AdminTab; label: string }[] = [
    { id: 'designs', label: 'Designs' },
    { id: 'products', label: 'Products' },
    { id: 'mockups', label: 'Mockup Queue' },
    { id: 'analytics', label: 'Analytics' },
  ]

  return (
    <div className="pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display font-800 text-3xl text-white">
            Admin Panel
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAuthenticated(false)}
          >
            Sign Out
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 border-b border-mid-gray/20 pb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 rounded-xl text-sm font-display font-600 transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-hot-pink text-white'
                  : 'bg-dark-gray text-light-gray hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Design Management */}
        {activeTab === 'designs' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-700 text-xl text-white">
                Design Catalog ({SAMPLE_DESIGNS.length} designs)
              </h2>
              <Button size="sm">Upload New Design</Button>
            </div>

            {/* Upload zone */}
            <div className="mb-6 border-2 border-dashed border-mid-gray/30 rounded-2xl p-8 text-center hover:border-hot-pink/30 transition-colors cursor-pointer">
              <p className="text-light-gray font-body text-sm mb-1">
                Drag & drop design files here to upload
              </p>
              <p className="text-mid-gray font-body text-xs">
                Files should be named: collection-design-name-colorway.png (e.g., florals-rose-garden-a.png)
              </p>
            </div>

            {/* Design table */}
            <div className="overflow-x-auto rounded-2xl bg-charcoal border border-mid-gray/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mid-gray/20">
                    <th className="text-left p-4 font-display font-600 text-light-gray">Name</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Collection</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Colorway</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Status</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {SAMPLE_DESIGNS.map((design) => (
                    <tr key={design.slug} className="border-b border-mid-gray/10 hover:bg-dark-gray/30">
                      <td className="p-4 font-body text-white">{design.name}</td>
                      <td className="p-4 font-body text-light-gray">{design.collection}</td>
                      <td className="p-4 font-body text-light-gray">{design.colorwayName}</td>
                      <td className="p-4">
                        <span className="bg-green-500/10 text-green-400 text-xs font-display font-600 px-2 py-1 rounded-full">
                          Active
                        </span>
                      </td>
                      <td className="p-4">
                        <button className="text-hot-pink text-xs font-display font-600 hover:underline cursor-pointer mr-3">
                          Edit
                        </button>
                        <button className="text-mid-gray text-xs font-display font-600 hover:text-red-400 cursor-pointer">
                          Deactivate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Product Management */}
        {activeTab === 'products' && (
          <div>
            <h2 className="font-display font-700 text-xl text-white mb-6">
              Products ({CASE_TYPES.length} case types × {DEVICES.length} devices)
            </h2>

            <div className="overflow-x-auto rounded-2xl bg-charcoal border border-mid-gray/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-mid-gray/20">
                    <th className="text-left p-4 font-display font-600 text-light-gray">Case Type</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Devices</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Price</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Templates</th>
                    <th className="text-left p-4 font-display font-600 text-light-gray">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {CASE_TYPES.map((ct) => {
                    const isIPadCase = ct.id === 'ipad-defender'
                    const deviceCount = isIPadCase
                      ? DEVICES.filter((d) => d.category === 'ipad').length
                      : DEVICES.filter((d) => d.category !== 'ipad').length
                    return (
                      <tr key={ct.id} className="border-b border-mid-gray/10 hover:bg-dark-gray/30">
                        <td className="p-4 font-body text-white">{ct.name}</td>
                        <td className="p-4 font-body text-light-gray">{deviceCount} devices</td>
                        <td className="p-4 font-body text-hot-pink font-display font-600">
                          ${ct.price.toFixed(2)}
                        </td>
                        <td className="p-4">
                          <span className="bg-yellow-500/10 text-yellow-400 text-xs font-display font-600 px-2 py-1 rounded-full">
                            Pending Upload
                          </span>
                        </td>
                        <td className="p-4">
                          <span className="bg-green-500/10 text-green-400 text-xs font-display font-600 px-2 py-1 rounded-full">
                            Active
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Mockup Queue */}
        {activeTab === 'mockups' && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-700 text-xl text-white">
                Mockup Generation Queue
              </h2>
              <Button size="sm">Trigger Bulk Generation</Button>
            </div>

            <div className="grid sm:grid-cols-4 gap-4 mb-8">
              {[
                { label: 'Pending', count: 0, color: 'text-yellow-400 bg-yellow-500/10' },
                { label: 'Generating', count: 0, color: 'text-blue-400 bg-blue-500/10' },
                { label: 'Complete', count: 0, color: 'text-green-400 bg-green-500/10' },
                { label: 'Failed', count: 0, color: 'text-red-400 bg-red-500/10' },
              ].map((status) => (
                <div key={status.label} className="p-6 rounded-2xl bg-charcoal border border-mid-gray/10 text-center">
                  <p className={`font-display font-800 text-3xl ${status.color.split(' ')[0]}`}>
                    {status.count}
                  </p>
                  <p className="text-light-gray text-sm font-body mt-1">{status.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8 text-center">
              <p className="text-light-gray font-body">
                No mockups in queue. Upload PSD templates and design files to begin.
              </p>
              <p className="text-mid-gray text-sm font-body mt-2">
                Estimated cost: ~$65 for full initial catalog (32,550 renders at $0.002/each)
              </p>
            </div>
          </div>
        )}

        {/* Analytics */}
        {activeTab === 'analytics' && (
          <div>
            <h2 className="font-display font-700 text-xl text-white mb-6">
              Analytics Overview
            </h2>

            <div className="grid sm:grid-cols-3 gap-4 mb-8">
              {[
                { label: 'Total Designs', value: SAMPLE_DESIGNS.length },
                { label: 'Collections', value: COLLECTIONS.length },
                { label: 'Product Combos', value: CASE_TYPES.length * DEVICES.length },
              ].map((stat) => (
                <div key={stat.label} className="p-6 rounded-2xl bg-charcoal border border-mid-gray/10 text-center">
                  <p className="font-display font-800 text-3xl text-hot-pink">{stat.value}</p>
                  <p className="text-light-gray text-sm font-body mt-1">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-charcoal border border-mid-gray/10 p-8 text-center">
              <p className="text-light-gray font-body">
                Analytics data will populate once the site is live and receiving traffic.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
