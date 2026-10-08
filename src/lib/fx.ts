/** Vibración corta (Android). En iOS/escritorio no hace nada. */
export function haptic(pattern: number | number[] = 12) {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* sin soporte */
  }
}

const CONFETTI_COLORS = ['#FF8E7A', '#FFD36E', '#7FD8A9', '#B5A6FF', '#8FCBFF', '#FFB8D2']

/** Lluvia de confeti pastel sobre un canvas temporal (sin dependencias). */
export function confetti(durationMs = 2200) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const canvas = document.createElement('canvas')
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100'
  document.body.appendChild(canvas)
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const W = (canvas.width = window.innerWidth * dpr)
  const H = (canvas.height = window.innerHeight * dpr)
  const ctx = canvas.getContext('2d')!

  const pieces = Array.from({ length: 140 }, () => ({
    x: W / 2 + (Math.random() - 0.5) * W * 0.3,
    y: H * 0.35,
    vx: (Math.random() - 0.5) * 22 * dpr,
    vy: (-Math.random() * 20 - 8) * dpr,
    size: (Math.random() * 7 + 5) * dpr,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    round: Math.random() > 0.5,
  }))

  const start = performance.now()
  const frame = (now: number) => {
    const t = now - start
    ctx.clearRect(0, 0, W, H)
    ctx.globalAlpha = Math.max(0, 1 - t / durationMs)
    for (const p of pieces) {
      p.vy += 0.6 * dpr
      p.vx *= 0.985
      p.x += p.vx
      p.y += p.vy
      p.rot += p.vr
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.round) {
        ctx.beginPath()
        ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
      }
      ctx.restore()
    }
    if (t < durationMs) requestAnimationFrame(frame)
    else canvas.remove()
  }
  requestAnimationFrame(frame)
}
