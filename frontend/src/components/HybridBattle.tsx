import EventStage3D from '@/components/EventStage3D'
import { useEffect, useRef, useState } from 'react'
import ResultOverlay from '@/components/ResultOverlay'

type Props = {
  gameId: string
  minigame: any
  apiBase: string
  onUpdate: (gs: any) => void
}

export default function HybridBattle({ gameId, apiBase, onUpdate }: Props) {
  const [distance, setDistance] = useState(100)
  const [moving, setMoving] = useState(true)
  const [result, setResult] = useState<'win' | 'lose' | null>(null)
  const rafRef = useRef<number | null>(null)
  const speedRef = useRef(18) // distance per second

  useEffect(() => {
    if (!moving) return
    let prev = performance.now()
    const loop = (now: number) => {
      const dt = (now - prev) / 1000
      prev = now
      setDistance(d => Math.max(0, d - speedRef.current * dt))
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [moving])

  useEffect(() => {
    if (distance <= 0) setMoving(false)
  }, [distance])

  const act = async (action: string) => {
    try {
      const res = await fetch(`${apiBase}/game/${gameId}/minigame/hybrid/command?action=${encodeURIComponent(action)}`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (data?.message === 'victory') {
        setResult('win')
        setTimeout(() => { if (data?.game_state) onUpdate(data.game_state) }, 1200)
      } else if (data?.message === 'defeat') {
        setResult('lose')
        setTimeout(() => { if (data?.game_state) onUpdate(data.game_state) }, 1200)
      } else {
        if (data?.game_state) onUpdate(data.game_state)
        if (data?.message === 'turn resolved') {
          setDistance(100)
          setMoving(true)
        }
      }
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50">
      {/* 3D battle arena background */}
      <EventStage3D open backgroundOnly kind="battle" />

      {/* HUD */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-4 left-1/2 -translate-x-1/2 w-[60%] max-w-xl">
          <div className="text-center text-white text-sm mb-1 drop-shadow">接近距離</div>
          <div className="w-full h-3 bg-white/30 rounded overflow-hidden">
            <div className="h-3 bg-emerald-400" style={{ width: `${Math.max(0, Math.min(100, 100 - distance))}%` }} />
          </div>
          <div className="text-center text-white text-xs mt-1 drop-shadow">{Math.ceil(distance)} m</div>
        </div>
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xl flex items-center justify-center gap-3">
          {moving ? (
            <div className="pointer-events-auto flex items-center gap-2">
              <button className="px-4 py-2 rounded bg-white/80 text-slate-800 text-sm hover:bg-white" onClick={() => setMoving(false)}>停止</button>
              <button className="px-4 py-2 rounded bg-white/80 text-slate-800 text-sm hover:bg-white" onClick={() => speedRef.current = 26}>ダッシュ</button>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center gap-2">
              <button className="px-4 py-2 rounded bg-rose-600 text-white text-sm hover:bg-rose-700" onClick={() => act('attack')}>攻撃</button>
              <button className="px-4 py-2 rounded bg-amber-600 text-white text-sm hover:bg-amber-700" onClick={() => act('heavy')}>重撃</button>
              <button className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700" onClick={() => act('defend')}>防御</button>
              <button className="px-4 py-2 rounded bg-sky-600 text-white text-sm hover:bg-sky-700" onClick={() => act('dodge')}>回避</button>
              <button className="px-4 py-2 rounded bg-white/80 text-slate-800 text-sm hover:bg-white" onClick={() => { setDistance(100); setMoving(true) }}>離脱</button>
            </div>
          )}
        </div>
      </div>
      {result && <ResultOverlay type={result} />}
    </div>
  )
}
