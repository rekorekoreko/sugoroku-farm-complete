import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

type Props = {
  gameId: string
  apiBase: string
  onUpdate: (gs: any) => void
}

function Arena() {
  return (
    <group>
      {/* ground */}
      <mesh rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <circleGeometry args={[8, 48]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>
      {/* pillars ring */}
      {Array.from({ length: 10 }).map((_, i) => {
        const angle = (i / 10) * Math.PI * 2
        const r = 6.5
        return (
          <mesh key={i} position={[Math.cos(angle)*r, 0.8, Math.sin(angle)*r]} castShadow>
            <cylinderGeometry args={[0.12, 0.12, 1.6, 12]} />
            <meshStandardMaterial color="#374151" />
          </mesh>
        )
      })}
    </group>
  )
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

function PlayerController() {
  const { camera } = useThree()
  const pressed = useWASD()
  const speed = 3.2
  const up = new THREE.Vector3(0,1,0)
  useFrame((_, dt) => {
    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, up).multiplyScalar(-1)
    let move = new THREE.Vector3(0,0,0)
    if (pressed.current['KeyW']) move.add(dir)
    if (pressed.current['KeyS']) move.add(dir.clone().multiplyScalar(-1))
    if (pressed.current['KeyA']) move.add(right.clone().multiplyScalar(-1))
    if (pressed.current['KeyD']) move.add(right)
    if (move.lengthSq() > 0) {
      move.normalize().multiplyScalar(speed * dt)
      camera.position.add(move)
    }
    // keep camera close to ground and within arena
    camera.position.y = 1.0
    const r = Math.hypot(camera.position.x, camera.position.z)
    if (r > 7.5) {
      const ang = Math.atan2(camera.position.z, camera.position.x)
      camera.position.x = Math.cos(ang) * 7.5
      camera.position.z = Math.sin(ang) * 7.5
    }
  })
  return null
}

export default function FPSBattle({ gameId, apiBase, onUpdate }: Props) {
  const enemyRef = useRef<THREE.Mesh | null>(null)
  const [distance, setDistance] = useState(12)
  const [locked, setLocked] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [result, setResult] = useState<'win'|'lose'|null>(null)
  const [aim, setAim] = useState(false)
  const [hitFlash, setHitFlash] = useState(0)

  // distance indicator vs enemy on ground plane
  const updateDistance = useCallback(() => {
    try {
      const cam = (window as any).__r3f?.root?.getState?.()?.camera as THREE.PerspectiveCamera | undefined
      const enemy = enemyRef.current
      if (!cam || !enemy) return
      const a = cam.position.clone(); a.y = 0
      const b = enemy.position.clone(); b.y = 0
      setDistance(a.distanceTo(b))
    } catch {}
  }, [])

  useEffect(() => {
    let raf = 0
    const tick = () => { updateDistance(); raf = requestAnimationFrame(tick) }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [updateDistance])

  useEffect(() => {
    let t: any
    if (cooldown > 0) {
      t = setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 100)
    }
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    const preventCtx = (e: MouseEvent) => e.preventDefault()
    const onMouseDown = (e: MouseEvent) => {
      if (!locked) return
      if (e.button === 0) {
        // left click: shoot
        shoot()
      } else if (e.button === 2) {
        // right click: scope
        setAim(true)
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!locked) return
      if (e.button === 2) setAim(false)
    }
    window.addEventListener('contextmenu', preventCtx)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('contextmenu', preventCtx)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [locked])

  // simple bot auto-fire visual (client-only): periodic chance to hit the player
  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => {
      // higher chance when closer
      const p = Math.min(0.8, 0.15 + Math.max(0, 10 - distance) * 0.05)
      if (Math.random() < p) {
        setHitFlash(1)
        setTimeout(() => setHitFlash(0), 120)
      }
    }, 1000)
    return () => clearInterval(id)
  }, [locked, distance])

  const shoot = async () => {
    if (cooldown > 0) return
    setCooldown(5) // ~0.5s
    try {
      const res = await fetch(`${apiBase}/game/${gameId}/minigame/hybrid/command?action=attack`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (data?.message === 'victory') {
        setResult('win')
        setTimeout(() => { if (data?.game_state) onUpdate(data.game_state) }, 1000)
      } else if (data?.message === 'defeat') {
        setResult('lose')
        setTimeout(() => { if (data?.game_state) onUpdate(data.game_state) }, 1000)
      } else {
        if (data?.game_state) onUpdate(data.game_state)
      }
    } catch {}
  }

  function CameraZoom({ aim }: { aim: boolean }) {
    const { camera } = useThree()
    useFrame((_, dt) => {
      const cam = camera as THREE.PerspectiveCamera
      if ((cam as any).isPerspectiveCamera) {
        const target = aim ? 40 : 65
        cam.fov += (target - cam.fov) * Math.min(1, dt * 10)
        cam.updateProjectionMatrix()
      }
    })
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      <Canvas camera={{ position: [0, 1, 6], fov: 65 }} shadows>
        <color attach="background" args={[0.04,0.04,0.05]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4,6,3]} intensity={0.8} castShadow />
        <Arena />
        {/* enemy target */}
        <mesh ref={enemyRef as any} position={[0, 1, -4]} castShadow>
          <capsuleGeometry args={[0.35, 0.8, 4, 12]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        <PlayerController />
        <PointerLockControls onLock={() => setLocked(true)} onUnlock={() => setLocked(false)} />
        <CameraZoom aim={aim} />
      </Canvas>
      {/* HUD: minimal - distance + crosshair + hint */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm select-none drop-shadow">
        距離 {Math.round(distance)} m
      </div>
      <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
        <div className={`rounded-full ${aim ? 'w-1 h-1' : 'w-2 h-2'} bg-white/90`} />
      </div>
      {aim && (
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-black/25" />
        </div>
      )}
      {hitFlash > 0 && (
        <div className="absolute inset-0 bg-red-500/25 pointer-events-none" />
      )}
      {!locked && (
        <div className="absolute inset-0 flex items-center justify-center">
          <button className="px-4 py-2 rounded bg-white/90 text-slate-800 shadow pointer-events-auto">クリックで開始（WASD移動・左クリック射撃・右クリックスコープ）</button>
        </div>
      )}
      {result && (
        <div className="absolute inset-0">
          {/* Result overlay from existing component */}
        </div>
      )}
    </div>
  )
}
