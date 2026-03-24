#!/usr/bin/env npx tsx
/**
 * Setup Shopify Products for CustomCaseGuy
 *
 * Creates one product per case type, with one variant per device.
 * Products are hidden from the Online Store (Distinct.ink) so they're
 * only accessible via the Storefront API (customcaseguy.com).
 *
 * Usage:
 *   1. Add SHOPIFY_ADMIN_ACCESS_TOKEN and SHOPIFY_MYSHOPIFY_DOMAIN to .env.local
 *   2. Run: npx tsx scripts/setup-shopify-products.ts
 *   3. Copy the output variant map into src/lib/shopify-variants.ts
 *
 * Prerequisites:
 *   - A Shopify custom app with Admin API access scopes:
 *     write_products, read_products, write_publications, read_publications
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN
const MYSHOPIFY_DOMAIN = process.env.SHOPIFY_MYSHOPIFY_DOMAIN || 'distinct-ink.myshopify.com'

if (!ADMIN_TOKEN) {
  console.error('❌ Missing SHOPIFY_ADMIN_ACCESS_TOKEN in .env.local')
  console.error('')
  console.error('To get one:')
  console.error('  1. Go to Shopify Admin → Settings → Apps → Develop apps')
  console.error('  2. Create an app called "CustomCaseGuy API"')
  console.error('  3. Configure Admin API scopes: write_products, read_products, write_publications, read_publications')
  console.error('  4. Install the app and copy the Admin API access token')
  console.error('  5. Add to .env.local: SHOPIFY_ADMIN_ACCESS_TOKEN=shpat_xxxxx')
  console.error('  6. Also add: SHOPIFY_MYSHOPIFY_DOMAIN=your-store.myshopify.com')
  process.exit(1)
}

const API_URL = `https://${MYSHOPIFY_DOMAIN}/admin/api/2026-01/graphql.json`

// ---------------------------------------------------------------------------
// Data: case types and devices (mirrored from constants.ts)
// ---------------------------------------------------------------------------

const CASE_TYPES = [
  { id: 'symmetry', name: 'OtterBox Symmetry', price: '79.99', productType: 'Phone Case' },
  { id: 'commuter', name: 'OtterBox Commuter', price: '89.99', productType: 'Phone Case' },
  { id: 'defender', name: 'OtterBox Defender', price: '99.99', productType: 'Phone Case' },
  { id: 'clear', name: 'Clear MagSafe Case', price: '29.99', productType: 'Phone Case' },
  { id: 'magsafe', name: 'MagSafe Tough Case', price: '39.99', productType: 'Phone Case' },
  { id: 'ipad-defender', name: 'iPad Defender', price: '74.99', productType: 'iPad Case' },
]

const PHONE_DEVICES = [
  { id: 'ip17pm', name: 'iPhone 17 Pro Max' },
  { id: 'ip17p', name: 'iPhone 17 Pro' },
  { id: 'ip17', name: 'iPhone 17' },
  { id: 'ip17a', name: 'iPhone 17 Air' },
  { id: 'ip16pm', name: 'iPhone 16 Pro Max' },
  { id: 'ip16p', name: 'iPhone 16 Pro' },
  { id: 'ip16', name: 'iPhone 16' },
  { id: 'gs25u', name: 'Galaxy S25 Ultra' },
  { id: 'gs25p', name: 'Galaxy S25+' },
  { id: 'gs25', name: 'Galaxy S25' },
]

const IPAD_DEVICES = [
  { id: 'ipadpro13', name: 'iPad Pro 13"' },
  { id: 'ipadpro11', name: 'iPad Pro 11"' },
  { id: 'ipadair', name: 'iPad Air' },
]

// ---------------------------------------------------------------------------
// Shopify Admin API helpers
// ---------------------------------------------------------------------------

async function adminFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN!,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Shopify Admin API ${res.status}: ${text}`)
  }

  const json = await res.json()
  if (json.errors) {
    throw new Error(JSON.stringify(json.errors, null, 2))
  }
  return json.data
}

// Get the Online Store publication ID
async function getOnlineStorePublicationId(): Promise<string | null> {
  const data = await adminFetch<{
    publications: { edges: { node: { id: string; name: string } }[] }
  }>(`query { publications(first: 10) { edges { node { id name } } } }`)

  const pub = data.publications.edges.find(
    (e) => e.node.name === 'Online Store'
  )
  return pub?.node.id || null
}

// Create a product, then add device variants separately
// (Shopify API 2026-01 no longer accepts variants on ProductInput)
async function createProduct(
  caseType: typeof CASE_TYPES[number],
  devices: typeof PHONE_DEVICES
) {
  const title = `Custom ${caseType.name}`

  console.log(`  Creating "${title}"...`)

  // Step 1: Create the product (without variants)
  const createMutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          handle
          variants(first: 1) {
            edges {
              node {
                id
              }
            }
          }
        }
        userErrors { field message }
      }
    }
  `

  const createData = await adminFetch<{
    productCreate: {
      product: {
        id: string
        handle: string
        variants: { edges: { node: { id: string } }[] }
      }
      userErrors: { field: string[]; message: string }[]
    }
  }>(createMutation, {
    input: {
      title,
      productType: caseType.productType,
      vendor: 'CustomCaseGuy',
      tags: ['customcaseguy', `ccg-${caseType.id}`, 'custom-print', 'print-on-demand'],
      status: 'ACTIVE',
      descriptionHtml: `<p>Custom-printed ${caseType.name} designed and printed in the USA by CustomCaseGuy.</p><p>Choose your device model and design at <a href="https://customcaseguy.com">customcaseguy.com</a>.</p>`,
    },
  })

  if (createData.productCreate.userErrors.length > 0) {
    throw new Error(createData.productCreate.userErrors.map((e) => e.message).join(', '))
  }

  const product = createData.productCreate.product
  // The default variant created with the product
  const defaultVariantId = product.variants.edges[0]?.node.id

  // Step 2: Create device variants using productVariantsBulkCreate
  console.log(`    Adding ${devices.length} device variants...`)

  const variantsMutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants {
          id
          title
          sku
        }
        userErrors { field message }
      }
    }
  `

  const variantsData = await adminFetch<{
    productVariantsBulkCreate: {
      productVariants: { id: string; title: string; sku: string }[]
      userErrors: { field: string[]; message: string }[]
    }
  }>(variantsMutation, {
    productId: product.id,
    variants: devices.map((device) => ({
      optionValues: [{ optionName: 'Device', name: device.name }],
      price: caseType.price,
      sku: `CCG-${caseType.id.toUpperCase()}-${device.id.toUpperCase()}`,
      inventoryPolicy: 'CONTINUE',
      requiresShipping: true,
      taxable: true,
    })),
  })

  if (variantsData.productVariantsBulkCreate.userErrors.length > 0) {
    throw new Error(variantsData.productVariantsBulkCreate.userErrors.map((e) => e.message).join(', '))
  }

  // Step 3: Delete the default variant (it has no device associated)
  if (defaultVariantId) {
    const deleteMutation = `
      mutation productVariantDelete($id: ID!) {
        productVariantDelete(id: $id) {
          userErrors { field message }
        }
      }
    `
    await adminFetch(deleteMutation, { id: defaultVariantId })
  }

  return {
    id: product.id,
    handle: product.handle,
    variants: variantsData.productVariantsBulkCreate.productVariants,
  }
}

// Unpublish product from Online Store
async function unpublishFromOnlineStore(productId: string, publicationId: string) {
  const mutation = `
    mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
      publishableUnpublish(id: $id, input: $input) {
        userErrors { field message }
      }
    }
  `

  await adminFetch(mutation, {
    id: productId,
    input: [{ publicationId }],
  })
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('🔧 CustomCaseGuy Shopify Product Setup')
  console.log(`   Store: ${MYSHOPIFY_DOMAIN}`)
  console.log('')

  // Step 1: Get Online Store publication ID
  console.log('1. Finding Online Store publication...')
  const onlineStorePubId = await getOnlineStorePublicationId()
  if (onlineStorePubId) {
    console.log(`   Found: ${onlineStorePubId}`)
  } else {
    console.log('   ⚠️  Online Store publication not found — products may be visible')
  }
  console.log('')

  // Step 2: Create products
  console.log('2. Creating products...')
  const variantMap: Record<string, Record<string, string>> = {}

  for (const caseType of CASE_TYPES) {
    const devices = caseType.id === 'ipad-defender' ? IPAD_DEVICES : PHONE_DEVICES
    const product = await createProduct(caseType, devices)

    // Build variant map
    variantMap[caseType.id] = {}
    for (const variant of product.variants) {
      const device = devices.find((d) => d.name === variant.title)
      if (device) {
        variantMap[caseType.id][device.id] = variant.id
      }
    }

    // Unpublish from Online Store (hide from Distinct.ink)
    if (onlineStorePubId) {
      await unpublishFromOnlineStore(product.id, onlineStorePubId)
      console.log(`   ✅ "${product.handle}" — hidden from Online Store`)
    } else {
      console.log(`   ✅ "${product.handle}" — created`)
    }

    // Rate limiting: Shopify allows ~2 requests/sec for mutations
    await new Promise((r) => setTimeout(r, 1000))
  }

  console.log('')
  console.log('3. Done! Copy this variant map into src/lib/shopify-variants.ts:')
  console.log('')
  console.log('// Auto-generated by scripts/setup-shopify-products.ts')
  console.log('// Maps caseTypeId → deviceId → Shopify variant GID')
  console.log('export const VARIANT_MAP: Record<string, Record<string, string>> = ' +
    JSON.stringify(variantMap, null, 2))
  console.log('')
  console.log('✅ All products created and hidden from Distinct.ink storefront.')
  console.log('   They are only accessible via the Storefront API on customcaseguy.com.')
}

main().catch((err) => {
  console.error('❌ Setup failed:', err.message)
  process.exit(1)
})
