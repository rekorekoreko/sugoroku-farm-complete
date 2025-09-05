import { useEffect, useRef, useState } from 'react'
import ResultOverlay from '@/components/ResultOverlay'

type Winner = 'player' | 'bot'

interface Props {
  onFinish: (winner: Winner) => void
  width?: number
  height?: number
}

// Space-Invaders style minigame
export default function InvaderDuel({ onFinish, width = 420, height = 320 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [phase, setPhase] = useState<'countdown' | 'playing'>('countdown')
  const phaseRef = useRef<'countdown' | 'playing'>('countdown')
  const overlayTextRef = useRef<string>('3')
  const [result, setResult] = useState<Winner | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!

    let running = true
    const keys: Record<string, boolean> = {}

    const player = { x: width / 2, y: height - 24, w: 18, h: 8, speed: 3, lives: 1 }

    // Enemy blocks (BOT side): exactly 5 blocks
    const cols = 5
    const rows = 1
    const enemies: { x: number; y: number; w: number; h: number; alive: boolean; hp: number }[] = []
    const gapX = 36
    const gapY = 22
    const startX = (width - (cols - 1) * gapX) / 2
    const startY = 40
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        enemies.push({ x: startX + c * gapX, y: startY + r * gapY, w: 18, h: 12, alive: true, hp: 2 })
      }
    }

    // Enemy movement
    let dir = 1 // 1:right, -1:left
    let enemySpeed = 1.2
    let stepDown = false

    // Player bullets (allow up to 6 on screen)
    const pBullets: { x: number; y: number; w: number; h: number; v: number }[] = []

    // Enemy bullets
    const eBullets: { x: number; y: number; w: number; h: number; v: number }[] = []
    let lastEnemyShot = 0
    let enemyShotInterval = 500
    const startAt = performance.now()

    // (No player-side shields)

    // player fire cooldown for hold-to-fire
    let lastPlayerShot = 0
    let playerShotInterval = 55 // ~3x faster autofire

    const onKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true
      if (e.code === 'Space') keys['Space'] = true
      if (phaseRef.current !== 'playing') return
      if (e.key === ' ' || e.code === 'Space') {
        // immediate shot on press for responsiveness
        if (pBullets.length < 6) {
          pBullets.push({ x: player.x, y: player.y - 8, w: 2, h: 8, v: -4 })
          lastPlayerShot = performance.now()
        }
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false
      if (e.code === 'Space') keys['Space'] = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)

    function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)) }
    function rectHit(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
      return Math.abs(ax - bx) < (aw/2 + bw/2) && Math.abs(ay - by) < (ah/2 + bh/2)
    }

    function update(now: number) {
      if (phaseRef.current !== 'playing') return
      // player move
      if (keys['ArrowLeft'] || keys['a'] || keys['A']) player.x -= player.speed
      if (keys['ArrowRight'] || keys['d'] || keys['D']) player.x += player.speed
      player.x = clamp(player.x, player.w/2 + 6, width - player.w/2 - 6)

      // enemy group bounds
      let minX = Infinity, maxX = -Infinity
      for (const e of enemies) if (e.alive) { minX = Math.min(minX, e.x); maxX = Math.max(maxX, e.x) }
      if (minX === Infinity) { // all dead -> win
        running = false
        onFinish('player')
        return
      }
      const leftEdge = minX - 12
      const rightEdge = maxX + 12
      if (rightEdge + enemySpeed * dir > width - 8 || leftEdge + enemySpeed * dir < 8) {
        dir *= -1
        stepDown = true
        enemySpeed = Math.min(3.0, enemySpeed + 0.15)
      }
      for (const e of enemies) {
        if (!e.alive) continue
        e.x += enemySpeed * dir
        if (stepDown) e.y += 16
        if (e.y + e.h/2 >= player.y - player.h/2) {
          running = false
          onFinish('bot')
          return
        }
      }
      stepDown = false

      // player auto-fire while holding Space (with cooldown)
      if ((keys[' '] || (keys as any)['Space']) && (now - lastPlayerShot) > playerShotInterval) {
        if (pBullets.length < 6) {
          pBullets.push({ x: player.x, y: player.y - 8, w: 2, h: 8, v: -4 })
          lastPlayerShot = now
        }
      }

      // enemy shooting
      if (now - lastEnemyShot > enemyShotInterval) {
        const alive = enemies.filter(e => e.alive)
        if (alive.length > 0) {
          const shooter = alive[Math.floor(Math.random() * alive.length)]
          eBullets.push({ x: shooter.x, y: shooter.y + shooter.h/2 + 2, w: 2, h: 8, v: 3.6 })
          lastEnemyShot = now
          enemyShotInterval = 400 + Math.random() * 400
        }
      }

      // move bullets
      for (const b of pBullets) b.y += b.v
      for (const b of eBullets) b.y += b.v
      // cull offscreen
      for (let i = pBullets.length - 1; i >= 0; i--) if (pBullets[i].y < -12) pBullets.splice(i,1)
      for (let i = eBullets.length - 1; i >= 0; i--) if (eBullets[i].y > height + 12) eBullets.splice(i,1)

      // (no shields collisions)

      // collisions: player bullets vs enemies
      for (const b of pBullets) {
        for (const e of enemies) {
          if (!e.alive) continue
          if (rectHit(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) {
            e.hp = (e.hp ?? 1) - 1
            if (e.hp <= 0) {
              e.alive = false
              // win when all dead
              if (!enemies.some(en => en.alive)) {
                running = false
                setResult('player')
                setTimeout(() => onFinish('player'), 900)
              }
            }
            b.y = -9999
            break
          }
        }
      }
      // collisions: enemy bullets vs player
      for (const b of eBullets) {
        if (rectHit(b.x, b.y, b.w, b.h, player.x, player.y, player.w, player.h)) {
          b.y = height + 9999
          player.lives -= 1
          if (player.lives <= 0) {
            running = false
            setResult('bot')
            setTimeout(() => onFinish('bot'), 900)
            return
          }
        }
      }

      // Sudden death: after 10s, speed up drastically
      const elapsed = now - startAt
      if (elapsed > 10000) {
        enemySpeed = Math.max(enemySpeed, 2.2)
        enemyShotInterval = Math.min(enemyShotInterval, 350)
      }
    }

    function draw() {
      ctx.fillStyle = '#0b1020'
      ctx.fillRect(0, 0, width, height)

      // player
      ctx.fillStyle = '#22c55e'
      ctx.fillRect(player.x - player.w/2, player.y - player.h/2, player.w, player.h)

      // enemies
      for (const e of enemies) {
        if (!e.alive) continue
        ctx.fillStyle = e.hp > 1 ? '#60a5fa' : '#93c5fd'
        ctx.fillRect(e.x - e.w/2, e.y - e.h/2, e.w, e.h)
      }

      // (no shields drawn)

      // bullets
      ctx.fillStyle = '#a3e635'
      for (const b of pBullets) ctx.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h)
      ctx.fillStyle = '#f97316'
      for (const b of eBullets) ctx.fillRect(b.x - b.w/2, b.y - b.h/2, b.w, b.h)

      // HUD
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.font = '12px monospace'
      ctx.fillText('← → / A D: move, Space: fire', 10, height - 8)
      ctx.fillText(`Lives: ${player.lives}`, width - 80, height - 8)

      // Countdown overlay
      if (phaseRef.current !== 'playing') {
        ctx.fillStyle = 'rgba(0,0,0,0.4)'
        ctx.fillRect(0, 0, width, height)
        ctx.fillStyle = '#ffffff'
        ctx.font = 'bold 36px monospace'
        const text = overlayTextRef.current
        const metrics = ctx.measureText(text)
        ctx.fillText(text, (width - metrics.width) / 2, height / 2)
      }
    }

    function loop(now: number) {
      if (!running) return
      update(now)
      draw()
      requestAnimationFrame(loop)
    }
    requestAnimationFrame(loop)

    return () => {
      running = false
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onFinish, width, height])

  // Pre-start countdown: 3 -> 2 -> 1 -> Start! -> playing
  useEffect(() => {
    phaseRef.current = 'countdown'
    setPhase('countdown')
    overlayTextRef.current = '3'
    const t1 = setTimeout(() => { overlayTextRef.current = '2' }, 300)
    const t2 = setTimeout(() => { overlayTextRef.current = '1' }, 600)
    const t3 = setTimeout(() => { overlayTextRef.current = 'Start!' }, 900)
    const t4 = setTimeout(() => {
      phaseRef.current = 'playing'
      setPhase('playing')
      overlayTextRef.current = ''
    }, 1200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4) }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" data-phase={phase}>
      <div className="bg-white rounded-lg shadow-xl p-3 w-[520px] max-w-[92vw]">
        <div className="text-center font-semibold mb-2">Minigame: Space Invaders</div>
        <div className="flex items-center justify-center">
          <canvas ref={canvasRef} width={width} height={height} className="pixelated" />
        </div>
        <div className="text-center text-xs text-gray-600 mt-2">Arrow/A D = Move, Space = Fire</div>
      </div>
      {result && <ResultOverlay type={result === 'player' ? 'win' : 'lose'} />}
    </div>
  )
}
