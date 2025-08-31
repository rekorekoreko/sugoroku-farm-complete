from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Dict, List, Optional
from enum import Enum
import random

app = FastAPI()

# CORS for frontend dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class CropType(str, Enum):
    CARROT = "carrot"
    TOMATO = "tomato"
    CORN = "corn"
    WHEAT = "wheat"
    PUMPKIN = "pumpkin"


class CropStage(str, Enum):
    PLANTED = "planted"
    GROWING = "growing"
    READY = "ready"


class JobType(str, Enum):
    LAWYER = "lawyer"
    ISEKAI = "isekai"
    PROGRAMMER = "programmer"
    IDOL = "idol"


class Crop(BaseModel):
    type: CropType
    stage: CropStage
    planted_turn: int
    growth_time: int


class Square(BaseModel):
    id: int
    crop: Optional[Crop] = None
    owner: Optional[str] = None
<<<<<<< HEAD
    # Special tiles
    is_market: bool = False  # 5
    is_farm: bool = False    # 10
    is_estate: bool = False  # 15 (office)
    is_job: bool = False     # 19 (career change)
    # Buildings
    building_owner: Optional[str] = None

=======
    # Whether this square represents the special farm tile
    is_farm: bool = False
    # ID of the player who purchased the farm
    farm_owner: Optional[str] = None
>>>>>>> d55f9e8cd1c22b97b1b907b5a11807bdebbf7f43

class Player(BaseModel):
    id: str
    name: str
    position: int
    coins: int
    crops_harvested: int
<<<<<<< HEAD
    inventory: Dict[str, int] = {}
    stocks_shares: int = 0
    # Job world
    job_type: Optional[str] = None  # 'lawyer'|'isekai'|'programmer'|'idol'
    job_position: Optional[int] = None  # 0..20 while in job world

=======
    # Indicates whether the player owns the farm
    has_farm: bool = False
>>>>>>> d55f9e8cd1c22b97b1b907b5a11807bdebbf7f43

class GameState(BaseModel):
    players: List[Player]
    current_player: int
    board: List[Square]
    turn: int
    dice_value: Optional[int] = None
    awaiting_action: bool = False
    # Stock market
    stock_price: int = 80
    last_stock_change: int = 0
    # Crop market (for farm display)
    crop_prices: Dict[str, int] = {}
    crop_changes: Dict[str, int] = {}
    # Per-player turn counters
    turns_by_player: Dict[str, int] = {}
    # Bazaar (tile 10)
    bazaar_offer_price: Optional[int] = None
    bazaar_offer_turn: Optional[int] = None


games: Dict[str, GameState] = {}

<<<<<<< HEAD
=======

def create_board() -> List[Square]:
    """Create the game board with a single farm tile at a random position."""
    farm_index = random.randint(0, 19)
    return [Square(id=i, is_farm=(i == farm_index)) for i in range(20)]
>>>>>>> d55f9e8cd1c22b97b1b907b5a11807bdebbf7f43

def create_board() -> List[Square]:
    board = [Square(id=i) for i in range(20)]
    if len(board) > 5:
        board[5].is_market = True
    if len(board) > 10:
        board[10].is_farm = True
    if len(board) > 15:
        board[15].is_estate = True
    if len(board) > 19:
        board[19].is_job = True
    return board


def get_crop_growth_time(tp: CropType) -> int:
    return {
        CropType.CARROT: 2,
        CropType.TOMATO: 3,
        CropType.CORN: 4,
        CropType.WHEAT: 3,
        CropType.PUMPKIN: 4,
    }[tp]


def get_crop_value(tp: CropType) -> int:
    return {
        CropType.CARROT: 10,
        CropType.TOMATO: 15,
        CropType.CORN: 20,
        CropType.WHEAT: 12,
        CropType.PUMPKIN: 25,
    }[tp]


def trigger_random_event(player: Player) -> str:
<<<<<<< HEAD
    ev = [
        ("牧場経営が好調！利益が出た", 30),
=======
    """Trigger a random farm-related event.

    Players without a farm receive a neutral message with no coin change.
    """
    if not player.has_farm:
        return f"{player.name}: 牧場を持っていないので特に何も起こらなかった"

    events = [
        ("牧場経営が順調！利益が出た", 30),
>>>>>>> d55f9e8cd1c22b97b1b907b5a11807bdebbf7f43
        ("家畜の世話で出費がかさんだ", -20),
        ("特に何も起こらなかった", 0),
    ]
    msg, dc = random.choice(ev)
    player.coins += dc
    return f"{player.name}: {msg} ({'+' if dc>0 else ''}{dc}コイン)" if dc != 0 else f"{player.name}: {msg}"


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/game/create")
async def create_game(player_name: str):
    game_id = f"game_{random.randint(1000, 9999)}"
    player = Player(id="player1", name=player_name, position=0, coins=100, crops_harvested=0, inventory={}, stocks_shares=0)
    bot = Player(id="bot", name="Bot", position=0, coins=100, crops_harvested=0, inventory={}, stocks_shares=0)

    crop_prices = {k: random.randint(30, 100) for k in [
        CropType.CARROT.value,
        CropType.TOMATO.value,
        CropType.CORN.value,
        CropType.WHEAT.value,
        CropType.PUMPKIN.value,
    ]}

    game = GameState(
        players=[player, bot],
        current_player=0,
        board=create_board(),
        turn=1,
        awaiting_action=False,
        stock_price=80,
        last_stock_change=0,
        crop_prices=crop_prices,
        crop_changes={k: 0 for k in crop_prices.keys()},
        turns_by_player={},
        bazaar_offer_price=None,
        bazaar_offer_turn=None,
    )

    games[game_id] = game
    return {"game_id": game_id, "game_state": game}


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
    player_path: List[int] = []

<<<<<<< HEAD
    current_player = game.players[game.current_player]
    dice_value = random.randint(1, 6)
    if current_player.id != "bot":
        game.dice_value = dice_value

    # If in job world, move inside job board (0..20), else move on main board
    if current_player.job_type is not None and current_player.job_position is not None:
        # Job world movement
        new_job_pos = current_player.job_position + dice_value
        if new_job_pos >= 20:
            # Finish job loop and return to main board at 19
            current_player.job_type = None
            current_player.job_position = None
            current_player.position = 19
            events.append("転職ルートを一周して元の世界に戻ってきた")
        else:
            current_player.job_position = new_job_pos
            # Trigger a simple job event per step
            jt = current_player.job_type
            # simple deterministic effect based on pos
            effect = (new_job_pos % 5) * 10 - 10  # -10,0,10,20,30
            current_player.coins += effect
            events.append(f"{jt} のイベント[{new_job_pos}]：コイン {('+' if effect>=0 else '')}{effect}")
    else:
        # Move on main board
        new_position = (current_player.position + dice_value) % len(game.board)
=======
    for _ in range(len(game.players)):
        current_player = game.players[game.current_player]
        dice_value = random.randint(1, 6)
        start_pos = current_player.position
        if current_player.id != "bot":
            game.dice_value = dice_value
            player_path = [
                (start_pos + i) % len(game.board) for i in range(1, dice_value + 1)
            ]

        new_position = (start_pos + dice_value) % len(game.board)
>>>>>>> d55f9e8cd1c22b97b1b907b5a11807bdebbf7f43
        current_player.position = new_position
        current_square = game.board[current_player.position]

        if (
            current_square.is_farm
            and not current_player.has_farm
            and current_square.farm_owner is None
            and current_player.id != "bot"
        ):
            events.append("牧場に到着！100コインで契約できます")
            can_buy_farm = True

    # Crop growth (only relevant on main board)
    if current_player.job_type is None:
        for square in game.board:
            if square.crop and square.crop.stage != CropStage.READY:
                diff = game.turn - square.crop.planted_turn
                if diff >= square.crop.growth_time:
                    square.crop.stage = CropStage.READY
                elif diff >= square.crop.growth_time // 2:
                    square.crop.stage = CropStage.GROWING

    # Auto harvest only when stopping on a READY crop you own
    if current_player.job_type is None:
        current_square = game.board[current_player.position]
        if current_square.crop and current_square.crop.stage == CropStage.READY and current_square.owner == current_player.id:
            qty = random.randint(1, 5)
            key = current_square.crop.type.value
            current_player.inventory[key] = current_player.inventory.get(key, 0) + qty
            current_player.crops_harvested += qty
            events.append(f"{current_player.name}: {key} を{qty}個収穫（自動）")
            current_square.crop = None
            current_square.owner = None
        # Job tile offer
        if current_square.is_job and current_player.id != "bot":
            events.append("転職：lawyer / isekai / programmer / idol から選べます")
        elif current_square.is_job and current_player.id == "bot" and (current_player.job_type is None):
            bot_choice = random.choice([JobType.LAWYER.value, JobType.ISEKAI.value, JobType.PROGRAMMER.value, JobType.IDOL.value])
            current_player.job_type = bot_choice
            current_player.job_position = 0
            events.append(f"BOTが{bot_choice}に転職した！")

<<<<<<< HEAD
    # Stock price update (clamped 10-300)
    if current_player.job_type is None:
        old_price = game.stock_price
        delta = random.randint(-30, 30)
        new_price = max(10, min(300, old_price + delta))
        pct = int(round(((new_price - old_price) / old_price) * 100)) if old_price > 0 else 0
        game.stock_price = new_price
        game.last_stock_change = pct
        if pct != 0:
            events.append(f"株価が{old_price}→{new_price}（{'+' if pct>0 else ''}{pct}%）に変動")
=======
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
>>>>>>> d55f9e8cd1c22b97b1b907b5a11807bdebbf7f43

    # Random event
    events.append(trigger_random_event(current_player))

    # Minigame trigger on landing (both players). Human UI handles human case; bot auto-resolves
    if current_player.job_type is None:
        current_square = game.board[current_player.position]
        if current_square.crop and current_square.owner and current_square.owner != current_player.id:
            if current_player.id == "bot":
                # Auto-resolve: 50/50
                winner = random.choice([current_player.id, current_square.owner])
                if winner == current_player.id:
                    current_square.owner = current_player.id
                    events.append("BOTがミニゲームで勝利し、マスを奪取！")
                else:
                    # Defender reward
                    defender = next((p for p in game.players if p.id == current_square.owner), None)
                    if defender:
                        defender.coins += 30
                    events.append("防衛成功！所有者に+30コイン")
            else:
                # Human attack: frontend will show UI; just note event
                events.append("ミニゲーム発生！（プレイヤー対所有者）")

    # BOT planting & estate (only on main board)
    if current_player.id == "bot" and current_player.job_type is None:
        current_square = game.board[current_player.position]
        if (current_square.crop is None and not current_square.is_market and not current_square.is_estate and not current_square.is_farm
                and current_player.coins >= 20):
            tp = random.choice(list(CropType))
            current_player.coins -= 20
            current_square.crop = Crop(type=tp, stage=CropStage.PLANTED, planted_turn=game.turn, growth_time=get_crop_growth_time(tp))
            current_square.owner = current_player.id
            events.append(f"{current_player.name}: {tp.value}を植えた")
        if current_square.is_estate and current_player.coins >= 500:
            candidates = [s for s in game.board if not (s.is_market or s.is_farm or s.is_estate) and not s.building_owner]
            if candidates:
                target = random.choice(candidates)
                current_player.coins -= 500
                target.building_owner = current_player.id
                events.append(f"BOTがマス{target.id}に建物を建設（500コイン）")

    # Per-player turn count; building income and bazaar
    turns = game.turns_by_player.get(current_player.id, 0) + 1
    game.turns_by_player[current_player.id] = turns
    if turns % 3 == 0:
        bcnt = sum(1 for s in game.board if s.building_owner == current_player.id)
        if bcnt > 0:
            income = 50 * bcnt
            current_player.coins += income
            events.append(f"{current_player.name}: 建物の収益 +{income}コイン（{bcnt}棟）")
    if (current_player.job_type is None) and current_square.is_farm and turns % 3 == 0:
        game.bazaar_offer_price = random.randint(10, 300)
        game.bazaar_offer_turn = game.turn
        events.append(f"🧺 バイヤーが現れた！{game.bazaar_offer_price}ゴールドで買い取ってくれるそうです。売りますか？")
    else:
        game.bazaar_offer_price = None
        game.bazaar_offer_turn = None

    # Advance
    game.turn += 1
    if current_player.id == "bot":
        game.current_player = (game.current_player + 1) % len(game.players)
        game.awaiting_action = False
    else:
        game.awaiting_action = True

    return {
        "dice_value": game.dice_value,
        "path": player_path,
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

    # Disallow planting on event squares and when in job world
    if current_player.job_type is not None:
        raise HTTPException(status_code=400, detail="Cannot plant while in job world")
    if current_square.is_market or current_square.is_estate or current_square.is_farm or current_square.is_job:
        raise HTTPException(status_code=400, detail="Cannot plant on event square")
    if current_square.crop is not None:
        raise HTTPException(status_code=400, detail="Square already has a crop")
    if current_player.coins < 20:
        raise HTTPException(status_code=400, detail="Not enough coins")

    current_player.coins -= 20
    current_square.crop = Crop(
        type=crop_type,
        stage=CropStage.PLANTED,
        planted_turn=game.turn,
        growth_time=get_crop_growth_time(crop_type),
    )
    current_square.owner = current_player.id

    game.awaiting_action = False
    game.current_player = (game.current_player + 1) % len(game.players)
    return {"message": "Crop planted successfully", "game_state": game}


@app.post("/game/{game_id}/harvest-crop")
async def harvest_crop(game_id: str):
    # Optional: still allow manual harvest if UI triggers it (same as auto)
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    current_player = game.players[game.current_player]
    current_square = game.board[current_player.position]
    if not current_square.crop or current_square.owner != current_player.id or current_square.crop.stage != CropStage.READY:
        raise HTTPException(status_code=400, detail="Nothing to harvest here")
    qty = random.randint(1, 5)
    key = current_square.crop.type.value
    current_player.inventory[key] = current_player.inventory.get(key, 0) + qty
    current_player.crops_harvested += qty
    current_square.crop = None
    current_square.owner = None
    game.awaiting_action = False
    game.current_player = (game.current_player + 1) % len(game.players)
    return {"message": "Harvested", "harvested_qty": qty, "game_state": game}


@app.post("/game/{game_id}/buy-stock")
async def buy_stock(game_id: str, shares: int = 1):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    if shares <= 0:
        raise HTTPException(status_code=400, detail="Shares must be positive")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if p.job_type is not None:
        raise HTTPException(status_code=400, detail="Cannot trade while in job world")
    if not game.awaiting_action or not sq.is_market:
        raise HTTPException(status_code=400, detail="Not at market or not your action phase")
    cost = game.stock_price * shares
    if p.coins < cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    p.coins -= cost
    p.stocks_shares += shares
    return {"message": "Stock purchased", "game_state": game}


@app.post("/game/{game_id}/sell-stock")
async def sell_stock(game_id: str, shares: int = 1):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    if shares <= 0:
        raise HTTPException(status_code=400, detail="Shares must be positive")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if p.job_type is not None:
        raise HTTPException(status_code=400, detail="Cannot trade while in job world")
    if not game.awaiting_action or not sq.is_market:
        raise HTTPException(status_code=400, detail="Not at market or not your action phase")
    if p.stocks_shares < shares:
        raise HTTPException(status_code=400, detail="Not enough shares")
    p.stocks_shares -= shares
    p.coins += game.stock_price * shares
    return {"message": "Stock sold", "game_state": game}


@app.post("/game/{game_id}/sell-inventory")
async def sell_inventory(game_id: str, crop_type: str, qty: int):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if p.job_type is not None:
        raise HTTPException(status_code=400, detail="Cannot sell while in job world")
    if not game.awaiting_action or not sq.is_farm:
        raise HTTPException(status_code=400, detail="Not at farm or not your action phase")
    if not game.bazaar_offer_price:
        raise HTTPException(status_code=400, detail="No buyer at bazaar now")
    key = crop_type
    have = p.inventory.get(key, 0)
    if have <= 0:
        raise HTTPException(status_code=400, detail="No inventory for this crop")
    sell_n = min(have, qty)
    unit = game.bazaar_offer_price
    coins = unit * sell_n
    p.inventory[key] = have - sell_n
    p.coins += coins
    return {"message": "Sold", "sold_qty": sell_n, "unit_price": unit, "coins_earned": coins, "game_state": game}


@app.post("/game/{game_id}/end-turn")
async def end_turn(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    game.awaiting_action = False
    game.bazaar_offer_price = None
    game.bazaar_offer_turn = None
    game.current_player = (game.current_player + 1) % len(game.players)
    return {"message": "Turn ended", "game_state": game}


@app.post("/game/{game_id}/minigame/resolve")
async def minigame_resolve(game_id: str, winner: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    # Reward winner +30
    ids = {p.id for p in game.players}
    if winner not in ids:
        raise HTTPException(status_code=400, detail="Invalid winner")
    for p in game.players:
        if p.id == winner:
            p.coins += 30
            break
    return {"message": "Minigame resolved", "game_state": game}


@app.post("/game/{game_id}/job/enter")
async def job_enter(game_id: str, job_type: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if not game.awaiting_action:
        raise HTTPException(status_code=400, detail="Not your action phase")
    if p.job_type is not None:
        raise HTTPException(status_code=400, detail="Already in job world")
    if not getattr(sq, 'is_job', False):
        raise HTTPException(status_code=400, detail="Not at job tile")
    job_type = job_type.lower()
    valid = [JobType.LAWYER.value, JobType.ISEKAI.value, JobType.PROGRAMMER.value, JobType.IDOL.value]
    if job_type not in valid:
        raise HTTPException(status_code=400, detail="Invalid job type")
    p.job_type = job_type
    p.job_position = 0
    # Entering job world does not end turn; player may end turn normally
    return {"message": f"{job_type}に転職しました", "game_state": game}


@app.post("/game/{game_id}/minigame/resolve2")
async def minigame_resolve2(game_id: str, winner: str, square_id: int, attacker: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    players_by_id = {p.id: p for p in game.players}
    if winner not in players_by_id or attacker not in players_by_id:
        raise HTTPException(status_code=400, detail="Invalid player id")
    if not (0 <= square_id < len(game.board)):
        raise HTTPException(status_code=400, detail="Invalid square")
    sq = game.board[square_id]
    defender_id = sq.owner if sq.owner and sq.owner != attacker else next((p.id for p in game.players if p.id != attacker), None)
    if winner == defender_id:
        players_by_id[defender_id].coins += 30
        message = "防衛成功 +30コイン"
    elif winner == attacker:
        sq.owner = attacker
        message = "侵攻成功: マスを奪取！"
    else:
        message = "ミニゲーム結果を反映しました"
    return {"message": message, "game_state": game}


@app.post("/game/{game_id}/build-estate")
async def build_estate(game_id: str, target_square_id: int):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if not game.awaiting_action or not sq.is_estate:
        raise HTTPException(status_code=400, detail="Not at estate or not your action phase")
    if not (0 <= target_square_id < len(game.board)):
        raise HTTPException(status_code=400, detail="Invalid target square")
    tgt = game.board[target_square_id]
    if tgt.is_market or tgt.is_farm or tgt.is_estate:
        raise HTTPException(status_code=400, detail="Cannot build on event square")
    if tgt.building_owner:
        raise HTTPException(status_code=400, detail="Building already exists on target")
    if p.coins < 500:
        raise HTTPException(status_code=400, detail="Not enough coins")
    p.coins -= 500
    tgt.building_owner = p.id
    return {"message": "Building constructed", "game_state": game}
