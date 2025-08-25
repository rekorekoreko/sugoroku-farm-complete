import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, Sprout, Wheat, Carrot, Apple, Coins } from 'lucide-react'
import './App.css'

interface Crop {
  type: 'carrot' | 'tomato' | 'corn' | 'wheat'
  stage: 'planted' | 'growing' | 'ready'
  planted_turn: number
  growth_time: number
}

interface Square {
  id: number
  crop?: Crop
  owner?: string
  is_stock_exchange?: boolean
}

interface Player {
  id: string
  name: string
  position: number
  coins: number
  crops_harvested: number
  stocks?: Record<string, number>
}

interface GameState {
  players: Player[]
  current_player: number
  board: Square[]
  turn: number
  dice_value?: number
  stocks: Record<string, number>
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function App() {
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [isRolling, setIsRolling] = useState(false)
  const [selectedCrop, setSelectedCrop] = useState<'carrot' | 'tomato' | 'corn' | 'wheat'>('carrot')
  const [eventMessages, setEventMessages] = useState<string[]>([])
  const [showStocks, setShowStocks] = useState(false)
  const [displayedDice, setDisplayedDice] = useState<number | null>(null)

  const createGame = async () => {
    if (!playerName.trim()) return
    
    try {
      const response = await fetch(`${API_BASE}/game/create?player_name=${encodeURIComponent(playerName)}`, {
        method: 'POST'
      })
      const data = await response.json()
      setGameId(data.game_id)
      setGameState(data.game_state)
      setEventMessages([])
    } catch (error) {
      console.error('Failed to create game:', error)
    }
  }

  const rollDice = async () => {
    if (!gameId || isRolling) return

    setIsRolling(true)
    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/roll-dice`, {
        method: 'POST'
      })
      const data = await response.json()
      setEventMessages(data.events || [])

      const interval = setInterval(() => {
        setDisplayedDice(Math.floor(Math.random() * 6) + 1)
      }, 100)
      await new Promise((res) => setTimeout(res, 1000))
      clearInterval(interval)

      setDisplayedDice(data.dice_value)
      setGameState(data.game_state)

      const nextPlayer = data.game_state.players[data.game_state.current_player]
      if (nextPlayer.id === 'bot') {
        setTimeout(() => rollDice(), 1000)
      }
    } catch (error) {
      console.error('Failed to roll dice:', error)
    } finally {
      setIsRolling(false)
    }
  }

  const plantCrop = async () => {
    if (!gameId) return
    
    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/plant-crop?crop_type=${selectedCrop}`, {
        method: 'POST'
      })
      const data = await response.json()
      setGameState(data.game_state)
    } catch (error) {
      console.error('Failed to plant crop:', error)
    }
  }

  const harvestCrop = async () => {
    if (!gameId) return
    
    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/harvest-crop`, {
        method: 'POST'
      })
      const data = await response.json()
      setGameState(data.game_state)
    } catch (error) {
      console.error('Failed to harvest crop:', error)
    }
  }

  const buyStock = async (stock: string) => {
    if (!gameId) return
    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/buy-stock?stock_name=${stock}`, {
        method: 'POST'
      })
      const data = await response.json()
      setGameState(data.game_state)
    } catch (error) {
      console.error('Failed to buy stock:', error)
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

  const getCropStageColor = (stage: string, owner?: string) => {
    const ownerBorder = owner === 'player1' ? 'border-blue-500' : owner === 'bot' ? 'border-red-500' : 'border-gray-300'
    switch (stage) {
      case 'planted':
        return `bg-gray-300 text-gray-800 ${ownerBorder}`
      case 'growing':
        return `bg-green-500 text-white ${ownerBorder}`
      case 'ready':
        return `bg-yellow-500 text-white ${ownerBorder}`
      default:
        return `bg-gray-200 text-gray-800 ${ownerBorder}`
    }
  }

  if (!gameId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-100 to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-center text-2xl font-bold text-green-800">
              🎲 Sugoroku Farm 🌱
            </CardTitle>
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
            <Button onClick={createGame} className="w-full bg-green-600 hover:bg-green-700">
              ゲーム開始
            </Button>
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

        <div className="mb-4 text-center">
          <Button onClick={() => setShowStocks(!showStocks)} className="mb-2">
            {showStocks ? '株価ボードを閉じる' : '株価ボードを見る'}
          </Button>
          {showStocks && (
            <Card className="max-w-md mx-auto">
              <CardHeader>
                <CardTitle>株価ボード</CardTitle>
              </CardHeader>
              <CardContent>
                {Object.entries(gameState.stocks).map(([name, price]) => (
                  <div key={name} className="flex justify-between mb-2">
                    <span>{name}</span>
                    <span>
                      {price} コイン (保有: {currentPlayer.stocks?.[name] || 0})
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="grid grid-cols-10 gap-2 mb-6 p-4 bg-white rounded-lg shadow-lg">
          {gameState.board.map((square, index) => (
            <div
              key={square.id}
              className={`
                relative aspect-square border-2 rounded-lg p-2 flex flex-col items-center justify-center
                ${square.owner === 'player1' ? 'border-blue-500' : square.owner === 'bot' ? 'border-red-500' : 'border-gray-300'}
                ${square.is_stock_exchange ? 'bg-purple-50' : square.crop ? 'bg-green-50' : 'bg-white'}
              `}
            >
              <div className="text-xs font-bold mb-1">{index}</div>
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
              {square.is_stock_exchange && (
                <span className="text-xs text-purple-700">株</span>
              )}
              {square.crop && (
                <div className="flex flex-col items-center">
                  {getCropIcon(square.crop.type)}
                  <Badge className={`text-xs mt-1 ${getCropStageColor(square.crop.stage, square.owner)}`}>
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
              {displayedDice && (
                <div className="flex items-center justify-center">
                  {getDiceIcon(displayedDice)}
                  <span className="ml-2 text-xl font-bold">{displayedDice}</span>
                </div>
              )}
              <Button 
                onClick={rollDice} 
                disabled={isRolling}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isRolling ? 'サイコロを振っています...' : 'サイコロを振る'}
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
              <Button 
                onClick={plantCrop}
                disabled={!!currentSquare.crop || currentPlayer.coins < 20}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                植える (20コイン)
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
                    <Badge className={getCropStageColor(currentSquare.crop.stage, currentSquare.owner)}>
                      {currentSquare.crop.stage}
                    </Badge>
                    {currentSquare.crop.stage === 'ready' && currentSquare.owner === currentPlayer.id && (
                      <Button
                        onClick={harvestCrop}
                        className="w-full bg-yellow-600 hover:bg-yellow-700"
                      >
                        収穫する
                      </Button>
                    )}
                  </div>
                ) : currentSquare.is_stock_exchange ? (
                  <div className="space-y-2">
                    <div className="text-purple-700 mb-2">株取引所</div>
                    {Object.entries(gameState.stocks).map(([name, price]) => (
                      <Button
                        key={name}
                        onClick={() => buyStock(name)}
                        disabled={currentPlayer.coins < price}
                        className="w-full"
                      >
                        {name} を買う ({price}コイン)
                      </Button>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500">空のマス</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default App
