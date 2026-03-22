// ============================================
// CustomCaseGuy Constants & Product Data
// ============================================

export const SITE = {
  name: 'CustomCaseGuy',
  tagline: 'Your Case. Your Design. Your Rules.',
  domain: 'customcaseguy.com',
  email: 'info@customcaseguy.com',
} as const

export const COLORS = {
  primaryBlack: '#0A0A0A',
  charcoal: '#1A1A1A',
  darkGray: '#2A2A2A',
  midGray: '#444444',
  lightGray: '#999999',
  white: '#FFFFFF',
  hotPink: '#FF1F6E',
  softPink: '#FF6B9D',
  warmPink: '#FFB3CC',
} as const

// Case types with metadata
export const CASE_TYPES = [
  {
    id: 'symmetry',
    name: 'OtterBox Symmetry',
    price: 49.99,
    tag: 'BESTSELLER',
    tagline: 'Slim + stylish. Our bestseller.',
    description:
      'Sleek, one-piece design that slips in and out of pockets. Raised edges protect camera and screen. Our most popular case.',
  },
  {
    id: 'commuter',
    name: 'OtterBox Commuter',
    price: 54.99,
    tag: 'DAILY DRIVER',
    tagline: 'Two layers. Pocket-friendly.',
    description:
      'Two-layer protection with a slim profile. Inner slipcover absorbs shock, outer shell deflects impact.',
  },
  {
    id: 'defender',
    name: 'OtterBox Defender',
    price: 64.99,
    tag: 'MAX PROTECTION',
    tagline: 'Maximum protection.',
    description:
      'Multi-layer defense for serious drops. Port covers block dust and debris. The toughest case we offer.',
  },
  {
    id: 'clear',
    name: 'Clear Shockproof',
    price: 34.99,
    tag: 'CRYSTAL CLEAR',
    tagline: 'Crystal clear. Anti-yellowing.',
    description:
      'Show off your design with crystal clarity. Anti-yellowing coating stays clear for years.',
  },
  {
    id: 'magsafe',
    name: 'MagSafe Tough Case',
    price: 44.99,
    tag: 'MAGSAFE',
    tagline: 'Built-in MagSafe magnets.',
    description:
      'Built-in magnets for seamless MagSafe charging and accessories. Premium protection with magnetic convenience.',
  },
  {
    id: 'ipad-defender',
    name: 'iPad Defender',
    price: 74.99,
    tag: 'TABLET TOUGH',
    tagline: 'Maximum tablet protection.',
    description:
      'Heavy-duty protection for your iPad. Multi-layer construction with a built-in screen shield.',
  },
] as const

export type CaseTypeId = (typeof CASE_TYPES)[number]['id']

// Device catalog
export const DEVICES = [
  // iPhone 17 series
  { id: 'ip17pm', name: 'iPhone 17 Pro Max', brand: 'Apple', category: 'iphone' },
  { id: 'ip17p', name: 'iPhone 17 Pro', brand: 'Apple', category: 'iphone' },
  { id: 'ip17', name: 'iPhone 17', brand: 'Apple', category: 'iphone' },
  { id: 'ip17a', name: 'iPhone 17 Air', brand: 'Apple', category: 'iphone' },
  // iPhone 16 series
  { id: 'ip16pm', name: 'iPhone 16 Pro Max', brand: 'Apple', category: 'iphone' },
  { id: 'ip16p', name: 'iPhone 16 Pro', brand: 'Apple', category: 'iphone' },
  { id: 'ip16', name: 'iPhone 16', brand: 'Apple', category: 'iphone' },
  // Samsung Galaxy
  { id: 'gs25u', name: 'Galaxy S25 Ultra', brand: 'Samsung', category: 'samsung' },
  { id: 'gs25p', name: 'Galaxy S25+', brand: 'Samsung', category: 'samsung' },
  { id: 'gs25', name: 'Galaxy S25', brand: 'Samsung', category: 'samsung' },
  // iPads
  { id: 'ipadpro13', name: 'iPad Pro 13"', brand: 'Apple', category: 'ipad' },
  { id: 'ipadpro11', name: 'iPad Pro 11"', brand: 'Apple', category: 'ipad' },
  { id: 'ipadair', name: 'iPad Air', brand: 'Apple', category: 'ipad' },
] as const

export type DeviceId = (typeof DEVICES)[number]['id']

// Collections
export const COLLECTIONS = [
  { id: 'florals', name: 'Florals & Botanical', icon: '🌸', priority: 1 },
  { id: 'marble', name: 'Marble & Stone', icon: '🪨', priority: 2 },
  { id: 'monogram', name: 'Monogram & Personalized', icon: '✒️', priority: 3 },
  { id: 'abstract', name: 'Abstract & Modern Art', icon: '🎨', priority: 4 },
  { id: 'geometric', name: 'Geometric & Pattern', icon: '🔷', priority: 5 },
  { id: 'nature', name: 'Nature & Landscape', icon: '🏔️', priority: 6 },
  { id: 'animals', name: 'Animals & Pets', icon: '🦋', priority: 7 },
  { id: 'camo', name: 'Camo & Tactical', icon: '🎯', priority: 8 },
  { id: 'celestial', name: 'Celestial & Cosmic', icon: '🌌', priority: 9 },
  { id: 'sports', name: 'Sports & Outdoor', icon: '⚾', priority: 10 },
  { id: 'patriotic', name: 'Patriotic & First Responder', icon: '🇺🇸', priority: 11 },
  { id: 'holiday', name: 'Holiday & Seasonal', icon: '🎄', priority: 12 },
  { id: 'occupation', name: 'Occupation & Hobby', icon: '☕', priority: 13 },
  { id: 'minimalist', name: 'Minimalist & Solid', icon: '◻️', priority: 14 },
  { id: 'tiedye', name: 'Tie-Dye & Retro', icon: '🌀', priority: 15 },
] as const

export type CollectionId = (typeof COLLECTIONS)[number]['id']

// Seasonal visibility windows
export const SEASONAL_WINDOWS = {
  valentines: { from: '01-10', until: '02-16' },
  stpatricks: { from: '02-20', until: '03-18' },
  easter: { from: '03-01', until: '04-20' },
  mothersday: { from: '04-15', until: '05-12' },
  fathersday: { from: '05-15', until: '06-16' },
  summer: { from: '05-25', until: '09-05' },
  backtoschool: { from: '07-15', until: '09-15' },
  halloween: { from: '09-01', until: '11-02' },
  fall: { from: '08-25', until: '11-25' },
  christmas: { from: '10-10', until: '12-27' },
  newyear: { from: '12-15', until: '01-05' },
  winter: { from: '11-20', until: '03-01' },
} as const

// Trust bar items
export const TRUST_ITEMS = [
  { label: 'Made in Orlando', icon: 'map-pin' },
  { label: 'Free Shipping', icon: 'truck' },
  { label: '24-48hr Turnaround', icon: 'clock' },
  { label: 'Genuine OtterBox', icon: 'shield-check' },
  { label: '400K+ Sold', icon: 'package' },
] as const

// S3 URL helper
export function getMockupUrl(
  designSlug: string,
  caseType: string,
  deviceId: string,
  angle: 'front' | 'angle' | 'lifestyle' = 'front'
): string {
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET || 'ccg-assets'
  return `https://${bucket}.s3.amazonaws.com/mockups/${designSlug}/${caseType}-${deviceId}-${angle}.jpg`
}

export function getDesignUrl(collection: string, slug: string): string {
  const bucket = process.env.NEXT_PUBLIC_S3_BUCKET || 'ccg-assets'
  return `https://${bucket}.s3.amazonaws.com/designs/${collection}/${slug}.png`
}
