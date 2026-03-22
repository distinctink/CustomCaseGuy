export function Logo({ size = 'default' }: { size?: 'default' | 'large' }) {
  const iconSize = size === 'large' ? 'w-10 h-10' : 'w-8 h-8'
  const textSize = size === 'large' ? 'text-2xl' : 'text-lg'

  return (
    <div className="flex items-center gap-2">
      {/* Squircle icon with gradient */}
      <div
        className={`${iconSize} rounded-xl bg-gradient-to-br from-hot-pink to-soft-pink flex items-center justify-center`}
      >
        <span className="font-display font-800 text-white" style={{ fontSize: size === 'large' ? '1.5rem' : '1.1rem' }}>
          C
        </span>
      </div>
      {/* Wordmark */}
      <span className={`font-display font-700 ${textSize} tracking-normal`}>
        Custom<span className="text-white">Case</span>
        <span className="text-hot-pink">Guy</span>
      </span>
    </div>
  )
}
