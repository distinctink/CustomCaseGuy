'use client'

import { useState, useEffect } from 'react'
import { CASE_TYPES, DEVICES } from '@/lib/constants'
import { Button } from '@/components/ui/Button'

type EditorTab = 'text' | 'upload' | 'shapes' | 'background'

// Google Fonts organized by style for easy browsing
const FONT_CATEGORIES = [
  {
    label: 'Script & Handwritten',
    fonts: [
      'Pacifico', 'Dancing Script', 'Great Vibes', 'Satisfy', 'Sacramento',
      'Allura', 'Cookie', 'Kaushan Script', 'Lobster', 'Lobster Two',
      'Tangerine', 'Alex Brush', 'Niconne', 'Arizonia', 'Courgette',
      'Yellowtail', 'Marck Script', 'Caveat', 'Shadows Into Light',
      'Indie Flower', 'Permanent Marker', 'Rock Salt', 'Reenie Beanie',
      'Handlee', 'Patrick Hand', 'Architects Daughter', 'Gloria Hallelujah',
      'Just Another Hand', 'Covered By Your Grace', 'Homemade Apple',
    ],
  },
  {
    label: 'Serif & Elegant',
    fonts: [
      'Playfair Display', 'Cormorant Garamond', 'Libre Baskerville', 'Lora',
      'Merriweather', 'EB Garamond', 'Crimson Text', 'Source Serif 4',
      'Noto Serif', 'PT Serif', 'Vollkorn', 'Spectral', 'Bitter',
      'Domine', 'Cardo', 'Newsreader', 'Sorts Mill Goudy', 'Old Standard TT',
      'Cinzel', 'Cinzel Decorative', 'Cormorant', 'Cormorant Upright',
      'DM Serif Display', 'DM Serif Text', 'Bodoni Moda',
    ],
  },
  {
    label: 'Sans Serif & Clean',
    fonts: [
      'Plus Jakarta Sans', 'Outfit', 'Inter', 'Montserrat', 'Poppins',
      'Raleway', 'Open Sans', 'Nunito', 'Quicksand', 'Rubik',
      'Work Sans', 'Manrope', 'DM Sans', 'Space Grotesk', 'Sora',
      'Albert Sans', 'Figtree', 'Urbanist', 'Jost', 'Karla',
      'Lato', 'Source Sans 3', 'Mulish', 'Lexend', 'Barlow',
      'Josefin Sans', 'Nunito Sans', 'Exo 2', 'Comfortaa', 'Varela Round',
    ],
  },
  {
    label: 'Bold & Display',
    fonts: [
      'Bebas Neue', 'Oswald', 'Anton', 'Archivo Black', 'Teko',
      'Passion One', 'Righteous', 'Bungee', 'Bungee Shade',
      'Black Ops One', 'Russo One', 'Secular One', 'Staatliches',
      'Bowlby One SC', 'Dela Gothic One', 'Fugaz One', 'Lilita One',
      'Rampart One', 'Rubik Mono One', 'Ultra', 'Alfa Slab One',
      'Changa One', 'Concert One', 'Fredoka One', 'Titan One',
    ],
  },
  {
    label: 'Monospace & Retro',
    fonts: [
      'Space Mono', 'JetBrains Mono', 'Fira Code', 'Source Code Pro',
      'IBM Plex Mono', 'Courier Prime', 'Roboto Mono', 'Ubuntu Mono',
      'Press Start 2P', 'VT323', 'Silkscreen', 'DotGothic16',
      'Special Elite', 'Cutive Mono',
    ],
  },
  {
    label: 'Decorative & Fun',
    fonts: [
      'Abril Fatface', 'Shrikhand', 'Monoton', 'Bungee Inline',
      'Faster One', 'Fascinate Inline', 'Rampart One', 'Rubik Wet Paint',
      'Rubik Glitch', 'Rubik Burned', 'Rubik Distressed', 'Rubik Vinyl',
      'Rubik Marker Hatch', 'Rubik Spray Paint', 'Rubik Storm',
      'Creepster', 'Eater', 'Nosifer', 'Butcherman',
      'Fredericka the Great', 'Griffy', 'Jolly Lodger',
    ],
  },
]

const ALL_FONTS = FONT_CATEGORIES.flatMap((cat) => cat.fonts)

const PRESET_COLORS = [
  '#FFFFFF', '#000000', '#FF1F6E', '#FF6B9D', '#FFB3CC',
  '#FF0000', '#FF8C00', '#FFD700', '#00FF00', '#00CED1',
  '#0000FF', '#8B00FF', '#FF69B4', '#C0C0C0', '#8B4513',
  '#2C3E50', '#1ABC9C', '#E74C3C', '#9B59B6', '#F39C12',
]

const BASIC_SHAPES = [
  { name: 'Circle', icon: '○' },
  { name: 'Square', icon: '□' },
  { name: 'Triangle', icon: '△' },
  { name: 'Star', icon: '☆' },
  { name: 'Heart', icon: '♡' },
  { name: 'Diamond', icon: '◇' },
  { name: 'Line', icon: '—' },
  { name: 'Arrow', icon: '→' },
]

// Banner & frame shapes for monograms/names
const BANNER_SHAPES = [
  {
    name: 'Circle Frame',
    description: 'Classic circle border',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <circle cx="100" cy="100" r="85" fill="none" stroke={color} strokeWidth="4" />
        <circle cx="100" cy="100" r="78" fill="none" stroke={color} strokeWidth="1" />
      </svg>
    ),
  },
  {
    name: 'Double Circle',
    description: 'Elegant double ring',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <circle cx="100" cy="100" r="90" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="100" cy="100" r="75" fill="none" stroke={color} strokeWidth="2" />
      </svg>
    ),
  },
  {
    name: 'Diamond Frame',
    description: 'Rotated square border',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <rect x="35" y="35" width="130" height="130" fill="none" stroke={color} strokeWidth="3" transform="rotate(45 100 100)" />
      </svg>
    ),
  },
  {
    name: 'Shield Crest',
    description: 'Classic shield shape',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <path d="M100 20 L170 50 L170 120 Q170 170 100 190 Q30 170 30 120 L30 50 Z" fill="none" stroke={color} strokeWidth="3" />
      </svg>
    ),
  },
  {
    name: 'Laurel Wreath',
    description: 'Victory wreath frame',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <path d="M90 180 Q40 150 30 100 Q25 60 50 35" fill="none" stroke={color} strokeWidth="2.5" />
        <path d="M110 180 Q160 150 170 100 Q175 60 150 35" fill="none" stroke={color} strokeWidth="2.5" />
        {[40, 55, 70, 85, 100, 115, 130].map((y, i) => (
          <ellipse key={`l${i}`} cx={35 + i * 3} cy={y} rx="8" ry="4" fill="none" stroke={color} strokeWidth="1.5" transform={`rotate(${-30 + i * 5} ${35 + i * 3} ${y})`} />
        ))}
        {[40, 55, 70, 85, 100, 115, 130].map((y, i) => (
          <ellipse key={`r${i}`} cx={165 - i * 3} cy={y} rx="8" ry="4" fill="none" stroke={color} strokeWidth="1.5" transform={`rotate(${30 - i * 5} ${165 - i * 3} ${y})`} />
        ))}
      </svg>
    ),
  },
  {
    name: 'Ribbon Banner',
    description: 'Classic ribbon scroll',
    svg: (color: string) => (
      <svg viewBox="0 0 200 80" className="w-full h-full">
        <path d="M10 15 L30 15 L35 0 L40 15 L160 15 L165 0 L170 15 L190 15 L190 55 L170 55 L165 70 L160 55 L40 55 L35 70 L30 55 L10 55 Z" fill="none" stroke={color} strokeWidth="2.5" />
      </svg>
    ),
  },
  {
    name: 'Oval Frame',
    description: 'Elegant oval border',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <ellipse cx="100" cy="100" rx="85" ry="70" fill="none" stroke={color} strokeWidth="3" />
        <ellipse cx="100" cy="100" rx="78" ry="63" fill="none" stroke={color} strokeWidth="1" />
      </svg>
    ),
  },
  {
    name: 'Hexagon',
    description: 'Modern hex frame',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <polygon points="100,15 175,55 175,145 100,185 25,145 25,55" fill="none" stroke={color} strokeWidth="3" />
      </svg>
    ),
  },
  {
    name: 'Ornate Rectangle',
    description: 'Decorative corners',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <rect x="25" y="40" width="150" height="120" fill="none" stroke={color} strokeWidth="2" rx="3" />
        <path d="M25 55 L15 40 M175 55 L185 40 M25 145 L15 160 M175 145 L185 160" stroke={color} strokeWidth="2" fill="none" />
        <circle cx="25" cy="40" r="3" fill={color} /><circle cx="175" cy="40" r="3" fill={color} />
        <circle cx="25" cy="160" r="3" fill={color} /><circle cx="175" cy="160" r="3" fill={color} />
      </svg>
    ),
  },
  {
    name: 'Split Monogram',
    description: 'Line through center',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <line x1="20" y1="90" x2="180" y2="90" stroke={color} strokeWidth="1.5" />
        <line x1="20" y1="110" x2="180" y2="110" stroke={color} strokeWidth="1.5" />
      </svg>
    ),
  },
  {
    name: 'Arch Frame',
    description: 'Rounded arch top',
    svg: (color: string) => (
      <svg viewBox="0 0 200 200" className="w-full h-full">
        <path d="M40 180 L40 80 Q40 20 100 20 Q160 20 160 80 L160 180" fill="none" stroke={color} strokeWidth="3" />
        <line x1="40" y1="180" x2="160" y2="180" stroke={color} strokeWidth="3" />
      </svg>
    ),
  },
  {
    name: 'Flourish Divider',
    description: 'Decorative line divider',
    svg: (color: string) => (
      <svg viewBox="0 0 200 60" className="w-full h-full">
        <line x1="10" y1="30" x2="70" y2="30" stroke={color} strokeWidth="1.5" />
        <line x1="130" y1="30" x2="190" y2="30" stroke={color} strokeWidth="1.5" />
        <path d="M80 30 Q90 15 100 30 Q110 45 120 30" fill="none" stroke={color} strokeWidth="2" />
      </svg>
    ),
  },
]

export default function DesignEditorPage() {
  const [activeTab, setActiveTab] = useState<EditorTab>('text')
  const [selectedCase, setSelectedCase] = useState('symmetry')
  const [selectedDevice, setSelectedDevice] = useState('ip17pm')
  const [textInput, setTextInput] = useState('')
  const [selectedFont, setSelectedFont] = useState('Plus Jakarta Sans')
  const [fontSize, setFontSize] = useState(32)
  const [textColor, setTextColor] = useState('#FFFFFF')
  const [bgColor, setBgColor] = useState('#0A0A0A')
  const [fontSearch, setFontSearch] = useState('')
  const [activeFontCategory, setActiveFontCategory] = useState(0)
  const [selectedBanner, setSelectedBanner] = useState<number | null>(null)
  const [bannerColor, setBannerColor] = useState('#D4AF37')
  const [shapesSubTab, setShapesSubTab] = useState<'basic' | 'banners'>('banners')

  const caseType = CASE_TYPES.find((c) => c.id === selectedCase)!
  const phoneCases = CASE_TYPES.filter((c) => c.id !== 'ipad-defender')
  const phoneDevices = DEVICES.filter((d) => d.category !== 'ipad')

  // Load the selected Google Font dynamically
  useEffect(() => {
    const link = document.createElement('link')
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(selectedFont)}:wght@400;700&display=swap`
    link.rel = 'stylesheet'
    document.head.appendChild(link)
    return () => { document.head.removeChild(link) }
  }, [selectedFont])

  const handleAddToCart = () => {
    alert(`Custom design added to cart!\n${caseType.name} for ${DEVICES.find((d) => d.id === selectedDevice)?.name}\n$${caseType.price.toFixed(2)}`)
  }

  // Filter fonts by search
  const filteredFonts = fontSearch
    ? ALL_FONTS.filter((f) => f.toLowerCase().includes(fontSearch.toLowerCase()))
    : FONT_CATEGORIES[activeFontCategory].fonts

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
      {/* Top bar */}
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
            {/* ============ TEXT TAB ============ */}
            {activeTab === 'text' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Your Text
                  </label>
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    placeholder="Type your name, initials, message..."
                    className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body placeholder:text-mid-gray focus:border-hot-pink focus:outline-none"
                  />
                </div>

                {/* Font search */}
                <div>
                  <label className="block text-xs text-light-gray font-display font-600 mb-2">
                    Font ({ALL_FONTS.length} available)
                  </label>
                  <input
                    type="text"
                    value={fontSearch}
                    onChange={(e) => setFontSearch(e.target.value)}
                    placeholder="Search fonts..."
                    className="w-full bg-dark-gray text-white text-sm rounded-xl px-4 py-3 border border-mid-gray/20 font-body placeholder:text-mid-gray focus:border-hot-pink focus:outline-none mb-2"
                  />

                  {/* Font category tabs (hidden when searching) */}
                  {!fontSearch && (
                    <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
                      {FONT_CATEGORIES.map((cat, i) => (
                        <button
                          key={cat.label}
                          onClick={() => setActiveFontCategory(i)}
                          className={`whitespace-nowrap px-2.5 py-1 rounded-lg text-xs font-display font-600 transition-all cursor-pointer ${
                            activeFontCategory === i
                              ? 'bg-hot-pink text-white'
                              : 'bg-dark-gray text-mid-gray hover:text-light-gray'
                          }`}
                        >
                          {cat.label.split(' & ')[0]}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Font list */}
                  <div className="max-h-40 overflow-y-auto rounded-xl border border-mid-gray/20 bg-dark-gray">
                    {filteredFonts.map((font) => (
                      <button
                        key={font}
                        onClick={() => setSelectedFont(font)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors cursor-pointer ${
                          selectedFont === font
                            ? 'bg-hot-pink/20 text-hot-pink'
                            : 'text-light-gray hover:bg-dark-gray hover:text-white'
                        }`}
                      >
                        <span style={{ fontFamily: font }}>{font}</span>
                      </button>
                    ))}
                    {filteredFonts.length === 0 && (
                      <p className="px-3 py-4 text-mid-gray text-xs text-center font-body">
                        No fonts match &quot;{fontSearch}&quot;
                      </p>
                    )}
                  </div>
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

            {/* ============ UPLOAD TAB ============ */}
            {activeTab === 'upload' && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-mid-gray/30 rounded-2xl p-8 text-center hover:border-hot-pink/30 transition-colors cursor-pointer">
                  <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-mid-gray mb-4">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>
                  </svg>
                  <p className="text-light-gray text-sm font-body mb-1">
                    Drag & drop your image
                  </p>
                  <p className="text-mid-gray text-xs font-body">
                    PNG, JPG, SVG up to 50MB
                  </p>
                </div>
                <p className="text-mid-gray text-xs font-body text-center">
                  Upload a photo, logo, or artwork. You can resize and position it on your case.
                </p>
              </div>
            )}

            {/* ============ SHAPES TAB ============ */}
            {activeTab === 'shapes' && (
              <div className="space-y-4">
                {/* Sub-tabs: Banners vs Basic Shapes */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setShapesSubTab('banners')}
                    className={`flex-1 py-2 rounded-lg text-xs font-display font-600 transition-all cursor-pointer ${
                      shapesSubTab === 'banners'
                        ? 'bg-hot-pink text-white'
                        : 'bg-dark-gray text-light-gray hover:text-white'
                    }`}
                  >
                    Banners & Frames
                  </button>
                  <button
                    onClick={() => setShapesSubTab('basic')}
                    className={`flex-1 py-2 rounded-lg text-xs font-display font-600 transition-all cursor-pointer ${
                      shapesSubTab === 'basic'
                        ? 'bg-hot-pink text-white'
                        : 'bg-dark-gray text-light-gray hover:text-white'
                    }`}
                  >
                    Basic Shapes
                  </button>
                </div>

                {shapesSubTab === 'banners' && (
                  <>
                    <p className="text-mid-gray text-xs font-body">
                      Add a frame or banner for your name or monogram.
                    </p>

                    {/* Banner color */}
                    <div>
                      <label className="block text-xs text-light-gray font-display font-600 mb-2">
                        Frame Color
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {['#D4AF37', '#FFFFFF', '#C0C0C0', '#FF1F6E', '#000000', '#FFB3CC', '#8B4513', '#00CED1', '#FF8C00', '#2C3E50'].map((color) => (
                          <button
                            key={color}
                            onClick={() => setBannerColor(color)}
                            className={`w-7 h-7 rounded-lg border-2 transition-all cursor-pointer ${
                              bannerColor === color ? 'border-hot-pink scale-110' : 'border-mid-gray/20'
                            }`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Banner grid */}
                    <div className="grid grid-cols-2 gap-2">
                      {BANNER_SHAPES.map((banner, i) => (
                        <button
                          key={banner.name}
                          onClick={() => setSelectedBanner(selectedBanner === i ? null : i)}
                          className={`aspect-square rounded-xl border p-3 flex flex-col items-center justify-center transition-all cursor-pointer ${
                            selectedBanner === i
                              ? 'border-hot-pink bg-hot-pink/10 shadow-lg shadow-hot-pink/10'
                              : 'border-mid-gray/20 bg-dark-gray hover:border-mid-gray/40'
                          }`}
                          title={banner.description}
                        >
                          <div className="w-full flex-1 flex items-center justify-center">
                            {banner.svg(selectedBanner === i ? '#FF1F6E' : bannerColor)}
                          </div>
                          <span className="text-[10px] text-light-gray mt-1 font-body leading-tight text-center">
                            {banner.name}
                          </span>
                        </button>
                      ))}
                    </div>
                  </>
                )}

                {shapesSubTab === 'basic' && (
                  <>
                    <label className="block text-xs text-light-gray font-display font-600 mb-2">
                      Add a Shape
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {BASIC_SHAPES.map((shape) => (
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
                  </>
                )}
              </div>
            )}

            {/* ============ BACKGROUND TAB ============ */}
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
                    Custom Color
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
            <div
              className="w-[280px] h-[560px] sm:w-[320px] sm:h-[640px] rounded-[2.5rem] border-2 border-mid-gray/30 shadow-2xl overflow-hidden transition-colors relative"
              style={{ backgroundColor: bgColor }}
            >
              {/* Banner/frame overlay */}
              {selectedBanner !== null && (
                <div className="absolute inset-0 flex items-center justify-center p-8 pointer-events-none">
                  <div className="w-full h-full max-w-[240px] max-h-[240px]">
                    {BANNER_SHAPES[selectedBanner].svg(bannerColor)}
                  </div>
                </div>
              )}

              {/* Text preview */}
              {textInput && (
                <div className="absolute inset-0 flex items-center justify-center p-4 z-10">
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

              {!textInput && selectedBanner === null && (
                <div className="h-full flex items-center justify-center">
                  <p className="text-mid-gray text-sm font-body text-center px-8">
                    Your design will appear here
                  </p>
                </div>
              )}
            </div>

            {/* Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-hot-pink/5 blur-[80px] -z-10" />
          </div>
        </div>

        {/* Right: Live Preview */}
        <div className="hidden xl:flex xl:w-72 bg-charcoal border-l border-mid-gray/20 flex-col items-center justify-center p-6">
          <p className="text-xs text-light-gray font-display font-600 uppercase tracking-wider mb-4">
            Preview
          </p>
          <div className="w-36 h-72 rounded-[1.5rem] bg-dark-gray border border-mid-gray/20 shadow-xl flex items-center justify-center overflow-hidden relative">
            <div
              className="w-full h-full flex items-center justify-center p-2 relative"
              style={{ backgroundColor: bgColor }}
            >
              {/* Mini banner preview */}
              {selectedBanner !== null && (
                <div className="absolute inset-0 flex items-center justify-center p-3 pointer-events-none">
                  <div className="w-full h-full max-w-[100px] max-h-[100px]">
                    {BANNER_SHAPES[selectedBanner].svg(bannerColor)}
                  </div>
                </div>
              )}
              {textInput ? (
                <p
                  className="text-center break-words text-xs z-10 relative"
                  style={{
                    fontFamily: selectedFont,
                    color: textColor,
                  }}
                >
                  {textInput}
                </p>
              ) : selectedBanner === null ? (
                <span className="text-mid-gray text-xs font-body">Preview</span>
              ) : null}
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
