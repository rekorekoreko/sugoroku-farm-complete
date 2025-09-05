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

export default function FPSBattle({ gameId, apiBase, onUpdate }: Props) {
  const enemyRef = useRef<THREE.Mesh | null>(null)
  const weaponWorldRef = useRef<THREE.Group | null>(null)
  const [distance, setDistance] = useState(12)
  const [locked, setLocked] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const [result, setResult] = useState<'win'|'lose'|null>(null)
  const [aim, setAim] = useState(false)
  const [hitFlash, setHitFlash] = useState(0)
  const lockAtRef = useRef<number>(0)
  const muzzleRef = useRef<number>(0)
  const [hasWeapon, setHasWeapon] = useState(false)
  const [nearWeapon, setNearWeapon] = useState(false)
  const [tracers, setTracers] = useState<Array<{ id:number; s:[number,number,number]; e:[number,number,number] }>>([])

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
      try {
        // weapon proximity check (when not yet picked)
        if (!hasWeapon) {
          const cam = (window as any).__r3f?.root?.getState?.()?.camera as THREE.PerspectiveCamera | undefined
          if (cam && (weaponWorldRef as any)?.current) {
            const p = (weaponWorldRef as any).current.position as THREE.Vector3
            const d = cam.position.distanceTo(p)
            setNearWeapon(d < 1.2)
          } else {
            setNearWeapon(false)
          }
        } else {
          setNearWeapon(false)
        }
      } catch {}
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
    const preventCtx = (e: MouseEvent) => e.preventDefault()
    const onMouseDown = (e: MouseEvent) => {
      if (!locked) return
      e.preventDefault()
      const now = performance.now()
      if (now - (lockAtRef.current || 0) < 150) {
        // ignore the first click used to lock the pointer
        return
      }
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
    if (!hasWeapon) return
    if (cooldown > 0) return
    setCooldown(5) // ~0.5s
    // muzzle flash visual
    muzzleRef.current = 1
    setTimeout(() => { muzzleRef.current = 0 }, 80)
    // tracer visual
    try {
      const cam = (window as any).__r3f?.root?.getState?.()?.camera as THREE.PerspectiveCamera
      if (cam) {
        const origin = cam.position.clone()
        const dir = new THREE.Vector3(); cam.getWorldDirection(dir)
        const ray = new THREE.Raycaster(origin, dir.normalize())
        let end = origin.clone().add(dir.clone().multiplyScalar(8))
        if (enemyRef.current) {
          const hits = ray.intersectObject(enemyRef.current, true)
          if (hits && hits.length > 0) end.copy(hits[0].point)
        }
        const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0,1,0)).multiplyScalar(-1)
        const start = origin.clone().add(dir.clone().multiplyScalar(0.2)).add(right.multiplyScalar(0.08)).add(new THREE.Vector3(0,-0.04,0))
        const id = Math.random()
        setTracers(t => [...t, { id, s:[start.x,start.y,start.z], e:[end.x,end.y,end.z] }])
        setTimeout(() => setTracers(t => t.filter(x => x.id !== id)), 120)
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

  function Tracer({ s, e }: { s:[number,number,number]; e:[number,number,number] }) {
    const start = new THREE.Vector3().fromArray(s)
    const end = new THREE.Vector3().fromArray(e)
    const mid = start.clone().add(end).multiplyScalar(0.5)
    const dir = end.clone().sub(start)
    const len = dir.length()
    dir.normalize()
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0), dir)
    return (
      <mesh position={[mid.x, mid.y, mid.z]} quaternion={quat}>
        <cylinderGeometry args={[0.01, 0.01, Math.max(0.01, len), 6]} />
        <meshStandardMaterial color="#f8fafc" emissive="#ffffff" emissiveIntensity={0.6} />
      </mesh>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black" onContextMenu={(e) => e.preventDefault()}>
      <Canvas camera={{ position: [0, 1, 6], fov: 65 }} shadows onPointerDown={(e) => {
        if (!locked) return
        const ev = e as unknown as MouseEvent
        const now = performance.now()
        if (now - (lockAtRef.current || 0) < 150) return
        if (ev.button === 0) shoot()
        if (ev.button === 2) setAim(true)
      }} onPointerUp={(e) => { if (locked && (e as any).button === 2) setAim(false) }}>
        <color attach="background" args={[0.04,0.04,0.05]} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[4,6,3]} intensity={0.8} castShadow />
        <Arena />
        {/* enemy target */}
        <mesh ref={enemyRef as any} position={[0, 1, -4]} castShadow>
          <capsuleGeometry args={[0.35, 0.8, 4, 12]} />
          <meshStandardMaterial color="#ef4444" />
        </mesh>
        {/* weapon pickup: SCAR */}
        {!hasWeapon && (
          <group ref={weaponWorldRef as any} position={[1.2, 0.9, -1.6]} onPointerDown={() => setHasWeapon(true)}>
            <mesh position={[0, -0.3, 0]} castShadow>
              <boxGeometry args={[0.6, 0.3, 0.6]} />
              <meshStandardMaterial color="#6b4423" />
            </mesh>
            <mesh rotation={[0, Math.PI/4, 0]} castShadow>
              <boxGeometry args={[0.6, 0.06, 0.12]} />
              <meshStandardMaterial color="#d1d5db" />
            </mesh>
            <mesh position={[0.2, -0.02, 0]} castShadow>
              <boxGeometry args={[0.18, 0.08, 0.08]} />
              <meshStandardMaterial color="#9ca3af" />
            </mesh>
          </group>
        )}
        {/* tracers */}
        {tracers.map(t => <Tracer key={t.id} s={t.s} e={t.e} />)}
        <PlayerController />
        <PointerLockControls onLock={() => { setLocked(true); lockAtRef.current = performance.now(); setAim(false) }} onUnlock={() => setLocked(false)} />
        <CameraZoom aim={aim} />
      </Canvas>
      {/* HUD: minimal - distance + crosshair + hint */}
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
          <button className="px-4 py-2 rounded bg-white/90 text-slate-800 shadow pointer-events-auto">クリックで開始（WASD移動・左クリック攻撃・右クリックスコープ）</button>
        </div>
      )}
      {!hasWeapon && nearWeapon && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/60 text-white px-3 py-1 rounded">武器『SCAR』を拾うには この場所でクリック</div>
      )}
      {result && (
        <div className="absolute inset-0">
          {/* Result overlay from existing component */}
        </div>
      )}
    </div>
  )
}






