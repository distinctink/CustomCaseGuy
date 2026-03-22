import { SectionHeading } from '@/components/ui/SectionHeading'

const FEATURES = [
  {
    title: 'UV Printed In-House',
    description: 'Every case is UV printed at our Orlando studio with vibrant, scratch-resistant ink that lasts.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>,
  },
  {
    title: 'Genuine OtterBox',
    description: 'We print on real OtterBox cases — Symmetry, Commuter, and Defender. The same protection you trust.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/></svg>,
  },
  {
    title: 'WYSIWYG Editor',
    description: 'Design your own case with our live editor. Add text, upload images, choose colors — see it in real time.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 19 7-7 3 3-7 7-3-3z"/><path d="m18 13-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="m2 2 7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>,
  },
  {
    title: 'Ships Fast',
    description: '24-48 hour turnaround on every order. Free shipping on all U.S. orders. No waiting around.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  },
  {
    title: 'Any Design x Any Case',
    description: 'Every design works on every case type. Mix and match to get exactly the combo you want.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/></svg>,
  },
  {
    title: 'Made in USA',
    description: 'Designed and produced in Orlando, Florida. Not dropshipped from overseas. Quality you can see.',
    icon: <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" x2="4" y1="22" y2="15"/></svg>,
  },
]

export function WhySection() {
  return (
    <section className="py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          title="Why CustomCaseGuy?"
          subtitle="Here's what makes us different"
        />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="p-6 rounded-2xl bg-charcoal border border-mid-gray/10 hover:border-mid-gray/20 transition-colors"
            >
              <div className="w-12 h-12 rounded-xl bg-hot-pink/10 flex items-center justify-center text-hot-pink mb-4">
                {feature.icon}
              </div>
              <h3 className="font-display font-700 text-lg text-white mb-2">
                {feature.title}
              </h3>
              <p className="text-light-gray text-sm font-body leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
