// Shopify Storefront API Integration
// Uses the Storefront API from customcaseguy.com

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN || 'customcaseguy.com'
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN || ''

const STOREFRONT_API_URL = `https://${SHOPIFY_DOMAIN}/api/2026-01/graphql.json`

async function shopifyFetch<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const response = await fetch(STOREFRONT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })

  if (!response.ok) {
    throw new Error(`Shopify API error: ${response.statusText}`)
  }

  const json = await response.json()
  if (json.errors) {
    throw new Error(json.errors[0]?.message || 'Shopify GraphQL error')
  }

  return json.data
}

// Line item for checkout
export interface CheckoutLineItem {
  variantId: string
  quantity: number
  customAttributes?: { key: string; value: string }[]
}

// Create a checkout and add items (supports single or multiple line items)
export async function createCheckout(
  variantIdOrItems: string | CheckoutLineItem[],
  quantity: number = 1,
  customAttributes: { key: string; value: string }[] = []
) {
  const mutation = `
    mutation checkoutCreate($input: CheckoutCreateInput!) {
      checkoutCreate(input: $input) {
        checkout {
          id
          webUrl
        }
        checkoutUserErrors {
          code
          field
          message
        }
      }
    }
  `

  const lineItems = Array.isArray(variantIdOrItems)
    ? variantIdOrItems
    : [{ variantId: variantIdOrItems, quantity, customAttributes }]

  const variables = {
    input: {
      lineItems,
    },
  }

  const data = await shopifyFetch<{
    checkoutCreate: {
      checkout: { id: string; webUrl: string }
      checkoutUserErrors: { message: string }[]
    }
  }>(mutation, variables)

  if (data.checkoutCreate.checkoutUserErrors.length > 0) {
    throw new Error(data.checkoutCreate.checkoutUserErrors[0].message)
  }

  return data.checkoutCreate.checkout
}

// Fetch products tagged with 'customcaseguy'
export async function getProducts(first: number = 50) {
  const query = `
    query getProducts($first: Int!, $query: String) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
            tags
            variants(first: 50) {
              edges {
                node {
                  id
                  title
                  price {
                    amount
                    currencyCode
                  }
                  availableForSale
                }
              }
            }
          }
        }
      }
    }
  `

  return shopifyFetch<{
    products: {
      edges: {
        node: {
          id: string
          title: string
          handle: string
          tags: string[]
          variants: {
            edges: {
              node: {
                id: string
                title: string
                price: { amount: string; currencyCode: string }
                availableForSale: boolean
              }
            }[]
          }
        }
      }[]
    }
  }>(query, { first, query: 'tag:customcaseguy' })
}

// Add to cart helper that creates a checkout and redirects
export async function addToCartAndCheckout({
  designSlug,
  colorway,
  caseType,
  deviceId,
  variantId,
  customizationImageUrl,
  customizationData,
}: {
  designSlug: string
  colorway: string
  caseType: string
  deviceId: string
  variantId: string
  customizationImageUrl?: string
  customizationData?: string
}) {
  const customAttributes = [
    { key: '_design_slug', value: designSlug },
    { key: '_colorway', value: colorway },
    { key: '_case_type', value: caseType },
    { key: '_device', value: deviceId },
  ]

  if (customizationImageUrl) {
    customAttributes.push({ key: '_customization_image', value: customizationImageUrl })
  }
  if (customizationData) {
    customAttributes.push({ key: '_customization_data', value: customizationData })
  }

  const checkout = await createCheckout(variantId, 1, customAttributes)
  return checkout.webUrl
}
