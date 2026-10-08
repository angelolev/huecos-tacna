import { useEffect, useRef, useState } from 'react'

/** Anima un número desde su valor anterior hasta `target`. */
export function useCountUp(target: number, duration = 700) {
  const [value, setValue] = useState(0)
  const from = useRef(0)

  useEffect(() => {
    const start = performance.now()
    const initial = from.current
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const v = Math.round(initial + (target - initial) * eased)
      setValue(v)
      from.current = v
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, duration])

  return value
}
