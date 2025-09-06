import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'

type Props = {
  gameId: string
  apiBase: string
  minigame: any
  onUpdate: (gs: any) => void
}

function useWASD() {
  const pressed = useRef<Record<string, boolean>>({})
  useEffect(() => {
    const dn = (e: KeyboardEvent) => { pressed.current[e.code] = true }
    const up = (e: KeyboardEvent) => { pressed.current[e.code] = false }
    window.addEventListener('keydown', dn)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', dn); window.removeEventListener('keyup', up) }
  }, [])
  return pressed
}

function PlayerController({ baseY = 1.1 }: { baseY?: number }) {
  const { camera } = useThree()
  const pressed = useWASD()
  const up = new THREE.Vector3(0,1,0)
  const speed = 3.0
  useFrame((_, dt) => {
    const dir = new THREE.Vector3(); camera.getWorldDirection(dir); dir.y = 0; dir.normalize()
    // Right vector so that A=left, D=right
    const right = new THREE.Vector3().crossVectors(dir, up).normalize()
    let move = new THREE.Vector3()
    if (pressed.current['KeyW']) move.add(dir)
    if (pressed.current['KeyS']) move.add(dir.clone().multiplyScalar(-1))
    if (pressed.current['KeyA']) move.add(right.clone().multiplyScalar(-1))
    if (pressed.current['KeyD']) move.add(right)
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt)
      camera.position.add(move)
    }
    camera.position.y = baseY
  })
  return null
}

export default function FPSMining({ gameId, apiBase, minigame, onUpdate }: Props) {
  const [locked, setLocked] = useState(false)
  const [score, setScore] = useState<number>(Number(minigame?.score || 0))
  const [botScore, setBotScore] = useState<number>(Number(minigame?.bot_score || 0))
  const [timeLeft, setTimeLeft] = useState<number>(Number(minigame?.time_limit || 60))
  const field = (minigame?.field || []) as Array<{ id: number; kind: string; value: number; mined: boolean }>
  const [localField, setLocalField] = useState(field)

  useEffect(() => {
    setLocalField(field)
    setScore(Number(minigame?.score || 0))
    setBotScore(Number(minigame?.bot_score || 0))
    setTimeLeft(Number(minigame?.time_limit || 30))
  }, [minigame])

  useEffect(() => {
    if (!locked) return
    if (timeLeft <= 0) return
    const id = setInterval(() => setTimeLeft(t => Math.max(0, t - 1)), 1000)
    return () => clearInterval(id)
  }, [locked, timeLeft])

  useEffect(() => {
    if (timeLeft === 0) finish()
  }, [timeLeft])

  const colors: Record<string, string> = {
    diamond: '#60a5fa',
    emerald: '#34d399',
    sapphire: '#38bdf8',
    topaz: '#f59e0b',
    iron: '#9ca3af',
    stone: '#374151',
    dirt: '#6b7280',
  }

  const blocks = useMemo(() => {
    const LAYERS = 6
    const COLS = 10
    const ROWS = Math.max(1, Math.ceil(localField.length / (COLS * LAYERS)))
    const out: Array<{ id: number; pos: [number, number, number]; col: string; mined: boolean; layer: number }>=[]
    for (let idx=0; idx<localField.length; idx++) {
      const b = localField[idx]
      const columnIndex = idx % (COLS * ROWS)
      const layer = Math.floor(idx / (COLS * ROWS))
      const c = columnIndex % COLS
      const r = Math.floor(columnIndex / COLS)
      const x = (c - (COLS/2) + 0.5) * 0.6
      const z = (r - (ROWS/2) + 0.5) * 0.6 - 1.0
      const y = 0.25 - layer * 0.5
      out.push({ id: b.id, pos: [x,y,z], col: colors[b.kind] || '#4b5563', mined: !!b.mined, layer })
    }
    return out
  }, [localField])

  // sink camera by 0.5 per cleared layer
  const baseY = useMemo(() => {
    // derive visible layer from index-based layout (same math as blocks)
    const LAYERS = 6
    const COLS = 10
    const ROWS = Math.max(1, Math.ceil(localField.length / (COLS * LAYERS)))
    let minLayer = 0
    for (let idx=0; idx<localField.length; idx++) {
      const b = localField[idx]
      if (!b.mined) {
        const layer = Math.floor(idx / (COLS * ROWS))
        minLayer = layer
        break
      }
    }
    return 1.1 - 0.5 * Math.max(0, minLayer)
  }, [localField])

  const dig = async (blockId: number) => {
    try {
      const res = await fetch(`${apiBase}/game/${gameId}/minigame/mining/dig?block_id=${blockId}`, { method: 'POST' })
      const data = await res.json()
      if (data?.minigame) {
        setScore(Number(data.minigame.score || 0))
        setLocalField(data.minigame.field || localField)
        setBotScore(Number(data.minigame.bot_score || 0))
      }
    } catch {}
  }

  // Bot autonomous digging loop
  useEffect(() => {
    if (timeLeft <= 0) return
    let timer: any
    const tick = async () => {
      try {
        const res = await fetch(`${apiBase}/game/${gameId}/minigame/mining/bot-dig`, { method: 'POST' })
        const data = await res.json()
        if (data?.minigame) {
          setLocalField(data.minigame.field || localField)
          setBotScore(Number(data.minigame.bot_score || 0))
        }
      } catch {}
      // jittered interval for a natural feel
      timer = setTimeout(tick, 450 + Math.random() * 350)
    }
    timer = setTimeout(tick, 600)
    return () => clearTimeout(timer)
  }, [timeLeft, apiBase, gameId])

  const finish = async () => {
    try {
      const res = await fetch(`${apiBase}/game/${gameId}/minigame/mining/finish`, { method: 'POST' })
      const data = await res.json()
      if (data?.game_state) onUpdate(data.game_state)
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Canvas camera={{ position: [0, 1.4, 3.2], fov: 70 }}>
        <color attach="background" args={[0.03,0.04,0.06]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3,6,1]} intensity={0.8} />
        {/* ground (grass) */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, 0, 0]}>
          <planeGeometry args={[16, 16]} />
          <meshStandardMaterial color="#166534" roughness={0.95} metalness={0.05} />
        </mesh>
        {/* ore ground */}
        {blocks.map(b => (
          b.mined ? null : (
            <mesh key={b.id} position={b.pos} userData={{ blockId: b.id }} onPointerDown={(e) => { if (locked && (e as any).button === 0) dig(b.id) }}>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color={b.col} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
            </mesh>
          )
        ))}
        <PlayerController baseY={baseY} />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
      </Canvas>
      {/* HUD */}
      <div className="absolute top-3 left-3 text-white text-sm bg-black/30 rounded px-2 py-1">You {score}</div>
      <div className="absolute top-3 left-28 text-white text-sm bg-black/30 rounded px-2 py-1">BOT {botScore}</div>
      <div className="absolute top-3 right-3 text-white text-sm bg-black/30 rounded px-2 py-1">Time {timeLeft}s</div>
      {!locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button className="px-4 py-2 rounded bg-white/90 text-slate-800 shadow pointer-events-auto">Click to start (Move: WASD, Dig: Left Click)</button>
        </div>
      )}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <button onClick={finish} className="px-4 py-2 rounded bg-emerald-600 text-white shadow hover:bg-emerald-700">Finish Mining</button>
      </div>
    </div>
  )
}





