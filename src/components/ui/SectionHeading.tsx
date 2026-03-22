export function SectionHeading({
  title,
  subtitle,
  align = 'center',
}: {
  title: string
  subtitle?: string
  align?: 'left' | 'center'
}) {
  return (
    <div className={`mb-12 ${align === 'center' ? 'text-center' : ''}`}>
      <h2 className="font-display font-800 text-3xl sm:text-4xl lg:text-5xl text-white">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-4 text-light-gray text-lg max-w-2xl mx-auto">
          {subtitle}
        </p>
      )}
    </div>
  )
}
