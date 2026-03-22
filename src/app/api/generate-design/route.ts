import { NextRequest, NextResponse } from 'next/server'
import { generateImage, buildDesignPrompt } from '@/lib/gemini'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// POST /api/generate-design
// Body: { name, slug, collection, collectionId, description, colors, style, colorway }
// Generates a design artwork file and saves to public/images/designs/[collection]/

export async function POST(request: NextRequest) {
  try {
    const { name, slug, collectionId, description, colors, style, colorway } = await request.json()

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    if (!name || !slug || !collectionId || !description || !colors || !style) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const prompt = buildDesignPrompt(name, description, colors, style)

    // Generate the image
    const buffers = await generateImage(prompt)

    if (buffers.length === 0) {
      return NextResponse.json({ error: 'No image generated' }, { status: 500 })
    }

    // Save to public/images/designs/[collectionId]/
    const dir = path.join(process.cwd(), 'public', 'images', 'designs', collectionId)
    await mkdir(dir, { recursive: true })

    const filename = `${slug}-${colorway || 'a'}.png`
    const filepath = path.join(dir, filename)
    await writeFile(filepath, buffers[0])

    return NextResponse.json({
      success: true,
      path: `/images/designs/${collectionId}/${filename}`,
      size: buffers[0].length,
    })
  } catch (error) {
    console.error('Design generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    )
  }
}
