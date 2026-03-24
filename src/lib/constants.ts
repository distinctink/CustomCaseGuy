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
// NOTE: `bullets` here are generic (no device context) — used on the homepage.
// For device-specific bullets use getCaseBullets() below.
export const CASE_TYPES = [
  {
    id: 'symmetry',
    name: 'OtterBox Symmetry',
    price: 79.99,
    tag: 'BESTSELLER',
    tagline: 'Slim profile. Serious protection.',
    description:
      'A sleek, one-piece design that slides easily in and out of pockets. Raised beveled edges guard the camera and touchscreen from flat-surface drops and scratches. Tested to 3x military standard (MIL-STD-810G).',
    bullets: [
      'One-piece, easy-on/easy-off design',
      'Raised beveled edges protect screen & camera',
      '3x military-standard drop tested (MIL-STD-810G)',
      'Slim enough for front or back pockets',
      'Vivid, scratch-resistant custom print',
      'MagSafe & wireless charging (iPhone 16+)',
    ],
  },
  {
    id: 'commuter',
    name: 'OtterBox Commuter',
    price: 89.99,
    tag: 'DAILY DRIVER',
    tagline: 'Two layers. Pocket-friendly.',
    description:
      'Dual-layer protection without the bulk. A soft inner slipcover absorbs and disperses shock while the rigid outer shell deflects impacts. Port covers keep out dust, lint, and debris.',
    bullets: [
      'Dual-layer: soft inner slipcover + hard outer shell',
      'Port covers block dust, lint, and debris',
      'Slim enough for pockets and bags',
      'Tested beyond military drop standards',
      'Vivid, scratch-resistant custom print',
      'MagSafe & wireless charging (iPhone 16+)',
    ],
  },
  {
    id: 'defender',
    name: 'OtterBox Defender',
    price: 99.99,
    tag: 'MAX PROTECTION',
    tagline: 'Our toughest case. Period.',
    description:
      'Multi-layer defense engineered for the harshest conditions. Tested to 4x military standard with port covers that seal out dust and grit. The most rugged case we offer.',
    bullets: [
      'Multi-layer construction for maximum impact absorption',
      'Port covers seal out dust, dirt, and debris',
      '4x military-standard drop tested (MIL-STD-810G)',
      'Vivid, scratch-resistant custom print',
      'MagSafe & wireless charging (iPhone 16+)',
      'Holster included on select models',
    ],
  },
  {
    id: 'clear',
    name: 'Clear MagSafe Case',
    price: 29.99,
    tag: 'CRYSTAL CLEAR',
    tagline: 'Crystal clear. MagSafe ready.',
    description:
      'Show off your custom design with edge-to-edge clarity. Built-in MagSafe ring for seamless charging and accessories. Anti-yellowing coating keeps the case crystal clear long after other clear cases go cloudy.',
    bullets: [
      'Crystal-clear, anti-yellowing polycarbonate shell',
      'Built-in MagSafe magnet ring (iPhone 12+)',
      'Shockproof TPU bumper edges',
      'Slim, lightweight profile',
      'Vivid, scratch-resistant custom print',
      'Ships within 24-48 hours',
    ],
  },
  {
    id: 'magsafe',
    name: 'MagSafe Tough Case',
    price: 39.99,
    tag: 'MAGSAFE',
    tagline: 'Tough protection. Magnetic convenience.',
    description:
      'Premium dual-layer protection with a built-in MagSafe magnet array. Snap on chargers, wallets, and mounts instantly. Military-grade drop protection in a sleek, pocket-friendly form factor.',
    bullets: [
      'Built-in MagSafe magnets (iPhone 12+)',
      'Dual-layer: impact-absorbing TPU + rigid backplate',
      'Military-grade drop protection (6ft / 1.8m)',
      'Raised edges guard screen & camera lens',
      'Vivid, scratch-resistant custom print',
      'Ships within 24-48 hours',
    ],
  },
  {
    id: 'ipad-defender',
    name: 'iPad Defender',
    price: 74.99,
    tag: 'TABLET TOUGH',
    tagline: 'Maximum tablet protection.',
    description:
      'Heavy-duty protection for your iPad. Multi-layer construction with a built-in screen shield. Port covers block dust and debris.',
    bullets: [
      'Multi-layer construction with built-in screen shield',
      'Port covers block dust and debris',
      'Tested to military drop standards',
      'Vivid, scratch-resistant custom print',
      'Wireless charging compatible',
      'Ships within 24-48 hours',
    ],
  },
] as const

// ---------------------------------------------------------------------------
// Device-awareness helpers
// ---------------------------------------------------------------------------

/** Extract iPhone generation number from a device ID (e.g. 'ip17pm' → 17) */
function iPhoneGen(deviceId: string): number | null {
  const m = deviceId.match(/^ip(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

/** Extract Galaxy S generation number from a device ID (e.g. 'gs25u' → 25) */
function galaxyGen(deviceId: string): number | null {
  const m = deviceId.match(/^gs(\d+)/)
  return m ? parseInt(m[1], 10) : null
}

/** Does this device + case combo support MagSafe / MagCase? */
export function supportsMagSafe(caseId: string, deviceId: string): boolean {
  const iph = iPhoneGen(deviceId)
  const gal = galaxyGen(deviceId)

  // Clear & MagSafe Tough: magnetic from iPhone 12+, Galaxy S26+
  if (caseId === 'clear' || caseId === 'magsafe') {
    if (iph !== null) return iph >= 12
    if (gal !== null) return gal >= 26
    return false
  }

  // OtterBox cases: MagSafe from iPhone 16+, Galaxy S26+ (MagCase)
  if (iph !== null) return iph >= 16
  if (gal !== null) return gal >= 26
  return false
}

/** Does the Defender for this device include a holster? (Pre-iPhone 16 only) */
export function includesHolster(deviceId: string): boolean {
  const iph = iPhoneGen(deviceId)
  if (iph !== null) return iph < 16
  // Galaxy and iPad Defenders never shipped with holster
  return false
}

/**
 * Magnetic / wireless-charging bullet text for a given device.
 * Returns null when the device doesn't support MagSafe/MagCase — we make
 * no wireless-charging claims on pre-MagSafe devices to avoid disputes.
 */
function magBullet(caseId: string, deviceId: string): string | null {
  const gal = galaxyGen(deviceId)
  const mag = supportsMagSafe(caseId, deviceId)

  if (!mag) return null

  if (gal !== null && gal >= 26) return 'MagCase compatible (snap-on charging & accessories)'
  return 'MagSafe compatible (snap-on charging & accessories)'
}

/**
 * Return device-specific feature bullets for a case + device combination.
 * Use this on the product detail page where the device is known.
 */
export function getCaseBullets(caseId: string, deviceId: string): string[] {
  const gal = galaxyGen(deviceId)
  const mag = supportsMagSafe(caseId, deviceId)
  const magLabel = gal !== null && gal >= 26 ? 'MagCase' : 'MagSafe'

  const chargingBullet = magBullet(caseId, deviceId)

  switch (caseId) {
    case 'symmetry': {
      const list = [
        'One-piece, easy-on/easy-off design',
        'Raised beveled edges protect screen & camera',
        '3x military-standard drop tested (MIL-STD-810G)',
        'Slim enough for front or back pockets',
        'Vivid, scratch-resistant custom print',
      ]
      if (chargingBullet) list.push(chargingBullet)
      return list
    }
    case 'commuter': {
      const list = [
        'Dual-layer: soft inner slipcover + hard outer shell',
        'Port covers block dust, lint, and debris',
        'Slim enough for pockets and bags',
        'Tested beyond military drop standards',
        'Vivid, scratch-resistant custom print',
      ]
      if (chargingBullet) list.push(chargingBullet)
      return list
    }
    case 'defender': {
      const list = [
        'Multi-layer construction for maximum impact absorption',
        'Port covers seal out dust, dirt, and debris',
      ]
      if (includesHolster(deviceId)) {
        list.push('Includes holster/belt clip that doubles as a kickstand')
      }
      list.push(
        '4x military-standard drop tested (MIL-STD-810G)',
        'Vivid, scratch-resistant custom print',
      )
      if (chargingBullet) list.push(chargingBullet)
      return list
    }
    case 'clear': {
      const list = [
        'Crystal-clear, anti-yellowing polycarbonate shell',
      ]
      if (mag) {
        list.push(`Built-in ${magLabel} magnet ring for snap-on charging`)
      }
      list.push(
        'Shockproof TPU bumper edges',
        'Slim, lightweight profile',
        'Vivid, scratch-resistant custom print',
        'Ships within 24-48 hours',
      )
      return list
    }
    case 'magsafe': {
      const list: string[] = []
      if (mag) {
        list.push(`Built-in ${magLabel} magnets for chargers, wallets & mounts`)
      }
      list.push(
        'Dual-layer: impact-absorbing TPU + rigid backplate',
        'Military-grade drop protection (6ft / 1.8m)',
        'Raised edges guard screen & camera lens',
        'Vivid, scratch-resistant custom print',
        'Ships within 24-48 hours',
      )
      return list
    }
    default: {
      const ct = CASE_TYPES.find((c) => c.id === caseId)
      return ct ? [...ct.bullets] : []
    }
  }
}

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
  { label: 'Designed & Printed in the USA', icon: 'map-pin' },
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
