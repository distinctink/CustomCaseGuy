// Google Gemini API Integration for image generation
// Used for site graphics, collection thumbnails, and design artwork

import { GoogleGenAI, type GenerateImagesConfig } from '@google/genai'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || ''

const genai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })

// ============================================
// Core image generation function
// ============================================

export async function generateImage(
  prompt: string,
  options: {
    width?: number
    height?: number
    numberOfImages?: number
  } = {}
): Promise<Buffer[]> {
  const { numberOfImages = 1 } = options

  const config: GenerateImagesConfig = {
    numberOfImages,
  }

  const response = await genai.models.generateImages({
    model: 'imagen-3.0-generate-002',
    prompt,
    config,
  })

  const buffers: Buffer[] = []
  if (response.generatedImages) {
    for (const img of response.generatedImages) {
      if (img.image?.imageBytes) {
        buffers.push(Buffer.from(img.image.imageBytes, 'base64'))
      }
    }
  }

  return buffers
}

// ============================================
// Gemini text+image model for more control
// ============================================

export async function generateImageWithGemini(
  prompt: string
): Promise<Buffer | null> {
  const response = await genai.models.generateContent({
    model: 'gemini-2.0-flash-exp',
    contents: prompt,
    config: {
      responseModalities: ['image', 'text'],
    },
  })

  if (response.candidates?.[0]?.content?.parts) {
    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData?.data) {
        return Buffer.from(part.inlineData.data, 'base64')
      }
    }
  }

  return null
}

// ============================================
// Site Graphics Prompts
// ============================================

export const SITE_GRAPHIC_PROMPTS = {
  'hero-3cases': {
    prompt: `Product photography of three custom phone cases arranged on a dark matte black surface. The cases show vibrant floral, geometric, and marble patterns printed on them. Dramatic pink and magenta accent lighting creating subtle glows behind each case. Dark luxury aesthetic, black background. Professional product shot, 8K quality, photorealistic.`,
    width: 1920,
    height: 1080,
    filename: 'hero-3cases.jpg',
  },
  'hero-floating': {
    prompt: `Single custom phone case floating against a pure black background with a soft pink/magenta glow halo behind it. The case shows a beautiful floral rose pattern printed on it. Dramatic lighting, luxury product photography, minimalist composition. 8K quality, photorealistic.`,
    width: 1080,
    height: 1920,
    filename: 'hero-floating.jpg',
  },
  'og-card': {
    prompt: `Three custom phone cases fanned out overlapping on a dark black surface, each showing different colorful designs (floral, marble, geometric). Subtle pink accent lighting. Clean product photography layout suitable for social media sharing. Professional, luxury aesthetic. 8K quality.`,
    width: 1200,
    height: 630,
    filename: 'og-card.jpg',
  },
  'sale-banner': {
    prompt: `Abstract dramatic pink and magenta light slash cutting diagonally across a pure black background. High contrast, bold, energetic. Suitable as a wide banner background for a sale promotion. Minimal, no text, no products.`,
    width: 1500,
    height: 500,
    filename: 'banner-sale.jpg',
  },
  'cta-mini-cases': {
    prompt: `Five small phone cases floating in a row against a black background, each slightly angled differently with colorful custom designs (florals, marble, camo, geometric, abstract). Subtle pink glow underneath. Clean product photography, wide format panoramic. 8K quality.`,
    width: 1920,
    height: 500,
    filename: 'cta-mini-cases.jpg',
  },
  'about-workshop': {
    prompt: `Interior of a professional printing workshop studio. A commercial UV flatbed printer is printing a colorful design onto a phone case. Clean modern workspace, well-lit with warm industrial lighting. Organized workbenches with phone cases and equipment. Professional manufacturing environment, 8K quality, photorealistic.`,
    width: 1920,
    height: 1080,
    filename: 'about-workshop.jpg',
  },
} as const

// ============================================
// Collection Thumbnail Prompts
// ============================================

export const COLLECTION_THUMBNAIL_PROMPTS: Record<string, { prompt: string; filename: string }> = {
  florals: {
    prompt: `Seamless pattern design of lush roses, peonies, and botanical leaves on a dark black background. Rich pinks, deep reds, soft blush, and green foliage. Dense floral arrangement, painterly style. Suitable as a phone case design pattern. Square format, edge-to-edge pattern, no borders.`,
    filename: 'collection-thumb-florals.jpg',
  },
  marble: {
    prompt: `Luxurious dark marble texture with dramatic gold veining running through it. Deep black and charcoal marble base with bright metallic gold streaks. High-end stone texture, photorealistic. Square format, edge-to-edge, seamless pattern.`,
    filename: 'collection-thumb-marble.jpg',
  },
  monogram: {
    prompt: `Elegant monogram frame design on a navy blue background. Ornate gold decorative border with laurel wreaths and flourishes surrounding a blank center space for initials. Classic luxury branding style. Square format, centered composition.`,
    filename: 'collection-thumb-monogram.jpg',
  },
  abstract: {
    prompt: `Bold abstract modern art with vibrant watercolor splashes and paint strokes. Hot pink, purple, blue, and gold colors blending and splattering on a white background. Energetic, contemporary art style. Square format, edge-to-edge.`,
    filename: 'collection-thumb-abstract.jpg',
  },
  geometric: {
    prompt: `Clean geometric pattern with hexagonal grid in gold lines on a dark navy background. Art deco inspired, modern and minimalist. Precise lines, metallic gold on deep blue-black. Square format, seamless repeating pattern.`,
    filename: 'collection-thumb-geometric.jpg',
  },
  nature: {
    prompt: `Artistic mountain landscape silhouette at sunset. Layers of mountain ranges in gradients of deep purple, blue, and orange. Starry night sky above. Stylized, not photographic. Flat illustration style. Square format.`,
    filename: 'collection-thumb-nature.jpg',
  },
  animals: {
    prompt: `Beautiful butterfly with intricate wing patterns in vibrant colors (blue, purple, orange) on a dark black background. Detailed botanical illustration style, scientific accuracy with artistic flair. Square format, centered.`,
    filename: 'collection-thumb-animals.jpg',
  },
  camo: {
    prompt: `Traditional woodland camouflage pattern in dark greens, browns, and black. Military-style camo texture, seamless repeating pattern. Rugged, masculine aesthetic. Square format, edge-to-edge pattern.`,
    filename: 'collection-thumb-camo.jpg',
  },
  celestial: {
    prompt: `Cosmic galaxy nebula in deep purples, blues, and hot pinks with scattered stars and constellation lines. Space astronomy aesthetic, dreamy and ethereal. Rich jewel tones against black space. Square format, edge-to-edge.`,
    filename: 'collection-thumb-celestial.jpg',
  },
  sports: {
    prompt: `Close-up texture of baseball stitching - white leather with red raised stitches. Photorealistic sports texture, dramatic lighting. Classic American sports aesthetic. Square format, filling the entire frame.`,
    filename: 'collection-thumb-sports.jpg',
  },
  patriotic: {
    prompt: `Weathered vintage American flag with distressed texture on dark background. Rustic, aged look with muted reds, whites, and blues. Patriotic but understated and artistic. Square format, flag filling the frame.`,
    filename: 'collection-thumb-patriotic.jpg',
  },
  holiday: {
    prompt: `Festive Christmas pattern with red and green plaid/tartan, small holly leaves, and gold snowflakes on a dark background. Classic holiday aesthetic, cozy and cheerful. Square format, seamless pattern.`,
    filename: 'collection-thumb-holiday.jpg',
  },
  occupation: {
    prompt: `Minimalist illustration of a nurse's stethoscope forming a heart shape, in pink and white on a dark charcoal background. Clean, modern healthcare-themed design. Simple and elegant. Square format, centered.`,
    filename: 'collection-thumb-occupation.jpg',
  },
  minimalist: {
    prompt: `Ultra-minimalist design: a single thin white line border with rounded corners on a matte black background. The word "breathe" in small, elegant sans-serif lowercase text centered. Zen, calm, understated. Square format.`,
    filename: 'collection-thumb-minimalist.jpg',
  },
  tiedye: {
    prompt: `Classic spiral tie-dye pattern in vibrant rainbow colors (pink, purple, blue, green, yellow, orange) swirling from the center. Bold, psychedelic, retro 1970s aesthetic. Bright and saturated. Square format, edge-to-edge.`,
    filename: 'collection-thumb-tiedye.jpg',
  },
}

// ============================================
// Design Artwork Base Prompt Builder
// ============================================

export function buildDesignPrompt(
  designName: string,
  description: string,
  colors: string[],
  style: string,
): string {
  const colorList = colors.join(', ')
  return `Create a phone case design artwork: ${description}

Design name: "${designName}"
Colors: ${colorList}
Style: ${style}

CRITICAL REQUIREMENTS:
- Dimensions: tall rectangle (phone case proportions, approximately 1:2 ratio)
- The design must go edge-to-edge with NO borders, NO margins, NO white space at edges
- NO text, NO words, NO letters, NO numbers anywhere in the design
- NO phone outline, NO case outline — just the flat artwork pattern
- High resolution, print-ready quality, 300 DPI equivalent detail
- sRGB color space
- PNG format with no transparency (full coverage)
- The pattern/design should fill the ENTIRE canvas completely`
}

export type SiteGraphicKey = keyof typeof SITE_GRAPHIC_PROMPTS
