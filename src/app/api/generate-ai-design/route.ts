import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'

// POST /api/generate-ai-design
// Customer-facing endpoint for AI phone case artwork generation
// Body: { prompt: string }
// Returns: { image: string (base64 data URL) }

const STYLE_PRESETS: Record<string, string> = {
  'vibrant-floral': 'Lush vibrant floral pattern with roses, peonies, and botanical leaves. Rich pinks, reds, and greens.',
  'dark-marble': 'Luxurious dark marble texture with dramatic gold or white veining. High-end stone aesthetic.',
  'galaxy': 'Cosmic galaxy nebula with deep purples, blues, and hot pinks. Scattered stars and stardust.',
  'watercolor': 'Soft watercolor splashes and washes blending together. Artistic, painterly, dreamy.',
  'geometric': 'Bold geometric pattern with clean lines, hexagons, and triangles. Modern art deco style.',
  'tropical': 'Lush tropical leaves, monstera, palm fronds, and exotic flowers. Vibrant greens and pinks.',
  'abstract': 'Bold abstract modern art with energetic brushstrokes and color splashes.',
  'vintage': 'Vintage retro aesthetic with muted tones, distressed textures, and nostalgic elements.',
  'tie-dye': 'Classic spiral tie-dye pattern in vibrant rainbow colors. Psychedelic retro 1970s vibe.',
  'animal-print': 'Stylish animal print pattern (leopard, zebra, or snakeskin). Fashion-forward design.',
  'landscape': 'Beautiful scenic landscape with mountains, forests, or ocean. Artistic stylized illustration.',
  'gradient': 'Smooth gradient blend of colors creating a modern ombre effect.',
}

export async function POST(request: NextRequest) {
  try {
    const { prompt, preset } = await request.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'AI generation not configured' }, { status: 500 })
    }

    const userPrompt = preset && STYLE_PRESETS[preset]
      ? `${STYLE_PRESETS[preset]}${prompt ? ` ${prompt}` : ''}`
      : prompt

    if (!userPrompt || typeof userPrompt !== 'string' || userPrompt.trim().length < 3) {
      return NextResponse.json({ error: 'Please describe the design you want' }, { status: 400 })
    }

    if (userPrompt.length > 500) {
      return NextResponse.json({ error: 'Description too long (max 500 characters)' }, { status: 400 })
    }

    const fullPrompt = `Create a phone case design artwork based on this description: ${userPrompt.trim()}

CRITICAL REQUIREMENTS:
- Dimensions: tall rectangle (phone case proportions, approximately 1:2 ratio)
- The design must go edge-to-edge with NO borders, NO margins, NO white space at edges
- NO text, NO words, NO letters, NO numbers anywhere in the design
- NO phone outline, NO case outline — just the flat artwork/pattern
- High resolution, vibrant colors, print-ready quality
- The pattern/design should fill the ENTIRE canvas completely
- Make it visually stunning and suitable for a premium phone case`

    const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })

    const response = await genai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: fullPrompt,
      config: {
        responseModalities: ['image', 'text'],
      },
    })

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData?.data) {
          const mimeType = part.inlineData.mimeType || 'image/png'
          const dataUrl = `data:${mimeType};base64,${part.inlineData.data}`
          return NextResponse.json({ image: dataUrl })
        }
      }
    }

    return NextResponse.json({ error: 'No image was generated. Try a different description.' }, { status: 500 })
  } catch (error) {
    console.error('AI design generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed. Please try again.' },
      { status: 500 }
    )
  }
}
