import { useEffect, useRef } from 'react'

type Props = {
  type: 'win' | 'lose'
  title?: string
  subtitle?: string
}

export default function ResultOverlay({ type, title, subtitle }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let running = true
    const W = (canvas.width = window.innerWidth)
    const H = (canvas.height = window.innerHeight)
    const colors = type === 'win'
      ? ['#34d399', '#10b981', '#a7f3d0', '#6ee7b7']
      : ['#f87171', '#ef4444', '#fecaca', '#fca5a5']
    const parts = Array.from({ length: 120 }).map(() => ({
      x: Math.random() * W,
      y: -20 - Math.random() * 200,
      vx: (Math.random() - 0.5) * 2.2,
      vy: 2 + Math.random() * 3,
      r: 2 + Math.random() * 3,
      c: colors[(Math.random() * colors.length) | 0],
      a: 0.8 + Math.random() * 0.2,
    }))

    const draw = () => {
      if (!running) return
      ctx.clearRect(0, 0, W, H)
      for (const p of parts) {
        p.x += p.vx
        p.y += p.vy
        if (p.y > H + 10) {
          p.y = -20
          p.x = Math.random() * W
        }
        ctx.globalAlpha = p.a
        ctx.fillStyle = p.c
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => {
      running = false
      cancelAnimationFrame(raf)
    }
  }, [type])

  const isWin = type === 'win'
  const mainText = title || (isWin ? '勝利！' : '敗北…')
  const subText = subtitle || (isWin ? 'よくやった！' : '次は勝てる！')

  return (
    <div className="fixed inset-0 z-[60] pointer-events-none">
      <canvas ref={canvasRef} className="absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="pointer-events-auto px-8 py-6 rounded-2xl shadow-2xl bg-black/40 backdrop-blur-md border border-white/20">
          <div
            className={`text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text drop-shadow-xl ${
              isWin
                ? 'bg-gradient-to-r from-emerald-200 via-emerald-400 to-emerald-600'
                : 'bg-gradient-to-r from-rose-200 via-rose-400 to-rose-600'
            }`}
          >
            {mainText}
          </div>
          <div className="text-center mt-2 text-white/90 text-sm md:text-base">{subText}</div>
        </div>
      </div>
    </div>
  )
}

