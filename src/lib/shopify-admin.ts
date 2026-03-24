// Shopify Admin API Integration
// Used for product management (creating products, managing variants, etc.)
// Requires SHOPIFY_ADMIN_ACCESS_TOKEN in .env.local

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN || 'customcaseguy.com'
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN || ''

// The myshopify domain is needed for Admin API calls
// customcaseguy.com is the custom domain; the Admin API uses the .myshopify.com domain
const MYSHOPIFY_DOMAIN = process.env.SHOPIFY_MYSHOPIFY_DOMAIN || 'distinct-ink.myshopify.com'
const ADMIN_API_URL = `https://${MYSHOPIFY_DOMAIN}/admin/api/2026-01/graphql.json`

async function adminFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(ADMIN_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Shopify Admin API error ${response.status}: ${text}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(json.errors[0]?.message || JSON.stringify(json.errors))
  }

  return json.data
}

// Create a product with variants (one variant per device)
export async function createProduct({
  title,
  productType,
  tags,
  variants,
  status = 'ACTIVE',
}: {
  title: string
  productType: string
  tags: string[]
  variants: { name: string; price: string; sku: string }[]
  status?: 'ACTIVE' | 'DRAFT'
}) {
  // Step 1: Create the product
  const createMutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          handle
          title
          status
          variants(first: 100) {
            edges {
              node {
                id
                title
                sku
                price
              }
            }
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `

  const data = await adminFetch<{
    productCreate: {
      product: {
        id: string
        handle: string
        title: string
        status: string
        variants: {
          edges: {
            node: { id: string; title: string; sku: string; price: string }
          }[]
        }
      }
      userErrors: { field: string[]; message: string }[]
    }
  }>(createMutation, {
    input: {
      title,
      productType,
      tags,
      status,
      variants: variants.map((v) => ({
        title: v.name,
        price: v.price,
        sku: v.sku,
        inventoryPolicy: 'CONTINUE', // always available (print on demand)
        requiresShipping: true,
      })),
    },
  })

  if (data.productCreate.userErrors.length > 0) {
    throw new Error(
      data.productCreate.userErrors.map((e) => e.message).join(', ')
    )
  }

  return data.productCreate.product
}

// Hide product from the online store (only available via Storefront API)
export async function hideProductFromOnlineStore(productId: string) {
  // Remove product from the "Online Store" sales channel
  // by unpublishing it from that channel
  const mutation = `
    mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
      publishableUnpublish(id: $id, input: $input) {
        publishable {
          availablePublicationsCount {
            count
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `

  // First, get the Online Store publication ID
  const pubQuery = `
    query {
      publications(first: 10) {
        edges {
          node {
            id
            name
          }
        }
      }
    }
  `

  const pubData = await adminFetch<{
    publications: {
      edges: { node: { id: string; name: string } }[]
    }
  }>(pubQuery)

  const onlineStore = pubData.publications.edges.find(
    (e) => e.node.name === 'Online Store'
  )

  if (onlineStore) {
    await adminFetch(mutation, {
      id: productId,
      input: [{ publicationId: onlineStore.node.id }],
    })
  }

  return true
}

// Fetch all products to get variant IDs
export async function getAdminProducts() {
  const query = `
    query {
      products(first: 50, query: "tag:customcaseguy") {
        edges {
          node {
            id
            title
            handle
            tags
            status
            variants(first: 100) {
              edges {
                node {
                  id
                  title
                  sku
                  price
                }
              }
            }
          }
        }
      }
    }
  `

  return adminFetch<{
    products: {
      edges: {
        node: {
          id: string
          title: string
          handle: string
          tags: string[]
          status: string
          variants: {
            edges: {
              node: { id: string; title: string; sku: string; price: string }
            }[]
          }
        }
      }[]
    }
  }>(query)
}
