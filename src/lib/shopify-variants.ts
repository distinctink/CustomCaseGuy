// Shopify Variant ID Mapping
// Maps caseTypeId → deviceId → Shopify variant GID
//
// After running `npx tsx scripts/setup-shopify-products.ts`, replace the
// VARIANT_MAP below with the generated output.
//
// Until then, the checkout flow will still work — it just won't map to
// specific Shopify variants (Shopify will show a generic checkout).

export const VARIANT_MAP: Record<string, Record<string, string>> = {
  // Example (will be replaced by setup script output):
  // symmetry: {
  //   ip17pm: 'gid://shopify/ProductVariant/12345678',
  //   ip17p: 'gid://shopify/ProductVariant/12345679',
  //   ...
  // },
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
