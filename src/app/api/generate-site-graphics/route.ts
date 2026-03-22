import { NextRequest, NextResponse } from 'next/server'
import { generateImage, SITE_GRAPHIC_PROMPTS, COLLECTION_THUMBNAIL_PROMPTS, type SiteGraphicKey } from '@/lib/gemini'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// POST /api/generate-site-graphics
// Body: { type: "site" | "collection", key: string }
// Generates a single site graphic or collection thumbnail and saves to public/images/

export async function POST(request: NextRequest) {
  try {
    const { type, key } = await request.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    let prompt: string
    let filename: string

    if (type === 'site' && key in SITE_GRAPHIC_PROMPTS) {
      const config = SITE_GRAPHIC_PROMPTS[key as SiteGraphicKey]
      prompt = config.prompt
      filename = config.filename
    } else if (type === 'collection' && key in COLLECTION_THUMBNAIL_PROMPTS) {
      const config = COLLECTION_THUMBNAIL_PROMPTS[key]
      prompt = config.prompt
      filename = config.filename
    } else {
      return NextResponse.json({ error: 'Invalid type or key' }, { status: 400 })
    }

    // Generate the image
    const buffers = await generateImage(prompt)

    if (buffers.length === 0) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 })
    }

    // Save to public/images/site/ or public/images/collections/
    const subdir = type === 'site' ? 'site' : 'collections'
    const dir = path.join(process.cwd(), 'public', 'images', subdir)
    await mkdir(dir, { recursive: true })

    const filepath = path.join(dir, filename)
    await writeFile(filepath, buffers[0])

    return NextResponse.json({
      success: true,
      path: `/images/${subdir}/${filename}`,
      size: buffers[0].length,
    })
  } catch (error) {
    console.error('Image generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
