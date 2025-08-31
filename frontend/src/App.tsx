import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Sprout, Wheat, Carrot, Apple, Coins } from 'lucide-react'
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
  // special tiles
  is_market?: boolean
  is_farm?: boolean
  is_estate?: boolean
  building_owner?: string
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
  // market / bazaar
  stock_price?: number
  last_stock_change?: number
  crop_prices?: Record<string, number>
  crop_changes?: Record<string, number>
  bazaar_offer_price?: number
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

  const createGame = async () => {
    if (!playerName.trim()) return
    try {
      const response = await fetch(`${API_BASE}/game/create?player_name=${encodeURIComponent(playerName)}`, { method: 'POST' })
      const data = await response.json()
      setGameId(data.game_id)
      setGameState(data.game_state)
      setEventMessages([])
    } catch (e) {
      console.error('Failed to create game:', e)
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

  const rollDice = async () => {
    if (!gameId || isRolling) return
    setIsRolling(true)
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/roll-dice`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
      setEventMessages(data.events || [])
    } catch (e) {
      console.error('Failed to roll dice:', e)
    } finally {
      setIsRolling(false)
    }
  }

  const endTurn = async () => {
    if (!gameId) return
    try {
      const res = await fetch(`${API_BASE}/game/${gameId}/end-turn`, { method: 'POST' })
      const data = await res.json()
      setGameState(data.game_state)
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

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold text-green-800">🎲 Sugoroku Farm 🌱</CardTitle>
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
            <Button onClick={createGame} className="w-full bg-green-600 hover:bg-green-700">ゲーム開始</Button>
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
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-green-800 mb-2">🎲 Sugoroku Farm 🌱</h1>
          <div className="flex justify-center items-center gap-4 text-lg">
            <span className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-yellow-500" />
              {currentPlayer.coins} コイン
            </span>
            <span>収穫数: {currentPlayer.crops_harvested}</span>
            <span>ターン: {gameState.turn}</span>
          </div>
        </div>

        <div className="mb-4 text-center space-y-1">
          {eventMessages.map((msg, idx) => (
            <div key={idx} className="text-sm text-gray-700">{msg}</div>
          ))}
        </div>

        <div className="grid grid-cols-10 gap-2 mb-6 p-4 bg-white rounded-lg shadow-lg">
          {gameState.board.map((square, index) => (
            <div
              key={square.id}
              className={`
                relative aspect-square border-2 rounded-lg p-2 flex flex-col items-center justify-center
                border-gray-300 ${square.crop ? 'bg-green-50' : 'bg-white'}
              `}
            >
              <div className="text-xs font-bold mb-1">
                {index}
                {square.is_market && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-purple-100 text-purple-700">株</span>}
                {square.is_farm && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-amber-100 text-amber-700">農</span>}
                {square.is_estate && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-indigo-100 text-indigo-700">不</span>}
                {square.building_owner && <span className="ml-1 text-[10px] px-1 py-0.5 rounded bg-indigo-600 text-white">建</span>}
              </div>
              {gameState.players.map((player, idx) => (
                player.position === index && (
                  <div
                    key={player.id}
                    className={`absolute -top-2 ${idx === 0 ? '-left-2 bg-blue-500' : '-right-2 bg-red-500'} w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold`}
                  >
                    {idx === 0 ? 'P1' : 'B'}
                  </div>
                )
              ))}
              {square.crop && (
                <div className="flex flex-col items-center">
                  {getCropIcon(square.crop.type)}
                  <Badge className={`text-xs mt-1 ${getCropStageColor(square.crop.stage)}`}>
                    {square.crop.stage}
                  </Badge>
                </div>
              )}
            </div>
          ))}
        </div>

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
              <Button onClick={plantCrop} disabled={!!currentSquare.crop || currentPlayer.coins < 20} className="w-full bg-green-600 hover:bg-green-700">
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
                  <div className="grid grid-cols-2 gap-2">
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
                  <div className="grid grid-cols-2 gap-2">
                    {(['carrot','tomato','corn','wheat'] as const).map((k) => {
                      const owned = (currentPlayer.inventory ?? {})[k] ?? 0
                      return (
                        <div key={k} className="flex items-center justify-between text-sm">
                          <div className="capitalize">{k} <span className="ml-2 text-xs text-gray-500">所持: {owned}</span></div>
                          <div className="flex gap-2">
                            <Button onClick={() => sellInventory(k, 1)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || owned < 1 || !gameState.bazaar_offer_price} variant="outline">売る（1）</Button>
                            <Button onClick={() => sellInventory(k, owned)} disabled={!gameState.awaiting_action || currentPlayer.id === 'bot' || owned < 1 || !gameState.bazaar_offer_price} variant="outline">全部売る</Button>
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
                    <input type="number" min={0} max={19} value={estateTarget} onChange={(e) => setEstateTarget(Math.max(0, Math.min(19, Number(e.target.value) || 0)))} className="w-20 px-2 py-1 border rounded" />
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

