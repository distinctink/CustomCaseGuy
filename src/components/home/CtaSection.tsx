import fs from 'fs'
import path from 'path'
import { CtaSectionClient } from './CtaSectionClient'

function getTrendingImages(): string[] {
  const dir = path.join(process.cwd(), 'public', 'images', 'trending')
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f))
  } catch {
    return []
  }
}

export function CtaSection() {
  const images = getTrendingImages()
  return <CtaSectionClient images={images} />
}
