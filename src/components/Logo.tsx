import { Link } from 'react-router-dom'

/** Pin redondeado con un huequito: identidad de la app. */
export function PinMark({ size = 34, className = '' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 1.18} viewBox="0 0 48 57" aria-hidden className={className}>
      <path
        d="M24 55c-1.2 0-2.3-.6-3-1.6C14.5 44.4 4 33.6 4 22.5 4 11.2 13 3 24 3s20 8.2 20 19.5c0 11.1-10.5 21.9-17 30.9-.7 1-1.8 1.6-3 1.6z"
        fill="#FF8E7A"
      />
      <circle cx="24" cy="22" r="12.5" fill="#FFFDF9" />
      <ellipse cx="24" cy="24.5" rx="7.5" ry="4" fill="#2F2B3A" />
      <ellipse cx="22" cy="23.4" rx="2.6" ry="1" fill="#5B5668" />
    </svg>
  )
}

export function Logo({ to = '/' }: { to?: string }) {
  return (
    <Link to={to} className="flex select-none items-center gap-2">
      <PinMark size={26} />
      <span className="font-display text-[21px] font-semibold leading-none text-ink">
        Huecos <span className="text-coral-deep">Tacna</span>
      </span>
    </Link>
  )
}
