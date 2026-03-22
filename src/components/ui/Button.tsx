import Link from 'next/link'

type ButtonProps = {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  href?: string
  className?: string
  fullWidth?: boolean
} & React.ButtonHTMLAttributes<HTMLButtonElement>

const baseStyles =
  'inline-flex items-center justify-center font-display font-600 rounded-xl transition-all duration-200 cursor-pointer'

const variants = {
  primary:
    'bg-hot-pink text-white hover:bg-hot-pink/90 hover:shadow-lg hover:shadow-hot-pink/25 active:scale-[0.98]',
  secondary:
    'bg-dark-gray text-white hover:bg-mid-gray/50 active:scale-[0.98]',
  outline:
    'border-2 border-hot-pink text-hot-pink hover:bg-hot-pink/10 active:scale-[0.98]',
  ghost:
    'text-light-gray hover:text-white hover:bg-white/5 active:scale-[0.98]',
}

const sizes = {
  sm: 'text-sm px-4 py-2 gap-2',
  md: 'text-sm px-6 py-3 gap-2',
  lg: 'text-base px-8 py-4 gap-3',
}

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  href,
  className = '',
  fullWidth,
  ...props
}: ButtonProps) {
  const classes = `${baseStyles} ${variants[variant]} ${sizes[size]} ${fullWidth ? 'w-full' : ''} ${className}`

  if (href) {
    return (
      <Link href={href} className={classes}>
        {children}
      </Link>
    )
  }

  return (
    <button className={classes} {...props}>
      {children}
    </button>
  )
}
