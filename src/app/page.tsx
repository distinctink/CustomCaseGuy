import { HeroSection } from '@/components/home/HeroSection'
import { ThreePathCards } from '@/components/home/ThreePathCards'
import { TrustBar } from '@/components/home/TrustBar'
import { TrendingDesigns } from '@/components/home/TrendingDesigns'
import { ProductLines } from '@/components/home/ProductLines'
import { CollectionsGrid } from '@/components/home/CollectionsGrid'
import { SocialProof } from '@/components/home/SocialProof'
import { WhySection } from '@/components/home/WhySection'
import { CtaSection } from '@/components/home/CtaSection'

// Re-read trending images folder every 60 seconds
export const revalidate = 60

export default function HomePage() {
  return (
    <>
      <HeroSection />
      <ThreePathCards />
      <TrustBar />
      <TrendingDesigns />
      <ProductLines />
      <CollectionsGrid />
      <SocialProof />
      <WhySection />
      <CtaSection />
    </>
  )
}
