import { useState } from 'react'
import { Check, Share2 } from 'lucide-react'
import { haptic } from '../lib/fx'
import { shareReport } from '../lib/share'
import type { Report } from '../lib/types'

export function ShareButton({
  report,
  label = 'Compartir',
  className = 'btn-soft',
}: {
  report: Pick<Report, 'id' | 'address' | 'severity'>
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onClick={async () => {
        haptic(8)
        try {
          if ((await shareReport(report)) === 'copied') {
            setCopied(true)
            setTimeout(() => setCopied(false), 2200)
          }
        } catch (e) {
          console.error(e)
        }
      }}
    >
      {copied ? <Check className="h-4 w-4 text-mint-deep" /> : <Share2 className="h-4 w-4" />}
      {copied ? '¡Enlace copiado!' : label}
    </button>
  )
}
