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
    ip17pm: 'gid://shopify/ProductVariant/48883658064124',
    ip17p: 'gid://shopify/ProductVariant/48883658096892',
    ip17: 'gid://shopify/ProductVariant/48883658129660',
    ip17a: 'gid://shopify/ProductVariant/48883658162428',
    ip16pm: 'gid://shopify/ProductVariant/48883658195196',
    ip16p: 'gid://shopify/ProductVariant/48883658227964',
    ip16: 'gid://shopify/ProductVariant/48883658260732',
    gs25u: 'gid://shopify/ProductVariant/48883658293500',
    gs25p: 'gid://shopify/ProductVariant/48883658326268',
    gs25: 'gid://shopify/ProductVariant/48883658359036',
  },
  commuter: {
    ip17pm: 'gid://shopify/ProductVariant/48883658391804',
    ip17p: 'gid://shopify/ProductVariant/48883658424572',
    ip17: 'gid://shopify/ProductVariant/48883658457340',
    ip17a: 'gid://shopify/ProductVariant/48883658490108',
    ip16pm: 'gid://shopify/ProductVariant/48883658522876',
    ip16p: 'gid://shopify/ProductVariant/48883658555644',
    ip16: 'gid://shopify/ProductVariant/48883658588412',
    gs25u: 'gid://shopify/ProductVariant/48883658621180',
    gs25p: 'gid://shopify/ProductVariant/48883658653948',
    gs25: 'gid://shopify/ProductVariant/48883658686716',
  },
  defender: {
    ip17pm: 'gid://shopify/ProductVariant/48883658719484',
    ip17p: 'gid://shopify/ProductVariant/48883658752252',
    ip17: 'gid://shopify/ProductVariant/48883658785020',
    ip17a: 'gid://shopify/ProductVariant/48883658817788',
    ip16pm: 'gid://shopify/ProductVariant/48883658850556',
    ip16p: 'gid://shopify/ProductVariant/48883658883324',
    ip16: 'gid://shopify/ProductVariant/48883658916092',
    gs25u: 'gid://shopify/ProductVariant/48883658948860',
    gs25p: 'gid://shopify/ProductVariant/48883658981628',
    gs25: 'gid://shopify/ProductVariant/48883659014396',
  },
  clear: {
    ip17pm: 'gid://shopify/ProductVariant/48883659079932',
    ip17p: 'gid://shopify/ProductVariant/48883659112700',
    ip17: 'gid://shopify/ProductVariant/48883659145468',
    ip17a: 'gid://shopify/ProductVariant/48883659178236',
    ip16pm: 'gid://shopify/ProductVariant/48883659211004',
    ip16p: 'gid://shopify/ProductVariant/48883659243772',
    ip16: 'gid://shopify/ProductVariant/48883659276540',
    gs25u: 'gid://shopify/ProductVariant/48883659309308',
    gs25p: 'gid://shopify/ProductVariant/48883659342076',
    gs25: 'gid://shopify/ProductVariant/48883659374844',
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
