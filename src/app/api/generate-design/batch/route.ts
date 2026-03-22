import { NextRequest, NextResponse } from 'next/server'
import { generateImage, buildDesignPrompt } from '@/lib/gemini'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

type DesignRequest = {
  name: string
  slug: string
  collectionId: string
  description: string
  colors: string[]
  style: string
  colorway: string
}

// POST /api/generate-design/batch
// Body: { designs: DesignRequest[] }
// Generates multiple design artworks sequentially (respects API rate limits)

export async function POST(request: NextRequest) {
  try {
    const { designs } = (await request.json()) as { designs: DesignRequest[] }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
    }

    if (!designs || !Array.isArray(designs) || designs.length === 0) {
      return NextResponse.json({ error: 'No designs provided' }, { status: 400 })
    }

    // Cap at 10 per batch to avoid timeouts
    const batch = designs.slice(0, 10)
    const results: { slug: string; colorway: string; path?: string; error?: string }[] = []

    for (const design of batch) {
      try {
        const prompt = buildDesignPrompt(design.name, design.description, design.colors, design.style)
        const buffers = await generateImage(prompt)

        if (buffers.length === 0) {
          results.push({ slug: design.slug, colorway: design.colorway, error: 'No image generated' })
          continue
        }

        const dir = path.join(process.cwd(), 'public', 'images', 'designs', design.collectionId)
        await mkdir(dir, { recursive: true })

        const filename = `${design.slug}-${design.colorway}.png`
        const filepath = path.join(dir, filename)
        await writeFile(filepath, buffers[0])

        results.push({
          slug: design.slug,
          colorway: design.colorway,
          path: `/images/designs/${design.collectionId}/${filename}`,
        })

        // Small delay between generations to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (err) {
        results.push({
          slug: design.slug,
          colorway: design.colorway,
          error: err instanceof Error ? err.message : 'Failed',
        })
      }
    }

    const succeeded = results.filter((r) => r.path).length
    const failed = results.filter((r) => r.error).length

    return NextResponse.json({
      success: true,
      total: batch.length,
      succeeded,
      failed,
      results,
      remaining: designs.length - batch.length,
    })
  } catch (error) {
    console.error('Batch generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Batch generation failed' },
      { status: 500 }
    )
  }
}
