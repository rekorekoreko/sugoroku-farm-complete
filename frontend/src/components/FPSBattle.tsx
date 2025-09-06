import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

type Props = {
  gameId: string
  apiBase: string
  onUpdate: (gs: any) => void
  minigame?: any
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
    // Right vector: use up x dir so that A=left, D=right
    const right = new THREE.Vector3().crossVectors(dir, up).normalize()
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

export default function FPSBattle({ gameId, apiBase, onUpdate, minigame }: Props) {
  const enemyRef = useRef<THREE.Mesh | null>(null)
  const [distance, setDistance] = useState(12)
  const [locked, setLocked] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [result, setResult] = useState<'win'|'lose'|null>(null)
  const [aim, setAim] = useState(false)
  const [hitFlash, setHitFlash] = useState(0)
  const lockAtRef = useRef<number>(0)
  const muzzleRef = useRef<number>(0)
  const [isFiring, setIsFiring] = useState(false)
  const lastFireAtRef = useRef<number>(0)
  const [hasWeapon] = useState(true)
  // weapon always equipped; no proximity logic needed
  const [tracers, setTracers] = useState<Array<{ id:number; s:[number,number,number]; e:[number,number,number]; col?: string; w?: number; ttl?: number }>>([])
  const [impacts, setImpacts] = useState<Array<{ id:number; p:[number,number,number] }>>([])

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
    const tick = () => {
      updateDistance()
      // no weapon pickup; always equipped
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [updateDistance, hasWeapon])

  useEffect(() => {
    let t: any
    if (cooldown > 0) {
      t = setTimeout(() => setCooldown(v => Math.max(0, v - 1)), 100)
    }
    return () => clearTimeout(t)
  }, [cooldown])

  useEffect(() => {
    if (!locked || result || !isFiring) return
    const iv = setInterval(() => {
      const now = performance.now()
      if (now - (lastFireAtRef.current || 0) >= 140) {
        lastFireAtRef.current = now
        shoot()
      }
    }, 40)
    return () => clearInterval(iv)
  }, [locked, result, isFiring])

  useEffect(() => {
    const preventCtx = (e: MouseEvent) => e.preventDefault()
    const onMouseDown = (e: MouseEvent) => {
      if (!locked) return
      e.preventDefault()
      const now = performance.now()
      if (now - (lockAtRef.current || 0) < 150) {
        // ignore the first click used to lock the pointer
        return
      }
      if (e.button === 2) {
        // right click: scope
        setAim(true)
      }
    }
    const onMouseUp = (e: MouseEvent) => {
      if (!locked) return
      if (e.button === 2) setAim(false)
      if (e.button === 0) setIsFiring(false)
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
        setTimeout(() => setHitFlash(0), 140)
        try {
          const cam = (window as any).__r3f?.root?.getState?.()?.camera as THREE.PerspectiveCamera | undefined
          const enemy = enemyRef.current
          if (cam && enemy) {
            const start = enemy.position.clone().add(new THREE.Vector3(0, 0.9, 0))
            const end = cam.position.clone().add(new THREE.Vector3(0, -0.05, 0))
            const id2 = Math.random()
            setTracers(t => [...t, { id: id2, s:[start.x,start.y,start.z], e:[end.x,end.y,end.z], col: '#f87171', w: 0.03, ttl: 240 }])
            setTimeout(() => setTracers(t => t.filter(x => x.id !== id2)), 240)
          }
        } catch {}
      }
    }, 900)
    return () => clearInterval(id)
  }, [locked, distance])

  const shoot = async () => {
    if (!hasWeapon) return
    // simple ROF limiter is handled by lastFireAtRef + interval
    setCooldown(2)
    // muzzle flash visual
    muzzleRef.current = 1
    setTimeout(() => { muzzleRef.current = 0 }, 80)
    // tracer visual (brighter, thicker, longer)
    try {
      const cam = (window as any).__r3f?.root?.getState?.()?.camera as THREE.PerspectiveCamera
      if (cam) {
        const origin = cam.position.clone()
        const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
        const ray = new THREE.Raycaster(origin, dir.normalize())
        let end = origin.clone().add(dir.clone().multiplyScalar(8))
        let hitPoint: THREE.Vector3 | null = null
        if (enemyRef.current) {
          const hits = ray.intersectObject(enemyRef.current, true)
          if (hits && hits.length > 0) { end.copy(hits[0].point); hitPoint = hits[0].point.clone() }
        }
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).multiplyScalar(-1)
        const start = origin.clone().add(dir.clone().multiplyScalar(0.2)).add(right.multiplyScalar(0.08)).add(new THREE.Vector3(0,-0.04,0))
        const id = Math.random()
        setTracers(t => [...t, { id, s:[start.x,start.y,start.z], e:[end.x,end.y,end.z], col: '#e6f3ff', w: 0.035, ttl: 220 }])
        setTimeout(() => setTracers(t => t.filter(x => x.id !== id)), 220)
        if (hitPoint) {
          const iid = Math.random()
          setImpacts(a => [...a, { id: iid, p: [hitPoint!.x, hitPoint!.y, hitPoint!.z] }])
          setTimeout(() => setImpacts(a => a.filter(v => v.id !== iid)), 220)
        }
      }
    } catch {}
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

  function Tracer({ s, e, col = '#f8fafc', w = 0.03 }: { s:[number,number,number]; e:[number,number,number]; col?: string; w?: number }) {
    const start = new THREE.Vector3().fromArray(s)
    const end = new THREE.Vector3().fromArray(e)
    const mid = start.clone().add(end).multiplyScalar(0.5)
    const dir = end.clone().sub(start)
    const len = dir.length()
    dir.normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir)
    return (
      <mesh position={[mid.x, mid.y, mid.z]} quaternion={quat}>
        <cylinderGeometry args={[w, w, Math.max(0.01, len), 8]} />
        <meshStandardMaterial color={col} emissive={col} emissiveIntensity={1.1} metalness={0.1} roughness={0.2} />
      </mesh>
    )
  }

  function Impact({ p }: { p:[number,number,number] }) {
    const pos = new THREE.Vector3().fromArray(p)
    return (
      <group position={[pos.x, pos.y, pos.z]}>
        <mesh>
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshStandardMaterial color="#fff7ae" emissive="#fff38a" emissiveIntensity={1.2} />
        </mesh>
      </group>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black" onContextMenu={(e) => e.preventDefault()}>
      <Canvas camera={{ position: [0, 1, 6], fov: 65 }} shadows onPointerDown={(e) => {
        if (!locked) return
        const ev = e as unknown as MouseEvent
        const now = performance.now()
        if (now - (lockAtRef.current || 0) < 150) return
        if (ev.button === 0) { setIsFiring(true); shoot() }
        if (ev.button === 2) setAim(true)
      }} onPointerUp={(e) => { if (!locked) return; const b = (e as any).button; if (b === 2) setAim(false); if (b === 0) setIsFiring(false) }}>
        <color attach="background" args={[0.04,0.04,0.05]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4,6,3]} intensity={0.8} castShadow />
        <Arena />
        {/* enemy target */}
        <mesh ref={enemyRef as any} position={[0, 1, -4]} castShadow>
          <capsuleGeometry args={[0.35, 0.8, 4, 12]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        {/* weapon pickup removed: always equipped */}
        {/* tracers */}
        {tracers.map(t => <Tracer key={t.id} s={t.s} e={t.e} col={t.col} w={t.w} />)}
        {impacts.map(im => <Impact key={im.id} p={im.p} />)}
        <PlayerController />
        <PointerLockControls onLock={() => { setLocked(true); lockAtRef.current = performance.now(); setAim(false) }} onUnlock={() => setLocked(false)} />
        <CameraZoom aim={aim} />
      </Canvas>
      {/* HUD: HP bars + distance + crosshair + hint */}
      {(() => {
        const enemyHp = Number((minigame as any)?.enemy?.hp ?? 0)
        const enemyMax = Number((minigame as any)?.enemy?.max_hp ?? Math.max(enemyHp, 1))
        const playerHp = Number((minigame as any)?.player_hp ?? 0)
        const enemyPct = Math.max(0, Math.min(100, Math.round((enemyHp / (enemyMax || 1)) * 100)))
        return (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-[70%] max-w-2xl pointer-events-none">
            <div className="flex flex-col gap-1">
              <div className="text-white text-xs drop-shadow">ENEMY HP {enemyHp}/{enemyMax}</div>
              <div className="w-full h-3 bg-white/20 rounded overflow-hidden">
                <div className="h-3 bg-rose-500" style={{ width: `${enemyPct}%` }} />
              </div>
              <div className="text-white text-xs drop-shadow mt-2">PLAYER HP {playerHp}</div>
              <div className="w-2/3 h-2 bg-white/20 rounded overflow-hidden">
                <div className="h-2 bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, (playerHp || 0) * 100 / 10))}%` }} />
              </div>
            </div>
          </div>
        )
      })()}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white text-sm select-none drop-shadow">
        霍晞屬 {Math.round(distance)} m
      </div>
      <div className="absolute inset-0 flex items-center justify-center select-none pointer-events-none">
        <div className={`rounded-full ${aim ? 'w-1 h-1' : 'w-2 h-2'} bg-white/90`} />
      </div>
      {/* muzzle flash overlay */}
      {muzzleRef.current ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/40 blur-sm" />
      ) : null}
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
          <button className="px-4 py-2 rounded bg-white/90 text-slate-800 shadow pointer-events-auto">クリックで開始（WASD移動・左クリック連射・右クリックスコープ）</button>
        </div>
      )}
      {/* 拾いヒントは削除（常時装備） */}
      {result && (
        <div className="absolute inset-0">
          {/* Result overlay from existing component */}
        </div>
      )}
    </div>
  )
}







