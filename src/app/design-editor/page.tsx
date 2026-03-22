'use client'

import { useState } from 'react'
import { CASE_TYPES, DEVICES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'

type EditorTab = 'text' | 'upload' | 'shapes' | 'background'

const FONTS = [
  'Plus Jakarta Sans',
  'Outfit',
  'Georgia',
  'Courier New',
  'Pacifico',
  'Bebas Neue',
  'Playfair Display',
  'Permanent Marker',
]

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#FF1F6E', '#FF6B9D', '#FFB3CC',
  '#FF0000', '#FF8C00', '#FFD700', '#00FF00', '#00CED1',
  '#0000FF', '#8B00FF', '#FF69B4', '#C0C0C0', '#8B4513',
]

const SHAPES = [
  { name: 'Circle', icon: '○' },
  { name: 'Square', icon: '□' },
  { name: 'Triangle', icon: '△' },
  { name: 'Star', icon: '☆' },
  { name: 'Heart', icon: '♡' },
  { name: 'Diamond', icon: '◇' },
  { name: 'Line', icon: '—' },
]

export default function DesignEditorPage() {
  const [activeTab, setActiveTab] = useState<EditorTab>('text')
  const [selectedCase, setSelectedCase] = useState('symmetry')
  const [selectedDevice, setSelectedDevice] = useState('ip17pm')
  const [textInput, setTextInput] = useState('')
  const [selectedFont, setSelectedFont] = useState(FONTS[0])
  const [fontSize, setFontSize] = useState(32)
  const [textColor, setTextColor] = useState('#FFFFFF')
  const [bgColor, setBgColor] = useState('#0A0A0A')

  const caseType = CASE_TYPES.find((c) => c.id === selectedCase)!
  const phoneCases = CASE_TYPES.filter((c) => c.id !== 'ipad-defender')
  const phoneDevices = DEVICES.filter((d) => d.category !== 'ipad')

  const handleAddToCart = () => {
    alert(`Custom design added to cart!\n${caseType.name} for ${DEVICES.find((d) => d.id === selectedDevice)?.name}\n$${caseType.price.toFixed(2)}`)
  }

  const tabs: { id: EditorTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'text',
      label: 'Text',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" x2="15" y1="20" y2="20"/><line x1="12" x2="12" y1="4" y2="20"/></svg>,
    },
    {
      id: 'upload',
      label: 'Upload',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/></svg>,
    },
    {
      id: 'shapes',
      label: 'Shapes',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>,
    },
    {
      id: 'background',
      label: 'Background',
      icon: <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>,
    },
  ]

  return (
    <div className="pt-16 min-h-screen flex flex-col">
      {/* Top bar: Case + Device selectors */}
      <div className="bg-charcoal border-b border-mid-gray/20 px-4 py-3 flex flex-wrap items-center gap-4">
        <select
          value={selectedCase}
          onChange={(e) => setSelectedCase(e.target.value)}
          className="bg-dark-gray text-white text-sm rounded-xl px-4 py-2 border border-mid-gray/20 font-body cursor-pointer"
        >
          {phoneCases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} — ${c.price.toFixed(2)}
            </option>
          ))}
        </select>
        <select
          value={selectedDevice}
          onChange={(e) => setSelectedDevice(e.target.value)}
          className="bg-dark-gray text-white text-sm rounded-xl px-4 py-2 border border-mid-gray/20 font-body cursor-pointer"
        >
          {phoneDevices.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <div className="flex-1" />
        <Button onClick={handleAddToCart} size="sm">
          Add to Cart — ${caseType.price.toFixed(2)}
        </Button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row">
        {/* Left: Editor Tools */}
        <div className="lg:w-80 bg-charcoal border-r border-mid-gray/20 flex flex-col">
          {/* Tab buttons */}
          <div className="flex lg:flex-col border-b lg:border-b-0 border-mid-gray/20">
            <div className="flex lg:grid lg:grid-cols-4 w-full">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-3 px-2 text-xs font-display font-600 transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'text-hot-pink border-b-2 lg:border-b-0 lg:bg-dark-gray/50 border-hot-pink'
                      : 'text-light-gray hover:text-white'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 p-4 overflow-y-auto">
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Text
                  </label>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your text..."
                    className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body placeholder:text-mid-gray focus:border-hot-pink focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Font
                  </label>
                  <select
                    value={selectedFont}
                    onChange={(e) => setSelectedFont(e.target.value)}
                    className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body cursor-pointer"
                  >
                    {FONTS.map((font) => (
                      <option key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Size: {fontSize}px
                  </label>
                  <input
                    type="range"
                    min="12"
                    max="120"
                    value={fontSize}
                    onChange={(e) => setFontSize(Number(e.target.value))}
                    className="w-full accent-hot-pink"
                  />
                </div>

                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Text Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setTextColor(color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer ${
                          textColor === color ? 'border-hot-pink scale-110' : 'border-mid-gray/20'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <button className="flex-1 py-2 rounded-lg bg-dark-gray text-light-gray text-sm font-display font-700 hover:text-white transition-colors cursor-pointer">
                    B
                  </button>
                  <button className="flex-1 py-2 rounded-lg bg-dark-gray text-light-gray text-sm font-display font-600 italic hover:text-white transition-colors cursor-pointer">
                    I
                  </button>
                  <button className="flex-1 py-2 rounded-lg bg-dark-gray text-light-gray text-sm font-display font-600 underline hover:text-white transition-colors cursor-pointer">
                    U
                  </button>
                </div>
              </div>
            )}

            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-mid-gray/30 rounded-2xl p-8 text-center hover:border-hot-pink/30 transition-colors cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-mid-gray mb-4">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                  </svg>
                  <p className="text-light-gray text-sm font-body mb-1">
                    Drag & drop an image
                  </p>
                  <p className="text-mid-gray text-xs font-body">
                    PNG, JPG, SVG up to 50MB
                  </p>
                </div>
              </div>
            )}

            {activeTab === 'shapes' && (
              <div className="space-y-4">
                <label className="block text-xs text-light-gray font-display font-600 mb-2">
                  Add a Shape
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {SHAPES.map((shape) => (
                    <button
                      key={shape.name}
                      className="aspect-square rounded-xl bg-dark-gray border border-mid-gray/20 flex items-center justify-center text-2xl text-light-gray hover:text-hot-pink hover:border-hot-pink/30 transition-all cursor-pointer"
                      title={shape.name}
                    >
                      {shape.icon}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Shape Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.slice(0, 10).map((color) => (
                      <button
                        key={color}
                        className="w-8 h-8 rounded-lg border-2 border-mid-gray/20 hover:border-hot-pink transition-all cursor-pointer"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'background' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Background Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_COLORS.map((color) => (
                      <button
                        key={color}
                        onClick={() => setBgColor(color)}
                        className={`w-8 h-8 rounded-lg border-2 transition-all cursor-pointer ${
                          bgColor === color ? 'border-hot-pink scale-110' : 'border-mid-gray/20'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Custom Hex
                  </label>
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body focus:border-hot-pink focus:outline-none"
                    placeholder="#000000"
                  />
                </div>

                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Pattern Backgrounds
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['Chevron', 'Dots', 'Marble', 'Tie-Dye', 'Stripes', 'Grid'].map((pattern) => (
                      <button
                        key={pattern}
                        className="aspect-square rounded-xl bg-dark-gray border border-mid-gray/20 flex items-center justify-center text-xs text-light-gray hover:text-hot-pink hover:border-hot-pink/30 transition-all cursor-pointer font-body"
                      >
                        {pattern}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex-1 flex items-center justify-center p-8 bg-primary-black">
          <div className="relative">
            {/* Canvas area */}
            <div
              className="w-[280px] h-[560px] sm:w-[320px] sm:h-[640px] rounded-[2.5rem] border-2 border-mid-gray/30 shadow-2xl overflow-hidden transition-colors"
              style={{ backgroundColor: bgColor }}
            >
              {/* Text preview */}
              {textInput && (
                <div className="absolute inset-0 flex items-center justify-center p-4">
                  <p
                    className="text-center break-words max-w-full"
                    style={{
                      fontFamily: selectedFont,
                      fontSize: `${fontSize}px`,
                      color: textColor,
                    }}
                  >
                    {textInput}
                  </p>
                </div>
              )}

              {!textInput && (
                <div className="h-full flex items-center justify-center">
                  <p className="text-mid-gray text-sm font-body text-center px-8">
                    Your design will appear here
                  </p>
                </div>
              )}
            </div>

            {/* Glow behind case */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-hot-pink/5 blur-[80px] -z-10" />
          </div>
        </div>

        {/* Right: Live Preview (desktop) */}
        <div className="hidden xl:flex xl:w-72 bg-charcoal border-l border-mid-gray/20 flex-col items-center justify-center p-6">
          <p className="text-xs text-light-gray font-display font-600 uppercase tracking-wider mb-4">
            Live Preview
          </p>
          <div className="w-36 h-72 rounded-[1.5rem] bg-dark-gray border border-mid-gray/20 shadow-xl flex items-center justify-center overflow-hidden">
            <div
              className="w-full h-full flex items-center justify-center p-2"
              style={{ backgroundColor: bgColor }}
            >
              {textInput ? (
                <p
                  className="text-center break-words text-xs"
                  style={{
                    fontFamily: selectedFont,
                    color: textColor,
                  }}
                >
                  {textInput}
                </p>
              ) : (
                <span className="text-mid-gray text-xs font-body">Preview</span>
              )}
            </div>
          </div>
          <p className="text-xs text-mid-gray font-body mt-3 text-center">
            {caseType.name}
          </p>
        </div>
      </div>
    </div>
  )
}
