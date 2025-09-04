import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { X } from 'lucide-react'
import { } from 'react'

// legacy simple character removed (unused)

function EstateBuilding() {
  return (
    <group position={[0, -0.1, 0]}>
      {/* base plaza */}
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#e5e7eb" />
      </mesh>
      {/* towers */}
      {[[-0.8, 0.6], [0, 0.9], [0.8, 0.7]].map(([x, h], i) => (
        <mesh key={i} position={[x, h/2, 0]}>
          <boxGeometry args={[0.6, h, 0.6]} />
          <meshStandardMaterial color="#64748b" />
        </mesh>
      ))}
      {/* windows */}
      {[-0.8, 0, 0.8].map((x, i) => (
        <mesh key={i} position={[x, 0.5, 0.31]}>
          <boxGeometry args={[0.4, 0.2, 0.02]} />
          <meshStandardMaterial color="#93c5fd" emissive="#60a5fa" emissiveIntensity={0.2} />
        </mesh>
      ))}
    </group>
  )
}

function FarmBarn() {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#dcfce7" />
      </mesh>
      {/* barn body */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[1.6, 0.8, 1.2]} />
        <meshStandardMaterial color="#ef4444" />
      </mesh>
      {/* roof */}
      <mesh position={[0, 0.95, 0]} rotation={[0, 0, Math.PI/6]}>
        <coneGeometry args={[1.4, 0.6, 4]} />
        <meshStandardMaterial color="#b91c1c" />
      </mesh>
      {/* silo */}
      <mesh position={[1.1, 0.6, -0.2]}>
        <cylinderGeometry args={[0.25, 0.25, 1.0, 16]} />
        <meshStandardMaterial color="#94a3b8" />
      </mesh>
      <mesh position={[1.1, 1.15, -0.2]}>
        <sphereGeometry args={[0.22, 16, 16]} />
        <meshStandardMaterial color="#64748b" />
      </mesh>
    </group>
  )
}

function ExchangeHall() {
  return (
    <group position={[0, -0.1, 0]}>
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#f1f5f9" />
      </mesh>
      {/* hall body */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.2, 1.0, 1.2]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      {/* pediment */}
      <mesh position={[0, 1.2, 0]}> 
        <coneGeometry args={[1.3, 0.6, 3]} />
        <meshStandardMaterial color="#475569" />
      </mesh>
      {/* columns */}
      {[-0.8, -0.4, 0, 0.4, 0.8].map((x, i) => (
        <mesh key={i} position={[x, 0.5, 0.6]}>
          <cylinderGeometry args={[0.08, 0.08, 1.0, 12]} />
          <meshStandardMaterial color="#cbd5e1" />
        </mesh>
      ))}
    </group>
  )
}

function BattleArena() {
  return (
    <group>
      {/* arena ground */}
      <mesh rotation={[-Math.PI/2, 0, 0]}>
        <circleGeometry args={[3, 32]} />
        <meshStandardMaterial color="#fee2e2" />
      </mesh>
      {/* pillars */}
      {Array.from({ length: 8 }).map((_, i) => {
        const angle = (i / 8) * Math.PI * 2
        const r = 2.2
        return (
          <mesh key={i} position={[Math.cos(angle)*r, 0.5, Math.sin(angle)*r]}>
            <cylinderGeometry args={[0.1, 0.1, 1.0, 12]} />
            <meshStandardMaterial color="#fca5a5" />
          </mesh>
        )
      })}
    </group>
  )
}

type Props = {
  open: boolean
  onClose?: () => void
  title?: string
  description?: string
  panel?: React.ReactNode
  kind?: 'market' | 'farm' | 'estate' | 'battle'
  backgroundOnly?: boolean
}

export default function EventStage3D({ open, onClose, title, description, panel, kind = 'market', backgroundOnly = false }: Props) {
  if (!open) return null
  const Model = kind === 'estate' ? EstateBuilding : kind === 'farm' ? FarmBarn : kind === 'battle' ? BattleArena : ExchangeHall
  if (backgroundOnly) {
    return (
      <div className="fixed inset-0 z-40 pointer-events-none">
        <Canvas camera={{ position: [2.8, 2.2, 2.8], fov: 50 }}>
          <ambientLight intensity={0.6} />
          <directionalLight position={[3, 5, 2]} intensity={0.8} />
          <Model />
          <OrbitControls enablePan={false} minDistance={2.5} maxDistance={5} />
        </Canvas>
      </div>
    )
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-lg shadow-2xl w-[960px] max-w-[95vw] grid grid-cols-1 md:grid-cols-2 overflow-hidden">
        <div className="relative h-[380px] bg-gradient-to-b from-sky-50 to-emerald-50">
          <Canvas camera={{ position: [2.8, 2.2, 2.8], fov: 50 }}>
            <ambientLight intensity={0.6} />
            <directionalLight position={[3, 5, 2]} intensity={0.8} />
            <Model />
            <OrbitControls enablePan={false} minDistance={2.5} maxDistance={5} />
          </Canvas>
          {title && (
            <div className="absolute top-2 left-2 bg-black/50 text-white text-xs px-2 py-1 rounded">{title}</div>
          )}
          {description && (
            <div className="absolute top-8 left-2 bg-black/30 text-white text-xs px-2 py-1 rounded max-w-[90%]">
              {description}
            </div>
          )}
        </div>
        <div className="p-4 bg-white">
          <div className="flex items-center justify-between mb-2">
            <div className="text-base font-semibold">{title}</div>
            {onClose && (
              <button onClick={onClose} className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="text-xs text-gray-500 mb-3">{description}</div>
          <div className="space-y-2">
            {panel}
          </div>
        </div>
      </div>
    </div>
  )
}
