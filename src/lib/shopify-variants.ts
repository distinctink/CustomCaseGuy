// Shopify Variant ID Mapping
// Maps caseTypeId → deviceId → Shopify variant GID
//
// After running `npx tsx scripts/setup-shopify-products.ts`, replace the
// VARIANT_MAP below with the generated output.
//
// Until then, the checkout flow will still work — it just won't map to
// specific Shopify variants (Shopify will show a generic checkout).

export const VARIANT_MAP: Record<string, Record<string, string>> = {
  symmetry: {
    ip17pm: 'gid://shopify/ProductVariant/48883659407612',
    ip17p: 'gid://shopify/ProductVariant/48883659440380',
    ip17: 'gid://shopify/ProductVariant/48883659473148',
    ip17a: 'gid://shopify/ProductVariant/48883659505916',
    ip16pm: 'gid://shopify/ProductVariant/48883659538684',
    ip16p: 'gid://shopify/ProductVariant/48883659571452',
    ip16: 'gid://shopify/ProductVariant/48883659604220',
    gs25u: 'gid://shopify/ProductVariant/48883659636988',
    gs25p: 'gid://shopify/ProductVariant/48883659669756',
    gs25: 'gid://shopify/ProductVariant/48883659702524',
  },
  commuter: {
    ip17pm: 'gid://shopify/ProductVariant/48883659407612',
    ip17p: 'gid://shopify/ProductVariant/48883659440380',
    ip17: 'gid://shopify/ProductVariant/48883659473148',
    ip17a: 'gid://shopify/ProductVariant/48883659505916',
    ip16pm: 'gid://shopify/ProductVariant/48883659538684',
    ip16p: 'gid://shopify/ProductVariant/48883659571452',
    ip16: 'gid://shopify/ProductVariant/48883659604220',
    gs25u: 'gid://shopify/ProductVariant/48883659636988',
    gs25p: 'gid://shopify/ProductVariant/48883659669756',
    gs25: 'gid://shopify/ProductVariant/48883659702524',
  },
  defender: {
    ip17pm: 'gid://shopify/ProductVariant/48883659407612',
    ip17p: 'gid://shopify/ProductVariant/48883659440380',
    ip17: 'gid://shopify/ProductVariant/48883659473148',
    ip17a: 'gid://shopify/ProductVariant/48883659505916',
    ip16pm: 'gid://shopify/ProductVariant/48883659538684',
    ip16p: 'gid://shopify/ProductVariant/48883659571452',
    ip16: 'gid://shopify/ProductVariant/48883659604220',
    gs25u: 'gid://shopify/ProductVariant/48883659636988',
    gs25p: 'gid://shopify/ProductVariant/48883659669756',
    gs25: 'gid://shopify/ProductVariant/48883659702524',
  },
  clear: {
    ip17pm: 'gid://shopify/ProductVariant/48883659407612',
    ip17p: 'gid://shopify/ProductVariant/48883659440380',
    ip17: 'gid://shopify/ProductVariant/48883659473148',
    ip17a: 'gid://shopify/ProductVariant/48883659505916',
    ip16pm: 'gid://shopify/ProductVariant/48883659538684',
    ip16p: 'gid://shopify/ProductVariant/48883659571452',
    ip16: 'gid://shopify/ProductVariant/48883659604220',
    gs25u: 'gid://shopify/ProductVariant/48883659636988',
    gs25p: 'gid://shopify/ProductVariant/48883659669756',
    gs25: 'gid://shopify/ProductVariant/48883659702524',
  },
  magsafe: {
    ip17pm: 'gid://shopify/ProductVariant/48883659407612',
    ip17p: 'gid://shopify/ProductVariant/48883659440380',
    ip17: 'gid://shopify/ProductVariant/48883659473148',
    ip17a: 'gid://shopify/ProductVariant/48883659505916',
    ip16pm: 'gid://shopify/ProductVariant/48883659538684',
    ip16p: 'gid://shopify/ProductVariant/48883659571452',
    ip16: 'gid://shopify/ProductVariant/48883659604220',
    gs25u: 'gid://shopify/ProductVariant/48883659636988',
    gs25p: 'gid://shopify/ProductVariant/48883659669756',
    gs25: 'gid://shopify/ProductVariant/48883659702524',
  },
  'ipad-defender': {
    ipadpro13: 'gid://shopify/ProductVariant/48883659735292',
    ipadpro11: 'gid://shopify/ProductVariant/48883659768060',
    ipadair: 'gid://shopify/ProductVariant/48883659800828',
  },
}

/**
 * Look up the Shopify variant ID for a case type + device combo.
 * Returns null if no mapping exists yet (products not created in Shopify).
 */
export function getVariantId(caseTypeId: string, deviceId: string): string | null {
  return VARIANT_MAP[caseTypeId]?.[deviceId] || null
}

/**
 * Check whether variant mappings have been configured.
 */
export function hasVariantMappings(): boolean {
  return Object.keys(VARIANT_MAP).length > 0
}
