import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
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
  is_farm: boolean
  farm_owner?: string
  is_crypto_exchange: boolean
}

interface Player {
  id: string
  name: string
  position: number
  coins: number
  crops_harvested: number
  has_farm: boolean
  reko_coin: number
}

interface GameState {
  players: Player[]
  current_player: number
  board: Square[]
  turn: number
  dice_value?: number
  crypto_price: number
  crypto_history: number[]
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

function App() {
  const [gameId, setGameId] = useState<string | null>(null)
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [playerName, setPlayerName] = useState('')
  const [isRolling, setIsRolling] = useState(false)
  const [selectedCrop, setSelectedCrop] = useState<'carrot' | 'tomato' | 'corn' | 'wheat'>('carrot')
  const [eventMessages, setEventMessages] = useState<string[]>([])

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
      setGameState(data.game_state)
      setEventMessages(data.events || [])
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

  const buyFarm = async () => {
    if (!gameId) return

    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/buy-farm`, {
        method: 'POST'
      })
      const data = await response.json()
      setGameState(data.game_state)
      setEventMessages([data.message])
    } catch (error) {
      console.error('Failed to buy farm:', error)
    }
  }

  const buyReko = async () => {
    if (!gameId) return
    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/buy-reko`, { method: 'POST' })
      const data = await response.json()
      setGameState(data.game_state)
      setEventMessages([data.message])
    } catch (error) {
      console.error('Failed to buy RekoCoin:', error)
    }
  }

  const sellReko = async () => {
    if (!gameId) return
    try {
      const response = await fetch(`${API_BASE}/game/${gameId}/sell-reko`, { method: 'POST' })
      const data = await response.json()
      setGameState(data.game_state)
      setEventMessages([data.message])
    } catch (error) {
      console.error('Failed to sell RekoCoin:', error)
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
      case 'planted': return 'bg-brown-200 text-brown-800'
      case 'growing': return 'bg-green-200 text-green-800'
      case 'ready': return 'bg-yellow-200 text-yellow-800'
      default: return 'bg-gray-200 text-gray-800'
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
  const chartData = gameState.crypto_history.map((price, idx) => ({ turn: idx, price }))

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
            <span>牧場所有: {currentPlayer.has_farm ? 'はい' : 'いいえ'}</span>
            <span>Reko: {currentPlayer.reko_coin}</span>
            <span>価格: {gameState.crypto_price}</span>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">価格推移</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>RekoCoin 価格</DialogTitle>
                </DialogHeader>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <XAxis dataKey="turn" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="price" stroke="#8884d8" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </DialogContent>
            </Dialog>
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
                border-gray-300
                ${square.is_farm ? 'bg-yellow-50' : square.is_crypto_exchange ? 'bg-blue-50' : square.crop ? 'bg-green-50' : 'bg-white'}
              `}
            >
              <div className="text-xs font-bold mb-1">{index}</div>
              {square.is_farm && (
                <div className="text-xs text-green-700 mb-1">牧場</div>
              )}
              {square.is_crypto_exchange && (
                <div className="text-xs text-blue-700 mb-1">仮想通貨</div>
              )}
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
                disabled={!!currentSquare.crop || currentPlayer.coins < 20 || currentSquare.is_farm || currentSquare.is_crypto_exchange}
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
                {currentSquare.is_farm ? (
                  <div className="space-y-2">
                    <div className="text-lg font-bold">牧場</div>
                    {currentSquare.farm_owner ? (
                      <div className="text-sm text-gray-700">
                        所有者: {currentSquare.farm_owner === 'player1' ? 'あなた' : 'Bot'}
                      </div>
                    ) : (
                      <div className="text-sm text-gray-700">未購入</div>
                    )}
                    {!currentPlayer.has_farm && !currentSquare.farm_owner && (
                      <Button
                        onClick={buyFarm}
                        disabled={currentPlayer.coins < 100}
                        className="w-full bg-purple-600 hover:bg-purple-700"
                      >
                        牧場を買う (100コイン)
                      </Button>
                    )}
                  </div>
                ) : currentSquare.is_crypto_exchange ? (
                  <div className="space-y-2">
                    <div className="text-lg font-bold">仮想通貨取引所</div>
                    <div className="text-sm">価格: {gameState.crypto_price} コイン</div>
                    <div className="flex gap-2">
                      <Button
                        onClick={buyReko}
                        disabled={currentPlayer.coins < gameState.crypto_price}
                        className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                      >
                        買う
                      </Button>
                      <Button
                        onClick={sellReko}
                        disabled={currentPlayer.reko_coin < 1}
                        className="flex-1 bg-pink-600 hover:bg-pink-700"
                      >
                        売る
                      </Button>
                    </div>
                  </div>
                ) : currentSquare.crop ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-center gap-2">
                      {getCropIcon(currentSquare.crop.type)}
                      <span className="capitalize">{currentSquare.crop.type}</span>
                    </div>
                    <Badge className={getCropStageColor(currentSquare.crop.stage)}>
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
