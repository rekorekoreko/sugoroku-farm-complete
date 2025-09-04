type Props = {
  minigame: any
  onAttack: () => void
}

export default function BattleRPG({ minigame, onAttack }: Props) {
  const enemy = minigame?.enemy || { name: '？？？', hp: 0, max_hp: 1 }
  const playerHp = minigame?.player_hp ?? 0
  const log: string[] = Array.isArray(minigame?.log) ? minigame.log : []

  const bar = (cur: number, max: number, color: string) => {
    const pct = Math.max(0, Math.min(100, Math.round((cur / Math.max(1, max)) * 100)))
    return (
      <div className="w-full h-3 bg-gray-200 rounded">
        <div className={`h-3 ${color} rounded`} style={{ width: `${pct}%` }} />
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
      <div className="bg-white rounded-lg shadow-xl p-4 w-[520px] max-w-[92vw]">
        <div className="text-center font-semibold mb-3">バトル</div>

        <div className="grid grid-cols-2 gap-4 items-center">
          <div>
            <div className="text-sm text-gray-600">プレイヤー</div>
            {bar(playerHp, 12, 'bg-green-500')}
            <div className="text-xs text-gray-500 mt-1">HP {playerHp} / 12</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-600">{enemy.name}</div>
            {bar(enemy.hp, enemy.max_hp || enemy.hp, 'bg-red-500')}
            <div className="text-xs text-gray-500 mt-1">HP {enemy.hp} / {enemy.max_hp || enemy.hp}</div>
          </div>
        </div>

        <div className="mt-4 bg-gray-50 rounded p-2 h-24 overflow-y-auto">
          {log.length === 0 ? (
            <div className="text-xs text-gray-400">……</div>
          ) : log.map((m, i) => (
            <div key={i} className="text-xs text-gray-700">{m}</div>
          ))}
        </div>

        <div className="mt-4 flex justify-center gap-2">
          <button onClick={onAttack} className="px-4 py-2 rounded bg-indigo-600 text-white text-sm hover:bg-indigo-700">こうげき</button>
        </div>
      </div>
    </div>
  )
}

