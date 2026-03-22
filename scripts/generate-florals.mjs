// Generate Florals & Botanical designs using Gemini Imagen API
// Run: node scripts/generate-florals.mjs

import { GoogleGenAI } from '@google/genai'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

const API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCmvYLOl40LZ0_BkheCc_dkz8mLJQ2vGpQ'
const genai = new GoogleGenAI({ apiKey: API_KEY })

const OUTPUT_DIR = path.join(process.cwd(), 'public', 'images', 'designs', 'florals')

function buildPrompt(name, description, colors, style) {
  const colorList = colors.join(', ')
  return `Create a phone case design artwork: ${description}

Design name: "${name}"
Colors: ${colorList}
Style: ${style}

CRITICAL REQUIREMENTS:
- Dimensions: tall rectangle (phone case proportions, approximately 1:2 ratio)
- The design must go edge-to-edge with NO borders, NO margins, NO white space at edges
- NO text, NO words, NO letters, NO numbers anywhere in the design
- NO phone outline, NO case outline — just the flat artwork pattern
- High resolution, print-ready quality, 300 DPI equivalent detail
- sRGB color space
- The pattern/design should fill the ENTIRE canvas completely`
}

const FLORAL_DESIGNS = [
  {
    name: 'Rose Garden', slug: 'rose-garden', style: 'Lush painterly botanical illustration, rich and dramatic',
    colorways: [
      { cw: 'a', cwName: 'Midnight Rose', desc: 'Dense arrangement of large open roses, rose buds, and dark green leaves filling the entire canvas. Roses in deep crimson red, hot pink, and dusty rose shades. Dark green and emerald foliage with subtle gold accent leaves scattered throughout. Pure black background.', colors: ['#0A0A0A','#8B0000','#FF1F6E','#C48B9F','#1B4D3E','#2E8B57','#D4AF37'] },
      { cw: 'b', cwName: 'English Garden', desc: 'Dense arrangement of large open roses, rose buds, and sage green leaves filling the entire canvas. Roses in soft blush pink, cream white, and peach. Light sage green and olive foliage on a warm cream background.', colors: ['#FFF8F0','#FFB6C1','#FFFDD0','#FFDAB9','#9CAF88','#808000','#DEB887'] },
      { cw: 'c', cwName: 'Navy Bloom', desc: 'Dense arrangement of large open roses, rose buds, and teal leaves filling the entire canvas. Roses in coral, gold, and warm white. Deep navy blue background with teal and dark green foliage.', colors: ['#0A1628','#FF6F61','#D4AF37','#FAF0E6','#008080','#1B4D3E'] },
    ]
  },
  {
    name: 'Midnight Bloom', slug: 'midnight-bloom', style: 'Dark moody botanical, dramatic chiaroscuro lighting',
    colorways: [
      { cw: 'a', cwName: 'Velvet Night', desc: 'Dramatic dark floral with large peonies and dahlias emerging from deep shadows. Flowers in deep burgundy, violet purple, and dusty mauve. Very dark background with flowers appearing to glow from within.', colors: ['#0A0A0A','#800020','#7B2D8B','#C8A2C8','#2D2D2D','#1B4D3E'] },
      { cw: 'b', cwName: 'Twilight Garden', desc: 'Dramatic dark floral with large peonies and dahlias against a deep blue-black background. Flowers in soft pink, lavender, and silver-white. Moody twilight atmosphere.', colors: ['#0A0A1E','#FFB6C1','#E6E6FA','#C0C0C0','#2E2E4E','#1B3D3E'] },
      { cw: 'c', cwName: 'Ember Bloom', desc: 'Dramatic dark floral with large peonies and dahlias on pure black. Flowers in fiery orange, burnt amber, and deep red. Warm ember-like glow from the flower centers.', colors: ['#0A0A0A','#FF4500','#CC7722','#8B0000','#2D1810','#1B2D1E'] },
    ]
  },
  {
    name: 'Wildflower Meadow', slug: 'wildflower-meadow', style: 'Whimsical hand-painted watercolor, loose and flowing',
    colorways: [
      { cw: 'a', cwName: 'Morning Meadow', desc: 'Scattered wildflowers including daisies, lavender, poppies, and small blooms across the canvas. Watercolor style with soft edges. Pink, purple, yellow, and orange flowers on a soft white background with green stems.', colors: ['#FFFFFF','#FF69B4','#9370DB','#FFD700','#FF6347','#4CAF50','#98D8C8'] },
      { cw: 'b', cwName: 'Dried Meadow', desc: 'Scattered wildflowers including daisies, lavender, and dried grasses. Muted earthy watercolor palette. Dusty rose, terracotta, sage, and wheat tones on warm beige.', colors: ['#F5E6D3','#C08081','#CC5500','#9CAF88','#D2B48C','#8B7355'] },
      { cw: 'c', cwName: 'Night Meadow', desc: 'Scattered wildflowers including daisies, lavender, and small blooms on a dark navy/black background. Flowers appear to glow — white, pale pink, and soft blue against the darkness.', colors: ['#0A0A14','#FFFFFF','#FFB6C1','#87CEEB','#3CB371','#4A4A6A'] },
    ]
  },
  {
    name: 'Peony Burst', slug: 'peony-burst', style: 'Bold oversized floral, fashion illustration style',
    colorways: [
      { cw: 'a', cwName: 'Blushing Peony', desc: 'Three enormous peony blooms filling the entire canvas, overlapping each other. Soft blush pink, hot pink centers, and cream white outer petals. Minimal green leaves peeking through.', colors: ['#FFE4E1','#FF1F6E','#FFB6C1','#FFFDD0','#4CAF50'] },
      { cw: 'b', cwName: 'White Peony', desc: 'Three enormous peony blooms in pure white and ivory filling the canvas. Subtle grey shadows for depth. Clean elegant bridal bouquet aesthetic on a soft grey background.', colors: ['#E8E8E8','#FFFFFF','#FFFFF0','#C0C0C0','#A9A9A9','#5F7A5F'] },
      { cw: 'c', cwName: 'Coral Peony', desc: 'Three enormous peony blooms in vibrant coral, salmon, and peach filling the canvas. Warm tropical energy with deep green leaves. Bold and saturated on a dark background.', colors: ['#1A1A1A','#FF6F61','#FA8072','#FFDAB9','#2E8B57','#1B4D3E'] },
    ]
  },
  {
    name: 'Tropical Paradise', slug: 'tropical-paradise', style: 'Lush tropical botanical, vibrant and dense',
    colorways: [
      { cw: 'a', cwName: 'Jungle Dark', desc: 'Dense tropical foliage with monstera leaves, palm fronds, bird of paradise flowers, and plumeria. Deep emerald green leaves layered densely with bright orange and pink flowers. Dark black-green background.', colors: ['#0A1A0A','#2E8B57','#006400','#FF4500','#FF69B4','#FFD700'] },
      { cw: 'b', cwName: 'Palm Beach', desc: 'Dense tropical foliage with monstera leaves, palm fronds, and plumeria on a bright teal-turquoise background. Light green and yellow-green leaves. White and pink flowers. Summer vibes.', colors: ['#40E0D0','#90EE90','#9ACD32','#FFFFFF','#FF69B4','#FFD700'] },
    ]
  },
  {
    name: 'Cherry Blossom', slug: 'cherry-blossom', style: 'Japanese-inspired delicate illustration, elegant and airy',
    colorways: [
      { cw: 'a', cwName: 'Sakura Classic', desc: 'Delicate cherry blossom branches sweeping across the canvas with soft pink and white five-petal blooms. Some petals falling. Pale pink background fading to white. Japanese woodblock print elegance.', colors: ['#FFF0F5','#FFB7C5','#FFFFFF','#FF69B4','#8B4513','#FFE4E1'] },
      { cw: 'b', cwName: 'Night Sakura', desc: 'Delicate cherry blossom branches against a deep navy-black night sky. Pale pink and white blossoms glowing against the darkness. Petals drifting downward. Luminous and ethereal.', colors: ['#0A0A1E','#FFB7C5','#FFFFFF','#FF69B4','#4A3728','#1A1A3E'] },
      { cw: 'c', cwName: 'Golden Sakura', desc: 'Delicate cherry blossom branches with gold-tinted blossoms and branches on a rich burgundy red background. Luxurious east-meets-west aesthetic. Gold leaf effect on petals.', colors: ['#800020','#D4AF37','#FFD700','#FFF8DC','#8B6914','#5C0A0A'] },
    ]
  },
  {
    name: 'Sunflower Field', slug: 'sunflower-field', style: 'Cheerful bold botanical, Van Gogh inspired brushwork',
    colorways: [
      { cw: 'a', cwName: 'Sunny Side', desc: 'Large sunflower heads filling the canvas, overlapping and facing different directions. Bright golden yellow petals, warm brown centers, and olive green leaves. Warm sunny amber background. Bold brushstroke texture.', colors: ['#F4A460','#FFD700','#FFA500','#8B6914','#556B2F','#8B4513'] },
    ]
  },
  {
    name: 'Dahlia Explosion', slug: 'dahlia-explosion', style: 'Hyper-detailed botanical, jewel-like vibrancy',
    colorways: [
      { cw: 'a', cwName: 'Hot Dahlia', desc: 'Close-up of large dahlia flowers with perfectly spiraling petals. Vibrant hot pink, magenta, and fuchsia dahlias with deep purple centers. Dark moody background with the flowers appearing luminous.', colors: ['#1A0A1A','#FF1F6E','#FF00FF','#C71585','#4B0082','#2E8B57'] },
    ]
  },
  {
    name: 'Eucalyptus Cascade', slug: 'eucalyptus-cascade', style: 'Minimalist botanical, airy watercolor',
    colorways: [
      { cw: 'a', cwName: 'Silver Leaf', desc: 'Cascading eucalyptus branches and round silver-green leaves flowing downward across the canvas. Soft watercolor style with muted sage green, silver, and dusty blue tones. Clean white background. Minimalist and calming.', colors: ['#FFFFFF','#9CAF88','#C0C0C0','#B0C4DE','#808080','#D3D3D3'] },
    ]
  },
  {
    name: 'Magnolia Branch', slug: 'magnolia-branch', style: 'Southern elegance, soft realistic botanical painting',
    colorways: [
      { cw: 'a', cwName: 'Southern Belle', desc: 'Large magnolia flowers on thick branches with glossy dark green leaves. Creamy white magnolia blooms with subtle pink blush at the base of petals. Warm cream background. Classic Southern botanical illustration.', colors: ['#FFF8DC','#FFFAF0','#FFB6C1','#2E4E2E','#8B7355','#F5DEB3'] },
    ]
  },
  {
    name: 'Lavender Fields', slug: 'lavender-fields', style: 'Impressionist watercolor, soft and dreamy',
    colorways: [
      { cw: 'a', cwName: 'Provence', desc: 'Rows of lavender stalks with purple flower clusters rising upward across the canvas. Soft impressionist style with violet, purple, and lilac blooms on slender green stems. Pale sky-blue to white gradient background.', colors: ['#F0F0FF','#9370DB','#8A2BE2','#E6E6FA','#6B8E23','#ADD8E6'] },
    ]
  },
  {
    name: 'Botanical Study', slug: 'botanical-study', style: 'Scientific botanical illustration, detailed line art with color',
    colorways: [
      { cw: 'a', cwName: 'Greenhouse', desc: 'Collection of various botanical specimens arranged across the canvas like a naturalist study plate. Ferns, monstera leaves, succulents, and small flowering plants. Precise detail with fine ink outlines, colored with soft greens and earth tones. Cream paper-like background.', colors: ['#FFF8DC','#2E8B57','#6B8E23','#556B2F','#8B7355','#DAA520','#333333'] },
    ]
  },
  {
    name: 'Pressed Flowers', slug: 'pressed-flowers', style: 'Delicate pressed flower collage, vintage herbarium aesthetic',
    colorways: [
      { cw: 'a', cwName: 'Heirloom Press', desc: 'Arrangement of flattened pressed flowers and leaves as if preserved in a Victorian herbarium book. Daisies, forget-me-nots, ferns, and small wildflowers scattered naturally. Slightly faded, dried flower colors on aged cream/parchment background.', colors: ['#F5E6C8','#DEB887','#BC8F8F','#6B8E23','#87CEEB','#D2B48C','#8B7355'] },
    ]
  },
  {
    name: 'Hibiscus Dream', slug: 'hibiscus-dream', style: 'Bold tropical, screen-print inspired flat color',
    colorways: [
      { cw: 'a', cwName: 'Island Sunset', desc: 'Large hibiscus flowers in bold flat color style across the canvas. Bright red and coral hibiscus with yellow stamens. Large tropical green leaves. Vibrant and graphic on a deep teal background.', colors: ['#006D6F','#FF0000','#FF6F61','#FFD700','#2E8B57','#004D4D'] },
    ]
  },
  {
    name: 'Lily Pond', slug: 'lily-pond', style: 'Impressionist painting, Monet-inspired soft focus',
    colorways: [
      { cw: 'a', cwName: 'Water Garden', desc: 'Water lilies floating on a dark reflective pond surface. White and pink lily flowers with large round green lily pads. Soft impressionist brushwork with subtle reflections in the dark water. Moody and serene.', colors: ['#1A2A2A','#FFFFFF','#FFB6C1','#3CB371','#2E4E2E','#4682B4'] },
    ]
  },
  {
    name: 'Orchid Elegance', slug: 'orchid-elegance', style: 'Refined luxury botanical, high-fashion aesthetic',
    colorways: [
      { cw: 'a', cwName: 'Platinum Orchid', desc: 'Elegant orchid stems with multiple blooms arranged vertically on the canvas. White phalaenopsis orchids with subtle purple veining at the center. Sleek dark charcoal background. Luxury fashion editorial style.', colors: ['#1A1A1A','#FFFFFF','#E8E8E8','#9370DB','#4B0082','#2D2D2D'] },
    ]
  },
  {
    name: 'Vintage Rose', slug: 'vintage-rose', style: 'Vintage Victorian wallpaper pattern, aged and romantic',
    colorways: [
      { cw: 'a', cwName: 'Antique', desc: 'Repeating vintage rose pattern like Victorian wallpaper or chintz fabric. Medium-sized roses with buds and ribbons arranged in a classic repeating layout. Muted dusty pink, sage green, and antique gold on an aged cream background.', colors: ['#F5E6D3','#C48B9F','#BC8F8F','#9CAF88','#D4AF37','#8B7355'] },
    ]
  },
  {
    name: 'Protea Bold', slug: 'protea-bold', style: 'Modern graphic botanical, bold and contemporary',
    colorways: [
      { cw: 'a', cwName: 'King Protea', desc: 'Large king protea flower heads as the focal point with banksia and leucadendron supporting flowers. Bold pinks, reds, and warm oranges with silvery-green foliage. Modern graphic style with strong contrast on a deep navy background.', colors: ['#0A1628','#FF1F6E','#FF4500','#FF8C00','#C0C0C0','#6B8E23'] },
    ]
  },
  {
    name: 'Garden Party', slug: 'garden-party', style: 'Cheerful maximalist, Liberty London fabric inspired',
    colorways: [
      { cw: 'a', cwName: 'Spring Fling', desc: 'Dense allover pattern of small mixed flowers — tiny roses, daisies, cornflowers, and sweet peas packed together covering every inch. Cheerful and dense like Liberty fabric. Multiple bright colors: pink, blue, yellow, red, purple on a light background.', colors: ['#FFF8F0','#FF69B4','#6495ED','#FFD700','#FF6347','#9370DB','#4CAF50'] },
    ]
  },
  {
    name: 'Poppy Field', slug: 'poppy-field', style: 'Bold graphic illustration, high contrast',
    colorways: [
      { cw: 'a', cwName: 'Red Poppy', desc: 'Bold red poppies with black centers scattered across the canvas with thin green stems and small leaves. High contrast graphic style — bright vermillion red petals against a crisp white background. Clean and modern.', colors: ['#FFFFFF','#FF0000','#CC0000','#000000','#4CAF50','#6B8E23'] },
    ]
  },
]

async function generateDesign(design, colorway) {
  const filename = `${design.slug}-${colorway.cw}.png`
  const filepath = path.join(OUTPUT_DIR, filename)
  const prompt = buildPrompt(design.name, colorway.desc, colorway.colors, design.style)

  console.log(`  Generating: ${design.name} - ${colorway.cwName} (${filename})...`)

  try {
    const response = await genai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt,
      config: { numberOfImages: 1 },
    })

    if (response.generatedImages?.[0]?.image?.imageBytes) {
      const buffer = Buffer.from(response.generatedImages[0].image.imageBytes, 'base64')
      await writeFile(filepath, buffer)
      console.log(`  ✓ Saved ${filename} (${(buffer.length / 1024).toFixed(0)} KB)`)
      return true
    } else {
      console.log(`  ✗ No image data returned for ${filename}`)
      return false
    }
  } catch (err) {
    console.log(`  ✗ Error: ${err.message}`)
    return false
  }
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })

  let total = 0
  let success = 0
  let failed = 0

  for (const design of FLORAL_DESIGNS) {
    total += design.colorways.length
  }

  console.log(`\n🌸 Generating ${total} Floral & Botanical designs...\n`)

  let current = 0
  for (const design of FLORAL_DESIGNS) {
    console.log(`\n[${design.name}] (${design.colorways.length} colorway${design.colorways.length > 1 ? 's' : ''})`)
    for (const cw of design.colorways) {
      current++
      process.stdout.write(`  [${current}/${total}] `)
      const ok = await generateDesign(design, cw)
      if (ok) success++
      else failed++

      // Rate limit pause
      if (current < total) {
        await new Promise(r => setTimeout(r, 2000))
      }
    }
  }

  console.log(`\n✅ Done! ${success} succeeded, ${failed} failed out of ${total} total.\n`)
}

main().catch(console.error)
