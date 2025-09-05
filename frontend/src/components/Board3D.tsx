import { Canvas } from '@react-three/fiber'
import { OrbitControls, Text } from '@react-three/drei'

type Props = {
  players: { id: string; position: number }[]
  tiles: number
  squares?: Array<{
    is_market?: boolean
    is_farm?: boolean
    is_estate?: boolean
    is_battle?: boolean
    building_owner?: string | null
    owner?: string | null
    crop?: any
  }>
  className?: string
}

export default function Board3D({ players, tiles, squares = [], className }: Props) {
  const r = 3.4
  const tileNodes = Array.from({ length: tiles }).map((_, i) => {
    const a = (i / tiles) * Math.PI * 2
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    const sq = squares[i] || {}
    const isMarket = !!sq.is_market
    const isFarm = !!sq.is_farm
    const isEstate = !!sq.is_estate
    const isBattle = !!(sq as any).is_battle
    const hasCrop = !!sq.crop
    const baseColor = i % 5 === 0 ? '#52525b' : '#3f3f46'
    const eventColor = isMarket ? '#7c3aed' : isFarm ? '#f59e0b' : isEstate ? '#4f46e5' : isBattle ? '#ef4444' : null
    const ownerColor = (sq.building_owner || sq.owner) === 'bot' ? '#ef4444' : (sq.building_owner || sq.owner) ? '#60a5fa' : null
    return (
      <group key={i} position={[x, 0, z]} rotation={[0, -a, 0]}>
        {/* base tile */}
        <mesh>
          <boxGeometry args={[0.5, 0.1, 0.35]} />
          <meshStandardMaterial color={baseColor} />
        </mesh>
        {/* event marker (small sphere) */}
        {eventColor && (
          <mesh position={[0, 0.24, 0.05]}>
            <sphereGeometry args={[0.07, 18, 18]} />
            <meshStandardMaterial color={eventColor} emissive={eventColor} emissiveIntensity={0.2} />
          </mesh>
        )}
        {/* building/ownership ring */}
        {ownerColor && (
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <torusGeometry args={[0.22, 0.02, 8, 32]} />
            <meshStandardMaterial color={ownerColor} />
          </mesh>
        )}
        {/* crop cone */}
        {hasCrop && (
          <mesh position={[0, 0.18, -0.06]} rotation={[0, 0, 0]}>
            <coneGeometry args={[0.07, 0.14, 12]} />
            <meshStandardMaterial color="#22c55e" />
          </mesh>
        )}
        {/* tile number */}
        <Text position={[0, 0.32, 0]} fontSize={0.14} color="#e5e7eb" anchorX="center" anchorY="middle">
          {String(i)}
        </Text>
        {/* event icon as text */}
        {isMarket && (
          <Text position={[0, 0.42, 0.06]} fontSize={0.12} color="#c4b5fd" anchorX="center" anchorY="middle">市</Text>
        )}
        {isFarm && (
          <Text position={[0, 0.42, 0.06]} fontSize={0.12} color="#fcd34d" anchorX="center" anchorY="middle">田</Text>
        )}
        {isEstate && (
          <Text position={[0, 0.42, 0.06]} fontSize={0.12} color="#a5b4fc" anchorX="center" anchorY="middle">館</Text>
        )}
        {isBattle && (
          <Text position={[0, 0.42, 0.06]} fontSize={0.12} color="#fca5a5" anchorX="center" anchorY="middle">闘</Text>
        )}
      </group>
    )
  })

  const tokens = players.map((p, idx) => {
    const a = ((p.position % tiles) / tiles) * Math.PI * 2
    const rr = 3.4
    const x = Math.cos(a) * rr
    const z = Math.sin(a) * rr
    const y = 0.25
    return (
      <mesh key={p.id} position={[x, y, z]}> 
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshStandardMaterial color={idx === 0 ? '#60a5fa' : '#f87171'} />
      </mesh>
    )
  })

  return (
    <div className={className ?? 'w-full h-full'}>
      <Canvas camera={{ position: [0, 5.5, 7.8], fov: 50 }}>
        <color attach="background" args={[0.05, 0.07, 0.1]} />
        <fog attach="fog" args={[0x0b1014, 12, 24]} />
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 6, 2]} intensity={0.9} />
        {/* ground */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.06, 0]} receiveShadow>
          <circleGeometry args={[5.8, 72]} />
          <meshStandardMaterial color="#0b0f14" />
        </mesh>
        {/* outer ring */}
        <mesh rotation={[-Math.PI/2, 0, 0]} position={[0, -0.05, 0]}>
          <ringGeometry args={[5.5, 5.7, 64]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        {tileNodes}
        {tokens}
        <OrbitControls enablePan={false} minDistance={6.5} maxDistance={11} />
      </Canvas>
    </div>
  )
}
