import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import EventLog from '@/components/EventLog'
import InvaderDuel from '@/components/InvaderDuel'
import BattleRPG from '@/components/BattleRPG'
import EventStage3D from '@/components/EventStage3D'
import Board3D from '@/components/Board3D'
// import HybridBattle from '@/components/HybridBattle'
import FPSBattle from '@/components/FPSBattle'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Sprout, Wheat, Carrot, Apple, Coins, Menu, X, User, Bot as BotIcon } from 'lucide-react'
import './App.css'

type CropType = 'carrot' | 'tomato' | 'corn' | 'wheat'
type CropStage = 'planted' | 'growing' | 'ready'

interface Crop {
  type: CropType
  stage: CropStage
  planted_turn: number
  growth_time: number
}

interface Square {
  id: number
  crop?: Crop
  owner?: string
  is_market?: boolean
  is_farm?: boolean
  is_estate?: boolean
  is_battle?: boolean
  building_owner?: string
  // AI story overlay (optional)
  is_story?: boolean
  story_label?: string
  story_color?: string
  story_turns?: number
  story_effect?: string
}

interface Player {
  id: string
  name: string
  position: number
  coins: number
  crops_harvested: number
  stocks_shares?: number
  inventory?: Record<string, number>
}

interface GameState {
  players: Player[]
  current_player: number
  board: Square[]
  turn: number
  dice_value?: number
  awaiting_action?: boolean
  stock_price?: number
  last_stock_change?: number
  crop_prices?: Record<string, number>
  crop_changes?: Record<string, number>
  bazaar_offer_price?: number
  minigame?: any
  game_over?: boolean
  final_assets?: Record<string, number>
  winner?: string | null
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function App() {
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [isRolling, setIsRolling] = useState(false)
  const [selectedCrop, setSelectedCrop] = useState<CropType>('carrot')
  const [eventMessages, setEventMessages] = useState<string[]>([])
  const [estateTarget, setEstateTarget] = useState<number>(0)
  const [displayPositions, setDisplayPositions] = useState<number[] | null>(null)
  const [showStatus, setShowStatus] = useState(false)
  const [showEventStage, setShowEventStage] = useState(false)
  const [showNextStagePrompt, setShowNextStagePrompt] = useState(false)
  const minigameReadySent = useRef(false)

  const createGame = async () => {
    const name = (playerName ?? '').trim() || 'プレイヤー'
    try {
      const response = await fetch(`${API_BASE}/game/create?player_name=${encodeURIComponent(name)}`, { method: 'POST' })
      const data = await response.json()
      setGameId(data.game_id)
      setGameState(data.game_state)
      setEventMessages([])
    } catch (e) {
      console.error('Failed to create game:', e)
      setEventMessages(prev => ['ゲーム開始に失敗しました。バックエンドは起動していますか？', ...prev])
    }
  }

  const getDiceIcon = (value: number) => {
    const icons = [Dice1, Dice2, Dice3, Dice4, Dice5, Dice6]
    const Icon = icons[value - 1]
    return <Icon className="w-8 h-8" />
  }

  const getCropIcon = (cropType: string) => {
    switch (cropType) {
      case 'carrot': return <Carrot className="w-6 h-6 text-orange-500" />
      case 'tomato': return <Apple className="w-6 h-6 text-red-500" />
      case 'corn': return <Wheat className="w-6 h-6 text-yellow-500" />
      case 'wheat': return <Wheat className="w-6 h-6 text-amber-600" />
      default: return <Sprout className="w-6 h-6 text-green-500" />
    }
  }

  const getCropStageColor = (stage: string) => {
    switch (stage) {
      case 'planted': return 'bg-gray-200 text-gray-800'
      case 'growing': return 'bg-green-200 text-green-800'
      case 'ready': return 'bg-yellow-200 text-yellow-800'
      default: return 'bg-gray-200 text-gray-800'
    }
  }

  const getStoryBadgeColor = (color?: string) => {
    switch (color) {
      case 'rose': return 'bg-rose-100 text-rose-700'
      case 'emerald': return 'bg-emerald-100 text-emerald-700'
      case 'sky': return 'bg-sky-100 text-sky-700'
      case 'amber': return 'bg-amber-100 text-amber-700'
      default: return 'bg-fuchsia-100 text-fuchsia-700'
    }
  }

  // animate one-player movement step by step
  const animateMovement = async (
    playerIndex: number,
    fromPos: number,
    steps: number,
    boardLen: number,
    delayMs = 250,
    startPositions?: number[],
  ) => {
    let current = (displayPositions ?? startPositions ?? gameState?.players.map(p => p.position) ?? []).slice()
    if (current.length === 0) return
    setDisplayPositions(current)
    for (let i = 1; i <= steps; i++) {
      current = current.slice()
      current[playerIndex] = (fromPos + i) % boardLen
      setDisplayPositions(current)
      await new Promise(r => setTimeout(r, delayMs))
    }
  }

  const rollDice = async () => {
    if (!gameId || isRolling || !gameState) return
    setIsRolling(true)
    try {
      const moverIndex = gameState.current_player
      const startPos = gameState.players[moverIndex].position
      const boardLen = gameState.board.length

      const res = await fetch(`${API_BASE}/game/${gameId}/roll-dice`, { method: 'POST' })
      const data = await res.json()

      const steps: number = (data.dice_value ?? data.game_state?.dice_value ?? 0) as number
      if (steps > 0) {
        await animateMovement(moverIndex, startPos, steps, boardLen, 250, gameState.players.map(p => p.position))
      }
      // apply server state, then clear animation positions
      setGameState(data.game_state)
      setEventMessages(data.events || [])
      setDisplayPositions(null)
    } catch (e) {
      console.error('Failed to roll dice:', e)
    } finally {
      setIsRolling(false)
    }
  }

  // Minigame lifecycle: auto-ready when server sets a minigame
  useEffect(() => {
    (async () => {
      if (!gameId || !gameState || !gameState.minigame) return
      if (minigameReadySent.current) return
      try {
        let res: Response
        if ((gameState.minigame as any)?.type === 'rpg') {
          // upgrade to hybrid on battle square
          res = await fetch(`${API_BASE}/game/${gameId}/minigame/hybrid/start`, { method: 'POST' })
        } else {
          res = await fetch(`${API_BASE}/game/${gameId}/minigame/ready`, { method: 'POST' })
        }
        try {
          const data = await res.json()
          if (data?.game_state) setGameState(data.game_state)
        } catch {}
      } catch {}
      minigameReadySent.current = true
    })()
  }, [gameId, gameState?.minigame])

  const onFinishMinigame = async (w: 'player'|'bot') => {
    if (!gameId) return
    const attackerId = (gameState as any)?.minigame?.attacker_id as string | undefined
    const humanId = (gameState as any)?.players?.find?.((p: any) => p?.id !== 'bot')?.id as string | undefined
    let winner: 'attacker' | 'defender' = 'attacker'
    if (w === 'player') {
      winner = attackerId && humanId && attackerId !== humanId ? 'defender' : 'attacker'
    } else {
      winner = attackerId && humanId && attackerId !== humanId ? 'attacker' : 'defender'
    }
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/minigame/resolve?winner=${winner}`, { method: 'POST' })
      const data = await res.json()
      if (data?.events && Array.isArray(data.events)) {
        setEventMessages(prev => [...prev, ...data.events])
      }
      setGameState(data.game_state)
    } catch (e) {
      console.error('Failed to resolve minigame:', e)
    } finally {
      minigameReadySent.current = false
    }
  }

  const battleAttack = async () => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/minigame/rpg/act?action=attack`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
    } catch (e) {
      console.error('Failed to do battle action:', e)
    }
  }

  // auto open 3D stage for event tiles when it's human action phase
  useEffect(() => {
    if (!gameState) return
    const me = gameState.players[gameState.current_player]
    const sq = gameState.board[me.position]
    const isEvent = !!(sq.is_market || sq.is_farm || sq.is_estate)
    const shouldOpen = isEvent && me.id !== 'bot' && !!gameState.awaiting_action
    setShowEventStage(shouldOpen)
  }, [gameState?.current_player, gameState?.awaiting_action, gameState?.turn])

  // show next-stage prompt when the game is cleared
  useEffect(() => {
    if (!gameState) return
    if (gameState.game_over) {
      setShowNextStagePrompt(true)
    }
  }, [gameState?.game_over])

  const goToNextStage = async () => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/next-stage`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
      setEventMessages(prev => ['次のステージへ進みました（40マス・3Dマップ）', ...prev])
      setShowNextStagePrompt(false)
    } catch (e) {
      console.error('Failed to go to next stage:', e)
    }
  }

  // panels for each event
  const renderEventPanel = () => {
    if (!gameState) return null
    const me = gameState.players[gameState.current_player]
    const sq = gameState.board[me.position]
    if (sq.is_market) {
      return (
        <div className="space-y-2">
          <div className="text-sm">価格: {gameState.stock_price ?? 100}（{(gameState.last_stock_change ?? 0) >= 0 ? '+' : ''}{gameState.last_stock_change ?? 0}%）</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 [&>button]:h-8 [&>button]:px-2 [&>button]:text-xs">
            <Button variant="outline" onClick={() => buyStock(1)} disabled={!gameState.awaiting_action || me.id === 'bot' || (gameState.stock_price ?? 100) > me.coins}>買う(1)</Button>
            <Button variant="outline" onClick={() => buyStock(5)} disabled={!gameState.awaiting_action || me.id === 'bot' || ((gameState.stock_price ?? 100) * 5) > me.coins}>買う(5)</Button>
            <Button variant="outline" onClick={() => sellStock(1)} disabled={!gameState.awaiting_action || me.id === 'bot' || (me.stocks_shares ?? 0) < 1}>売る(1)</Button>
            <Button variant="outline" onClick={() => sellStock(me.stocks_shares ?? 0)} disabled={!gameState.awaiting_action || me.id === 'bot' || (me.stocks_shares ?? 0) < 1}>全部売る</Button>
          </div>
        </div>
      )
    }
    if (sq.is_farm) {
      return (
        <div className="space-y-2">
          {gameState.bazaar_offer_price ? (
            <div className="text-sm">バイヤーが{gameState.bazaar_offer_price}ゴールドで買い取り希望！</div>
          ) : (
            <div className="text-xs text-gray-500">バイヤーは不在（プレイヤーのターン3回ごとに出現）</div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(['carrot','tomato','corn','wheat'] as const).map((k) => {
              const owned = (me.inventory ?? {})[k] ?? 0
              return (
                <div key={k} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm p-2 border rounded">
                  <div className="capitalize truncate">
                    {k}
                    <span className="ml-2 text-xs text-gray-500">所持: {owned}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 sm:justify-end">
                    <Button size="sm" onClick={() => sellInventory(k, 1)} disabled={!gameState.awaiting_action || me.id === 'bot' || owned < 1 || !gameState.bazaar_offer_price} variant="outline" className="px-2">売る(1)</Button>
                    <Button size="sm" onClick={() => sellInventory(k, owned)} disabled={!gameState.awaiting_action || me.id === 'bot' || owned < 1 || !gameState.bazaar_offer_price} variant="outline" className="px-2">全部売る</Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }
    if (sq.is_estate) {
      return (
        <div className="space-y-2">
          <div className="text-xs text-gray-600">イベントマス以外に建設できます（500コイン）</div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-gray-600">建設マスID</label>
            <input type="number" min={0} max={Math.max(0, (gameState?.board?.length ?? 1) - 1)} value={estateTarget} onChange={(e) => setEstateTarget(Math.max(0, Math.min(Math.max(0, (gameState?.board?.length ?? 1) - 1), Number(e.target.value) || 0)))} className="w-24 px-2 py-1 border rounded" />
            <Button onClick={() => buildEstate(estateTarget)} disabled={!gameState.awaiting_action || me.id === 'bot' || me.coins < 500} variant="outline">建設(500)</Button>
          </div>
        </div>
      )
    }
    return null
  }

  const eventTitle = (() => {
    if (!gameState) return ''
    const me = gameState.players[gameState.current_player]
    const sq = gameState.board[me.position]
    if (sq.is_market) return '株式取引所'
    if (sq.is_farm) return '農場バザー'
    if (sq.is_estate) return '不動産'
    return ''
  })()

  const eventDescription = (() => {
    if (!gameState) return undefined
    const me = gameState.players[gameState.current_player]
    const sq = gameState.board[me.position]
    if (sq.is_market) return 'ここで株を売買できます。'
    if (sq.is_farm) return '作物をまとめて売却できます。'
    if (sq.is_estate) return '指定マスに建設して収入を得ましょう。'
    return undefined
  })()

  const endTurn = async () => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/end-turn`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
      // run bot turn if next is bot
      try {
        const next = data.game_state.players[data.game_state.current_player]
        if (next?.id === 'bot') {
          await runBotTurn(data.game_state)
        }
      } catch {}
    } catch (e) {
      console.error('Failed to end turn:', e)
    }
  }

  const plantCrop = async () => {
    if (!gameId) return
    try {
      // guard: do not plant on special tiles
      if (gameState) {
        const sq = gameState.board[gameState.players[gameState.current_player].position]
        if (sq.is_market || sq.is_farm || sq.is_estate) {
          setEventMessages(prev => ['イベントマスでは植え付けできません', ...prev])
          return
        }
      }
      const res = await fetch(`${API_BASE}/game/${gameId}/plant-crop?crop_type=${selectedCrop}`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
      // if next player is bot, auto-run bot turn
      try {
        const next = data.game_state.players[data.game_state.current_player]
        if (next?.id === 'bot') {
          await runBotTurn(data.game_state)
        }
      } catch {}
    } catch (e) {
      console.error('Failed to plant crop:', e)
    }
  }

  const harvestCrop = async () => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/harvest-crop`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
      // if next player is bot, auto-run bot turn with animation
      try {
        const next = data.game_state.players[data.game_state.current_player]
        if (next?.id === 'bot') {
          await runBotTurn(data.game_state)
        }
      } catch {}
    } catch (e) {
      console.error('Failed to harvest crop:', e)
    }
  }

  const buyStock = async (shares: number) => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/buy-stock?shares=${shares}`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
    } catch (e) {
      console.error('Failed to buy stock', e)
    }
  }

  const sellStock = async (shares: number) => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/sell-stock?shares=${shares}`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
    } catch (e) {
      console.error('Failed to sell stock', e)
    }
  }

  const sellInventory = async (crop: string, qty: number) => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/sell-inventory?crop_type=${encodeURIComponent(crop)}&qty=${qty}`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
    } catch (e) {
      console.error('Failed to sell inventory', e)
    }
  }

  const buildEstate = async (targetId: number) => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/build-estate?target_square_id=${targetId}`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
    } catch (e) {
      console.error('Failed to build estate', e)
    }
  }

  // run bot's full turn automatically (roll dice + animate)
  const runBotTurn = async (sourceState?: GameState) => {
    if (!gameId) return
    let s = sourceState ?? gameState
    if (!s) return
    // only proceed if it's bot's turn
    if (s.players[s.current_player]?.id !== 'bot') return
    try {
      const moverIndex = s.current_player
      const startPos = s.players[moverIndex].position
      const boardLen = s.board.length
      const res = await fetch(`${API_BASE}/game/${gameId}/roll-dice`, { method: 'POST' })
      const data = await res.json()
      const steps: number = (data.dice_value ?? data.game_state?.dice_value ?? 0) as number
      if (steps > 0) {
        await animateMovement(moverIndex, startPos, steps, boardLen, 250, s.players.map(p => p.position))
      }
      setGameState(data.game_state)
      setEventMessages(data.events || [])
      setDisplayPositions(null)
    } catch (e) {
      console.error('Failed to run bot turn:', e)
    }
  }

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold text-green-800">Leko</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">プレイヤー名</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="名前を入力してください"
              />
            </div>
            <Button type="button" onClick={createGame} className="w-full bg-green-600 hover:bg-green-700">ゲーム開始</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!gameState) return <div>Loading...</div>

  const currentPlayer = gameState.players[gameState.current_player]
  const currentSquare = gameState.board[currentPlayer.position]

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-100 to-blue-100 p-4">
      {/* Stage 2 (40 tiles): render an embedded 3D sugoroku board, hide 2D grid */}
      <EventStage3D open={showEventStage && !gameState?.minigame} onClose={() => setShowEventStage(false)} title={eventTitle} description={eventDescription} panel={renderEventPanel()} kind={currentSquare.is_market ? 'market' : currentSquare.is_farm ? 'farm' : currentSquare.is_estate ? 'estate' : 'market'} />
      {gameState?.minigame && (gameState.minigame as any)?.type === 'rpg' && (
        <EventStage3D open={true} backgroundOnly kind="battle" />
      )}
      {gameState?.minigame && (gameState.minigame as any)?.type === 'hybrid' && (
        <FPSBattle gameId={gameId!} apiBase={API_BASE} onUpdate={(gs) => setGameState(gs)} />
      )}
      {/* Hamburger button */}
      <button
        onClick={() => setShowStatus(true)}
        className="fixed top-4 left-4 z-40 inline-flex items-center justify-center w-9 h-9 rounded-md bg-white/90 border shadow hover:bg-white"
        aria-label="Open status"
      >
        <Menu className="w-5 h-5 text-slate-700" />
      </button>

      {/* Slide-over Status Panel */}
      {showStatus && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowStatus(false)} />
          <div className="absolute top-0 right-0 h-full w-[360px] max-w-[92vw] bg-white shadow-xl border-l p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-base font-semibold">ステータス</div>
              <button onClick={() => setShowStatus(false)} className="inline-flex items-center justify-center w-8 h-8 rounded hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            {gameState && gameState.players.map((p) => {
              const isBot = p.id === 'bot'
              const titleIcon = isBot ? <BotIcon className="w-4 h-4" /> : <User className="w-4 h-4" />
              const inv = p.inventory ?? {}
              return (
                <div key={p.id} className="mb-4 rounded-lg border p-3 bg-white">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-semibold">
                      {titleIcon}
                      <span>{p.name}</span>
                    </div>
                    <div className={`text-xs px-2 py-0.5 rounded ${isBot ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>{isBot ? 'BOT' : 'PLAYER'}</div>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <div className="flex items-center gap-1 text-slate-700"><Coins className="w-4 h-4 text-yellow-500" />{p.coins}</div>
                    <div className="text-slate-700">位置: {p.position}</div>
                    <div className="text-slate-700">収穫: {p.crops_harvested}</div>
                    <div className="text-slate-700">株: {p.stocks_shares ?? 0}</div>
                  </div>
                  <div className="mt-2">
                    <div className="text-xs text-slate-500 mb-1">インベントリ</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2"><Carrot className="w-4 h-4 text-orange-500" /><span>carrot</span><span className="ml-auto text-slate-700">{inv['carrot'] ?? 0}</span></div>
                      <div className="flex items-center gap-2"><Apple className="w-4 h-4 text-red-500" /><span>tomato</span><span className="ml-auto text-slate-700">{inv['tomato'] ?? 0}</span></div>
                      <div className="flex items-center gap-2"><Wheat className="w-4 h-4 text-yellow-500" /><span>corn</span><span className="ml-auto text-slate-700">{inv['corn'] ?? 0}</span></div>
                      <div className="flex items-center gap-2"><Wheat className="w-4 h-4 text-amber-600" /><span>wheat</span><span className="ml-auto text-slate-700">{inv['wheat'] ?? 0}</span></div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
      {gameState?.minigame && gameState.players[gameState.current_player]?.id !== 'bot' && (
        (gameState.minigame as any).type === 'rpg' ? (
          <BattleRPG minigame={gameState.minigame} onAttack={battleAttack} />
        ) : (gameState.minigame as any).type === 'hybrid' ? null : (
          // fallback: invader duel only when minigame has no type (legacy invader)
          <InvaderDuel onFinish={onFinishMinigame} />
        )
      )}
      <div className="max-w-6xl mx-auto">
        {/* Game Clear -> Next Stage prompt */}
        {showNextStagePrompt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-xl shadow-2xl w-[520px] max-w-[92vw] p-6 text-center space-y-4">
              <div className="text-2xl font-bold">ゲームクリア！</div>
              {gameState?.winner && (
                <div className="text-sm text-gray-600">勝者: {gameState.winner}</div>
              )}
              {gameState?.final_assets && (
                <div className="text-xs text-gray-500">集計完了。次のステージで再挑戦しよう！</div>
              )}
              <Button onClick={goToNextStage} className="w-full bg-green-600 hover:bg-green-700">次のステージへ（3D・40マス）</Button>
            </div>
          </div>
        )}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-800 mb-2">Leko</h1>
          <div className="flex justify-center items-center gap-4 text-lg">
            <span className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              {currentPlayer.coins} コイン
            </span>
            <span>収穫数: {currentPlayer.crops_harvested}</span>
            <span>ターン: {gameState.turn}</span>
          </div>
        </div>

        <EventLog events={eventMessages} turn={gameState.turn} />

        {/* Stage 2: embedded 3D sugoroku scene */}
        {(gameState?.board?.length ?? 20) === 40 && (
          <div className="mb-6">
            <div className="w-full h-[520px] rounded-xl overflow-hidden shadow-lg bg-slate-900/30">
              <Board3D
                players={gameState.players.map((p, idx) => ({ id: p.id, position: (displayPositions ? displayPositions[idx] : p.position) }))}
                tiles={40}
                squares={gameState.board as any}
                className="w-full h-[520px]"
              />
            </div>
          </div>
        )}

        {(gameState?.board?.length ?? 20) !== 40 && (
        <div className={`grid ${ (gameState?.board?.length ?? 20) >= 40 ? 'grid-cols-8' : (gameState?.board?.length ?? 20) >= 20 ? 'grid-cols-10' : 'grid-cols-6' } gap-2 mb-6 p-4 bg-white rounded-lg shadow-lg`}>
          {gameState.board.map((square, index) => (
            <div
              key={square.id}
              className={`relative aspect-square border-2 rounded-lg p-2 flex flex-col items-center justify-center 
                ${square.crop ? 'bg-green-50' : 'bg-white'}
                ${square.is_story ? 'ring-2 ring-offset-1 ring-pink-300' : ''}
                ${square.owner ? ((gameState.players.find(p => p.id === square.owner)?.id === 'bot')
                  ? 'border-red-300 ring-2 ring-offset-1 ring-red-300'
                  : 'border-blue-300 ring-2 ring-offset-1 ring-blue-300') : 'border-gray-300'}`}
            >
              <div className="text-xs font-bold mb-1">
                {index}
                {square.is_battle && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-rose-100 text-rose-700">戦</span>}
                {square.is_market && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700">株</span>}
                {square.is_farm && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">農</span>}
                {square.is_estate && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">不</span>}
                {square.building_owner && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-indigo-600 text-white">建</span>}
              </div>
              {square.is_story && (
                <div className="absolute top-1 right-1">
                  <span className={`text-[10px] px-1 py-0.5 rounded ${getStoryBadgeColor(square.story_color)}`}>
                    {square.story_label ?? '物'}
                  </span>
                </div>
              )}
              {gameState.players.map((player, idx) => {
                const pos = displayPositions ? displayPositions[idx] : player.position
                return pos === index && (
                  <div
                    key={player.id}
                    className={`absolute -top-2 ${idx === 0 ? '-left-2 bg-blue-500' : '-right-2 bg-red-500'} w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold`}
                  >
                    {idx === 0 ? 'P1' : 'B'}
                  </div>
                )
              })}
              {square.crop && (
                <div className="flex flex-col items-center">
                  {getCropIcon(square.crop.type)}
                  <Badge className={`text-xs mt-1 ${getCropStageColor(square.crop.stage)}`}>
                    {square.crop.stage}
                  </Badge>
                  {/* Owner text removed in favor of color-coding */}
                </div>
              )}
            </div>
          ))}
        </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>サイコロ</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {gameState.dice_value && (
                <div className="flex items-center justify-center">
                  {getDiceIcon(gameState.dice_value)}
                  <span className="ml-2 text-xl font-bold">{gameState.dice_value}</span>
                </div>
              )}
              <Button onClick={rollDice} disabled={isRolling || (gameState?.awaiting_action ?? false)} className="w-full bg-blue-600 hover:bg-blue-700">
                {isRolling ? 'サイコロを振っています…' : 'サイコロを振る'}
              </Button>
              <Button onClick={endTurn} disabled={!(gameState?.awaiting_action ?? false)} className="w-full" variant="outline">
                ターンを終える
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>作物を植える</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                {(['carrot', 'tomato', 'corn', 'wheat'] as const).map((crop) => (
                  <Button
                    key={crop}
                    variant={selectedCrop === crop ? 'default' : 'outline'}
                    onClick={() => setSelectedCrop(crop)}
                    className="flex items-center gap-2"
                  >
                    {getCropIcon(crop)}
                    {crop}
                  </Button>
                ))}
              </div>
              <Button onClick={plantCrop} disabled={!!currentSquare.crop || currentPlayer.coins < 20 || currentPlayer.position === 0 || currentSquare.is_market || currentSquare.is_farm || currentSquare.is_estate || (currentSquare as any).is_battle} className="w-full bg-green-600 hover:bg-green-700">
                植える（20コイン）
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>現在のマス</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-bold mb-2">マス {currentPlayer.position}</div>
                {currentSquare.crop ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      {getCropIcon(currentSquare.crop.type)}
                      <span className="capitalize">{currentSquare.crop.type}</span>
                    </div>
                    <Badge className={getCropStageColor(currentSquare.crop.stage)}>
                      {currentSquare.crop.stage}
                    </Badge>
                    {currentSquare.crop.stage === 'ready' && currentSquare.owner === currentPlayer.id && (
                      <Button onClick={harvestCrop} className="w-full bg-yellow-600 hover:bg-yellow-700">収穫する</Button>
                    )}
                  </div>
                ) : (
                  <div className="text-gray-500">空のマス</div>
                )}
              </div>

              {/* 5: 株式取引所 */}
              {currentSquare.is_market && (
                <div className="space-y-2">
                  <div className="text-center font-semibold">株取引所</div>
                  <div className="text-center text-sm">
                    価格: {gameState.stock_price ?? 100}（{(gameState.last_stock_change ?? 0) >= 0 ? '+' : ''}{gameState.last_stock_change ?? 0}%）
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 [&>button]:h-8 [&>button]:px-2 [&>button]:text-xs">
                    <Button onClick={() => buyStock(1)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || (gameState.stock_price ?? 100) > currentPlayer.coins} variant="outline">買う（1）</Button>
                    <Button onClick={() => buyStock(5)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || ((gameState.stock_price ?? 100) * 5) > currentPlayer.coins} variant="outline">買う（5）</Button>
                    <Button onClick={() => sellStock(1)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || (currentPlayer.stocks_shares ?? 0) < 1} variant="outline">売る（1）</Button>
                    <Button onClick={() => sellStock(currentPlayer.stocks_shares ?? 0)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || (currentPlayer.stocks_shares ?? 0) < 1} variant="outline">全部売る</Button>
                  </div>
                  <div className="text-center text-xs text-gray-600">
                    保有株: {currentPlayer.stocks_shares ?? 0}／評価額 {(currentPlayer.stocks_shares ?? 0) * (gameState.stock_price ?? 100)}
                  </div>
                </div>
              )}

              {/* 10: 農場／バザー */}
              {currentSquare.is_farm && (
                <div className="space-y-2">
                  <div className="text-center font-semibold">農場／バザー</div>
                  {gameState.bazaar_offer_price ? (
                    <div className="text-center text-sm">バイヤーが{gameState.bazaar_offer_price}ゴールドで買い取ってくれるそうです。売りますか？</div>
                  ) : (
                    <div className="text-center text-xs text-gray-500">バイヤーはいません（自分のターン3回ごとに出現）</div>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {(['carrot','tomato','corn','wheat'] as const).map((k) => {
                      const owned = (currentPlayer.inventory ?? {})[k] ?? 0
                      return (
                        <div key={k} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm p-2 border rounded">
                          <div className="capitalize truncate">
                            {k}
                            <span className="ml-2 text-xs text-gray-500">所持: {owned}</span>
                          </div>
                          <div className="flex flex-wrap gap-2 sm:justify-end">
                            <Button size="sm" onClick={() => sellInventory(k, 1)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || owned < 1 || !gameState.bazaar_offer_price} variant="outline" className="px-2">
                              売る（1）
                            </Button>
                            <Button size="sm" onClick={() => sellInventory(k, owned)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || owned < 1 || !gameState.bazaar_offer_price} variant="outline" className="px-2">
                              全部売る
                            </Button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* 15: 不動産 */}
              {currentSquare.is_estate && (
                <div className="space-y-2">
                  <div className="text-center font-semibold">不動産</div>
                  <div className="text-xs text-center text-gray-600">イベントマス以外に建設できます（500コイン）</div>
                  <div className="flex items-center gap-2">
                    <label className="text-xs text-gray-600">建設マスID</label>
                    <input type="number" min={0} max={Math.max(0, (gameState?.board?.length ?? 1) - 1)} value={estateTarget} onChange={(e) => setEstateTarget(Math.max(0, Math.min(Math.max(0, (gameState?.board?.length ?? 1) - 1), Number(e.target.value) || 0)))} className="w-20 px-2 py-1 border rounded" />
                    <Button onClick={() => buildEstate(estateTarget)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || currentPlayer.coins < 500} variant="outline">建設（500）</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App





