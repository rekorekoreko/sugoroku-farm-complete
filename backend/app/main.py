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
    # Whether this square represents the special farm tile
    is_farm: bool = False
    # ID of the player who purchased the farm
    farm_owner: Optional[str] = None

class Player(BaseModel):
    id: str
    name: str
    position: int
    coins: int
    crops_harvested: int
    # Indicates whether the player owns the farm
    has_farm: bool = False

class GameState(BaseModel):
    players: List[Player]
    current_player: int
    board: List[Square]
    turn: int
    dice_value: Optional[int] = None

games: Dict[str, GameState] = {}

# Position on the board that represents the farm
FARM_POS = 5

def create_board() -> List[Square]:
    """Create the game board with a single farm tile."""
    return [Square(id=i, is_farm=(i == FARM_POS)) for i in range(20)]

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


def trigger_random_event(player: Player) -> str:
    """Trigger a random farm-related event.

    Players without a farm receive a neutral message with no coin change.
    """
    if not player.has_farm:
        return f"{player.name}: 牧場を持っていないので特に何も起こらなかった"

    events = [
        ("牧場経営が順調！利益が出た", 30),
        ("家畜の世話で出費がかさんだ", -20),
        ("特に何も起こらなかった", 0),
    ]
    message, coin_change = random.choice(events)
    player.coins += coin_change
    if coin_change > 0:
        return f"{player.name}: {message} (+{coin_change}コイン)"
    if coin_change < 0:
        return f"{player.name}: {message} ({coin_change}コイン)"
    return f"{player.name}: {message}"

@app.get("/healthz")
async def healthz():
    return {"status": "ok"}

@app.post("/game/create")
async def create_game(player_name: str):
    game_id = f"game_{random.randint(1000, 9999)}"
    player = Player(id="player1", name=player_name, position=0, coins=100, crops_harvested=0)
    bot = Player(id="bot", name="Bot", position=0, coins=100, crops_harvested=0)

    game_state = GameState(
        players=[player, bot],
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
    events: List[str] = []
    can_buy_farm = False

    for _ in range(len(game.players)):
        current_player = game.players[game.current_player]
        dice_value = random.randint(1, 6)
        if current_player.id != "bot":
            game.dice_value = dice_value

        new_position = (current_player.position + dice_value) % len(game.board)
        current_player.position = new_position
        current_square = game.board[current_player.position]

        if (
            current_square.is_farm
            and not current_player.has_farm
            and current_square.farm_owner is None
            and current_player.id != "bot"
        ):
            events.append("牧場に到着！100コインで購入できます")
            can_buy_farm = True

        for square in game.board:
            if square.crop and square.crop.stage != CropStage.READY:
                turns_since_planted = game.turn - square.crop.planted_turn
                if turns_since_planted >= square.crop.growth_time:
                    square.crop.stage = CropStage.READY
                elif turns_since_planted >= square.crop.growth_time // 2:
                    square.crop.stage = CropStage.GROWING

        event_msg = trigger_random_event(current_player)
        events.append(event_msg)

        if current_player.id == "bot":
            if (
                current_square.crop
                and current_square.crop.stage == CropStage.READY
                and current_square.owner == current_player.id
            ):
                value = get_crop_value(current_square.crop.type) * 2
                current_player.coins += value
                current_player.crops_harvested += 1
                events.append(f"{current_player.name}: 作物を収穫して{value}コインを得た")
                current_square.crop = None
                current_square.owner = None
            elif current_square.crop is None and current_player.coins >= 20:
                crop_type = random.choice(list(CropType))
                current_player.coins -= 20
                current_square.crop = Crop(
                    type=crop_type,
                    stage=CropStage.PLANTED,
                    planted_turn=game.turn,
                    growth_time=get_crop_growth_time(crop_type),
                )
                current_square.owner = current_player.id
                events.append(f"{current_player.name}: {crop_type.value}を植えた")

        game.turn += 1
        game.current_player = (game.current_player + 1) % len(game.players)

    return {
        "dice_value": game.dice_value,
        "game_state": game,
        "events": events,
        "can_buy_farm": can_buy_farm,
    }


@app.post("/game/{game_id}/buy-farm")
async def buy_farm(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")

    game = games[game_id]
    current_player = game.players[game.current_player]
    current_square = game.board[current_player.position]

    if not current_square.is_farm:
        raise HTTPException(status_code=400, detail="This square is not a farm")
    if current_player.has_farm:
        raise HTTPException(status_code=400, detail="Player already owns a farm")
    if current_square.farm_owner is not None:
        raise HTTPException(status_code=400, detail="Farm already owned")

    cost = 100
    if current_player.coins < cost:
        raise HTTPException(status_code=400, detail="Not enough coins")

    current_player.coins -= cost
    current_player.has_farm = True
    current_square.farm_owner = current_player.id

    return {"message": "Farm purchased successfully", "game_state": game}

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
    
    crop_value = get_crop_value(current_square.crop.type) * 2
    current_player.coins += crop_value
    current_player.crops_harvested += 1

    current_square.crop = None
    current_square.owner = None

    return {"message": "Crop harvested successfully", "coins_earned": crop_value, "game_state": game}
