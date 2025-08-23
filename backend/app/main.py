from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import random
from typing import Dict, List, Optional
from enum import Enum

app = FastAPI()

# Disable CORS. Do not remove this for full-stack development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

class CropType(str, Enum):
    CARROT = "carrot"
    TOMATO = "tomato"
    CORN = "corn"
    WHEAT = "wheat"

class CropStage(str, Enum):
    PLANTED = "planted"
    GROWING = "growing"
    READY = "ready"

class Crop(BaseModel):
    type: CropType
    stage: CropStage
    planted_turn: int
    growth_time: int

class Square(BaseModel):
    id: int
    crop: Optional[Crop] = None
    owner: Optional[str] = None

class Player(BaseModel):
    id: str
    name: str
    position: int
    coins: int
    crops_harvested: int

class GameState(BaseModel):
    players: List[Player]
    current_player: int
    board: List[Square]
    turn: int
    dice_value: Optional[int] = None

games: Dict[str, GameState] = {}

def create_board() -> List[Square]:
    return [Square(id=i) for i in range(20)]

def get_crop_growth_time(crop_type: CropType) -> int:
    growth_times = {
        CropType.CARROT: 2,
        CropType.TOMATO: 3,
        CropType.CORN: 4,
        CropType.WHEAT: 3
    }
    return growth_times[crop_type]

def get_crop_value(crop_type: CropType) -> int:
    values = {
        CropType.CARROT: 10,
        CropType.TOMATO: 15,
        CropType.CORN: 20,
        CropType.WHEAT: 12
    }
    return values[crop_type]

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.post("/game/create")
async def create_game(player_name: str):
    game_id = f"game_{random.randint(1000, 9999)}"
    player = Player(id="player1", name=player_name, position=0, coins=100, crops_harvested=0)
    
    game_state = GameState(
        players=[player],
        current_player=0,
        board=create_board(),
        turn=1
    )
    
    games[game_id] = game_state
    return {"game_id": game_id, "game_state": game_state}

@app.get("/game/{game_id}")
async def get_game(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    return games[game_id]

@app.post("/game/{game_id}/roll-dice")
async def roll_dice(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    dice_value = random.randint(1, 6)
    game.dice_value = dice_value
    
    current_player = game.players[game.current_player]
    new_position = (current_player.position + dice_value) % len(game.board)
    current_player.position = new_position
    
    for square in game.board:
        if square.crop and square.crop.stage != CropStage.READY:
            turns_since_planted = game.turn - square.crop.planted_turn
            if turns_since_planted >= square.crop.growth_time:
                square.crop.stage = CropStage.READY
            elif turns_since_planted >= square.crop.growth_time // 2:
                square.crop.stage = CropStage.GROWING
    
    game.turn += 1
    return {"dice_value": dice_value, "new_position": new_position, "game_state": game}

@app.post("/game/{game_id}/plant-crop")
async def plant_crop(game_id: str, crop_type: CropType):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    current_player = game.players[game.current_player]
    current_square = game.board[current_player.position]
    
    if current_square.crop is not None:
        raise HTTPException(status_code=400, detail="Square already has a crop")
    
    crop_cost = 20
    if current_player.coins < crop_cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    
    current_player.coins -= crop_cost
    current_square.crop = Crop(
        type=crop_type,
        stage=CropStage.PLANTED,
        planted_turn=game.turn,
        growth_time=get_crop_growth_time(crop_type)
    )
    current_square.owner = current_player.id
    
    return {"message": "Crop planted successfully", "game_state": game}

@app.post("/game/{game_id}/harvest-crop")
async def harvest_crop(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    
    game = games[game_id]
    current_player = game.players[game.current_player]
    current_square = game.board[current_player.position]
    
    if current_square.crop is None:
        raise HTTPException(status_code=400, detail="No crop to harvest")
    
    if current_square.crop.stage != CropStage.READY:
        raise HTTPException(status_code=400, detail="Crop is not ready for harvest")
    
    if current_square.owner != current_player.id:
        raise HTTPException(status_code=400, detail="You don't own this crop")
    
    crop_value = get_crop_value(current_square.crop.type)
    current_player.coins += crop_value
    current_player.crops_harvested += 1
    
    current_square.crop = None
    current_square.owner = None
    
    return {"message": "Crop harvested successfully", "coins_earned": crop_value, "game_state": game}
