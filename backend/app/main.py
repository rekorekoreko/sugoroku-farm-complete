from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from enum import Enum
from typing import Dict, List, Optional, Any, Any
import random


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
    is_market: bool = False  # 5
    is_farm: bool = False    # 10
    is_estate: bool = False  # 15
    is_battle: bool = False  # 14
    building_owner: Optional[str] = None
    # AI story overlay (temporary special squares)
    is_story: bool = False
    story_label: Optional[str] = None  # short label to show on board
    story_color: Optional[str] = None  # e.g. 'rose', 'emerald', 'amber', 'sky'
    story_turns: int = 0               # remaining turns for the story overlay
    story_effect: Optional[str] = None # 'gift'|'tax'|'boost' etc.


class Player(BaseModel):
    id: str
    name: str
    position: int
    coins: int
    crops_harvested: int
    stocks_shares: int = 0
    inventory: Dict[str, int] = {}


class GameState(BaseModel):
    players: List[Player]
    current_player: int
    board: List[Square]
    turn: int
    dice_value: Optional[int] = None
    awaiting_action: bool = False
    stock_price: int = 80
    last_stock_change: int = 0
    crop_prices: Dict[str, int] = {}
    crop_changes: Dict[str, int] = {}
    bazaar_offer_price: Optional[int] = None
    minigame: Optional[Dict[str, Any]] = None

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def create_board() -> List[Square]:
    board = [Square(id=i) for i in range(20)]
    if len(board) > 5:
        board[5].is_market = True
    if len(board) > 10:
        board[10].is_farm = True
    if len(board) > 14:
        board[14].is_battle = True
    if len(board) > 15:
        board[15].is_estate = True
    return board


def get_crop_growth_time(tp: CropType) -> int:
    return {
        CropType.CARROT: 2,
        CropType.TOMATO: 3,
        CropType.CORN: 4,
        CropType.WHEAT: 3,
    }[tp]


games: Dict[str, GameState] = {}


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.post("/game/create")
async def create_game(player_name: str):
    game_id = f"game_{random.randint(1000, 9999)}"
    p1 = Player(id="player1", name=player_name, position=0, coins=100, crops_harvested=0, inventory={})
    bot = Player(id="bot", name="Bot", position=0, coins=100, crops_harvested=0, inventory={})

    crop_prices = {k: random.randint(30, 100) for k in [
        CropType.CARROT.value,
        CropType.TOMATO.value,
        CropType.CORN.value,
        CropType.WHEAT.value,
    ]}

    state = GameState(
        players=[p1, bot],
        current_player=0,
        board=create_board(),
        turn=1,
        awaiting_action=False,
        stock_price=80,
        last_stock_change=0,
        crop_prices=crop_prices,
        crop_changes={k: 0 for k in crop_prices.keys()},
        bazaar_offer_price=None,
    )
    games[game_id] = state
    return {"game_id": game_id, "game_state": state}


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

    current = game.players[game.current_player]
    dice = random.randint(1, 6)
    if current.id != "bot":
        game.dice_value = dice

    # move
    new_pos = (current.position + dice) % len(game.board)
    current.position = new_pos

    # crop growth across board
    for sq in game.board:
        if sq.crop and sq.crop.stage != CropStage.READY:
            diff = game.turn - sq.crop.planted_turn
            if diff >= sq.crop.growth_time:
                sq.crop.stage = CropStage.READY
            elif diff >= max(1, sq.crop.growth_time // 2):
                sq.crop.stage = CropStage.GROWING

    # auto-harvest only when stopping on a READY crop you own
    stop_sq = game.board[current.position]
    if stop_sq.crop and stop_sq.crop.stage == CropStage.READY and stop_sq.owner == current.id:
        qty = random.randint(1, 5)
        key = stop_sq.crop.type.value
        current.inventory[key] = current.inventory.get(key, 0) + qty
        current.crops_harvested += qty
        stop_sq.crop = None
        stop_sq.owner = None
        events.append(f"{current.name}: {key} を{qty}個収穫（自動）")

    # invader minigame: landing on opponent crop triggers 1v1
    stop_sq = game.board[current.position]
    if stop_sq.crop and stop_sq.owner and stop_sq.owner != current.id:
        attacker_id = current.id
        defender_id = stop_sq.owner
        if attacker_id == "bot" and False:
            events.extend(["インベーダー: 3", "インベーダー: 2", "インベーダー: 1", "インベーダー: スタート！"])
            defender = next((p for p in game.players if p.id == defender_id), None)
            stop_sq.owner = attacker_id
            if defender:
                defender.coins += 0
            events.append("インベーダー: BOTがマスを獲得、防衛側に+40コイン")
        else:
            game.minigame = {
                "square_id": stop_sq.id,
                "attacker_id": attacker_id,
                "defender_id": defender_id,
                "status": "countdown",  # countdown -> playing -> done
                "created_turn": game.turn,
            }
            events.extend(["インベーダー: 3", "インベーダー: 2", "インベーダー: 1", "インベーダー: スタート！"])
    # RPG battle tile (square 14): random encounter for human; bot auto-resolves
    stop_sq = game.board[current.position]
    if getattr(stop_sq, 'is_battle', False):
        if current.id != "bot":
            enemy_pool = [
                {"name": "スライム", "hp": random.randint(8, 12), "atk_min": 1, "atk_max": 3},
                {"name": "ゴブリン", "hp": random.randint(10, 14), "atk_min": 2, "atk_max": 4},
                {"name": "オオカミ", "hp": random.randint(9, 13), "atk_min": 1, "atk_max": 4},
            ]
            foe = random.choice(enemy_pool)
            game.minigame = {
                "type": "rpg",
                "status": "countdown",
                "player_id": current.id,
                "player_hp": 12,
                "enemy": {"name": foe["name"], "hp": foe["hp"], "max_hp": foe["hp"], "atk_min": foe["atk_min"], "atk_max": foe["atk_max"]},
                "created_turn": game.turn,
                "log": [f"{foe['name']} が あらわれた！"],
            }
            events.append(f"バトル開始: {foe['name']} 出現！")
        else:
            # bot auto resolve
            enemy_hp = random.randint(8, 12)
            player_hp = 12
            while enemy_hp > 0 and player_hp > 0:
                enemy_hp -= random.randint(3, 6)
                if enemy_hp <= 0:
                    break
                player_hp -= random.randint(1, 4)
            if enemy_hp <= 0:
                current.coins += 40
                events.append("BOTは野良モンスターを倒した！（+40コイン）")
            else:
                loss = min(current.coins, 20)
                current.coins -= loss
                events.append(f"BOTは逃げ出した…（-{loss}コイン）")

    # stock price change (clamp 10..300)
    old = game.stock_price
    delta = random.randint(-30, 30)
    newp = max(10, min(300, old + delta))
    pct = int(round(((newp - old) / old) * 100)) if old > 0 else 0
    game.stock_price = newp
    game.last_stock_change = pct
    if pct != 0:
        events.append(f"株価が{old}→{newp}（{'+' if pct>0 else ''}{pct}%）に変動")

    # per-player turn counter
    turns_for_player = getattr(current, "_turns", 0) + 1
    setattr(current, "_turns", turns_for_player)

    # crop market update (30..100) every turn
    if game.crop_prices:
        new_prices: Dict[str, int] = {}
        new_changes: Dict[str, int] = {}
        for k, oldp in game.crop_prices.items():
            np = random.randint(30, 100)
            chg = int(round(((np - oldp) / oldp) * 100)) if oldp > 0 else 0
            new_prices[k] = np
            new_changes[k] = chg
        game.crop_prices = new_prices
        game.crop_changes = new_changes
    else:
        game.crop_prices = {k: random.randint(30, 100) for k in [
            CropType.CARROT.value,
            CropType.TOMATO.value,
            CropType.CORN.value,
            CropType.WHEAT.value,
        ]}
        game.crop_changes = {k: 0 for k in game.crop_prices.keys()}

    # building income: every 3 turns for the player
    if turns_for_player % 3 == 0:
        bcnt = sum(1 for s in game.board if s.building_owner == current.id)
        if bcnt > 0:
            income = 50 * bcnt
            current.coins += income
            events.append(f"{current.name}: 建物の収益 +{income}コイン（{bcnt}棟）")

    # bazaar offer: if on farm and every 3 turns for that player
    if stop_sq.is_farm and turns_for_player % 3 == 0:
        game.bazaar_offer_price = random.randint(10, 300)
        events.append(f"バイヤーが{game.bazaar_offer_price}ゴールドで買い取り希望！")
    else:
        game.bazaar_offer_price = None

    # next phase/turn
    game.turn += 1
    # === AI Story: apply/decay story tiles and resolve on landing ===
    events.extend(_ai_story_tick(game, current))
    if current.id == "bot":
        # bot simple auto-plant on empty normal tile
        if stop_sq.crop is None and not (stop_sq.is_market or stop_sq.is_farm or stop_sq.is_estate) and current.coins >= 20:
            ct = random.choice(list(CropType))
            current.coins -= 20
            stop_sq.crop = Crop(type=ct, stage=CropStage.PLANTED, planted_turn=game.turn, growth_time=get_crop_growth_time(ct))
            stop_sq.owner = current.id
            events.append(f"{current.name}: {ct.value}を植えた")
        # bot auto-build when at estate
        if stop_sq.is_estate and current.coins >= 500:
            candidates = [s for s in game.board if not (s.is_market or s.is_farm or s.is_estate) and not s.building_owner]
            if candidates:
                tgt = random.choice(candidates)
                current.coins -= 500
                tgt.building_owner = current.id
                events.append(f"{current.name}: マス{tgt.id}に建物を建設（500コイン）")
        # pass to human
        game.current_player = (game.current_player + 1) % len(game.players)
        game.awaiting_action = False
    else:
        # human action phase
        game.awaiting_action = True

    # Always return the dice rolled for this call so clients can animate correctly
    return {"game_state": game, "events": events, "dice_value": dice}


def _ai_story_tick(game: GameState, current: Player):
    """Simple AI story system: occasionally paints temporary story tiles and
    applies lightweight effects when a player lands on them.
    """
    rng = random.Random()
    evs: List[str] = []

    # 1) Decay existing story overlays
    for sq in game.board:
        if getattr(sq, 'is_story', False):
            sq.story_turns = max(0, int(getattr(sq, 'story_turns', 0)))
            if sq.story_turns <= 0:
                # clear
                sq.is_story = False
                sq.story_label = None
                sq.story_color = None
                sq.story_effect = None
            else:
                sq.story_turns -= 1

    # 2) Randomly spawn a new story tile on a normal (non-event) square
    #    small chance per roll to avoid noise
    if rng.random() < 0.25:
        normal_candidates = [s for s in game.board if not (s.is_market or s.is_farm or s.is_estate) and not s.is_story]
        if normal_candidates:
            sq = rng.choice(normal_candidates)
            effect = rng.choice(['gift', 'tax', 'boost'])
            label, color = {
                'gift': ('福', 'emerald'),
                'tax': ('禍', 'rose'),
                'boost': ('風', 'sky'),
            }[effect]
            sq.is_story = True
            sq.story_label = label
            sq.story_color = color
            sq.story_effect = effect
            sq.story_turns = rng.randint(2, 4)
            evs.append(f"AIストーリー: マス{sq.id}に『{label}』の気配が漂う…（{sq.story_turns}ターン）")

    # 3) Resolve if current player landed on a story tile
    stop_sq = game.board[current.position]
    if getattr(stop_sq, 'is_story', False) and stop_sq.story_effect:
        effect = stop_sq.story_effect
        if effect == 'gift':
            amt = rng.randint(30, 80)
            current.coins += amt
            evs.append(f"{current.name}: 謎の加護で+{amt}コイン！")
        elif effect == 'tax':
            amt = rng.randint(20, 60)
            pay = min(current.coins, amt)
            current.coins -= pay
            evs.append(f"{current.name}: 不運に見舞われ-{pay}コイン…")
        elif effect == 'boost':
            # small global boost to crop prices
            if game.crop_prices:
                for k in list(game.crop_prices.keys()):
                    game.crop_prices[k] = int(round(min(300, game.crop_prices[k] * 1.1)))
                evs.append("風の便り：作物相場が少し上向きに！")
            else:
                evs.append("風が吹いたが、特に影響はなかった。")
        # story tile consumes on landing
        stop_sq.is_story = False
        stop_sq.story_label = None
        stop_sq.story_color = None
        stop_sq.story_effect = None
        stop_sq.story_turns = 0

    return evs


@app.post("/game/{game_id}/end-turn")
async def end_turn(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    game.awaiting_action = False
    game.bazaar_offer_price = None
    game.current_player = (game.current_player + 1) % len(game.players)
    return {"message": "Turn ended", "game_state": game}


@app.get("/game/{game_id}/minigame")
async def get_minigame(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    if not getattr(game, 'minigame', None):
        raise HTTPException(status_code=404, detail="No minigame")
    return {"minigame": game.minigame, "game_state": game}


@app.post("/game/{game_id}/minigame/ready")
async def minigame_ready(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    if not game.minigame:
        raise HTTPException(status_code=404, detail="No minigame")
    game.minigame["status"] = "playing"
    return {"message": "minigame started", "minigame": game.minigame, "game_state": game}


@app.post("/game/{game_id}/minigame/resolve")
async def minigame_resolve(game_id: str, winner: str = "attacker"):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    mg = game.minigame
    if not mg:
        raise HTTPException(status_code=404, detail="No minigame")
    sq_id = int(mg["square_id"])
    if not (0 <= sq_id < len(game.board)):
        raise HTTPException(status_code=400, detail="Invalid square")
    attacker_id = mg["attacker_id"]
    defender_id = mg["defender_id"]
    sq = game.board[sq_id]
    # apply result based on winner
    winner = (winner or "attacker").lower()
    attacker = next((p for p in game.players if p.id == attacker_id), None)
    defender = next((p for p in game.players if p.id == defender_id), None)
    if winner == "attacker":
        # 勝者が挑戦者（攻撃側）の場合: 作物マスを奪取
        sq.owner = attacker_id
    else:
        # 勝者が挑まれた側（防御側）の場合: 50コイン獲得
        if defender:
            defender.coins += 50
    game.minigame = None
    return {"message": "minigame resolved", "game_state": game}


@app.post("/game/{game_id}/minigame/rpg/act")
async def rpg_minigame_act(game_id: str, action: str = "attack"):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    mg = game.minigame
    if not mg or mg.get("type") != "rpg":
        raise HTTPException(status_code=404, detail="No RPG minigame")
    # Only current human may act
    p = game.players[game.current_player]
    if p.id != mg.get("player_id"):
        raise HTTPException(status_code=400, detail="Not your turn for minigame")
    if action != "attack":
        raise HTTPException(status_code=400, detail="Invalid action")

    log = mg.setdefault("log", [])
    # player attack
    dmg = random.randint(3, 6)
    mg["enemy"]["hp"] = max(0, int(mg["enemy"]["hp"]) - dmg)
    log.append(f"あなたの攻撃！ {dmg} ダメージ")
    if mg["enemy"]["hp"] <= 0:
        # victory
        p.coins += 50
        game.minigame = None
        # end action phase and pass turn to next player
        game.awaiting_action = False
        game.current_player = (game.current_player + 1) % len(game.players)
        return {"message": "victory", "game_state": game}

    # enemy counterattack
    emin = int(mg["enemy"]["atk_min"])
    emax = int(mg["enemy"]["atk_max"])
    edmg = random.randint(emin, emax)
    mg["player_hp"] = max(0, int(mg["player_hp"]) - edmg)
    log.append(f"{mg['enemy']['name']} の攻撃！ {edmg} ダメージ")
    if mg["player_hp"] <= 0:
        # defeat
        loss = min(p.coins, 30)
        p.coins -= loss
        game.minigame = None
        game.awaiting_action = False
        game.current_player = (game.current_player + 1) % len(game.players)
        return {"message": "defeat", "game_state": game}

    # continue playing
    mg["status"] = "playing"
    return {"message": "turn resolved", "game_state": game}


@app.post("/game/{game_id}/plant-crop")
async def plant_crop(game_id: str, crop_type: CropType):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]

    # forbid planting on special tiles and start tile (0)
    if sq.is_market or sq.is_farm or sq.is_estate or p.position == 0:
        raise HTTPException(status_code=400, detail="Cannot plant on event square")
    if sq.crop is not None:
        raise HTTPException(status_code=400, detail="Square already has a crop")
    if p.coins < 20:
        raise HTTPException(status_code=400, detail="Not enough coins")

    p.coins -= 20
    sq.crop = Crop(type=crop_type, stage=CropStage.PLANTED, planted_turn=game.turn, growth_time=get_crop_growth_time(crop_type))
    sq.owner = p.id

    # consume action -> to next player
    game.awaiting_action = False
    game.current_player = (game.current_player + 1) % len(game.players)
    return {"message": "planted", "game_state": game}


@app.post("/game/{game_id}/harvest-crop")
async def harvest_crop(game_id: str):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if not sq.crop or sq.owner != p.id or sq.crop.stage != CropStage.READY:
        raise HTTPException(status_code=400, detail="Nothing to harvest here")
    qty = random.randint(1, 5)
    key = sq.crop.type.value
    p.inventory[key] = p.inventory.get(key, 0) + qty
    p.crops_harvested += qty
    sq.crop = None
    sq.owner = None
    game.awaiting_action = False
    game.current_player = (game.current_player + 1) % len(game.players)
    return {"message": "harvested", "harvested_qty": qty, "game_state": game}


@app.post("/game/{game_id}/buy-stock")
async def buy_stock(game_id: str, shares: int = 1):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if not game.awaiting_action or not sq.is_market:
        raise HTTPException(status_code=400, detail="Not at market or not your action phase")
    cost = game.stock_price * max(0, shares)
    if shares <= 0 or p.coins < cost:
        raise HTTPException(status_code=400, detail="Not enough coins")
    p.coins -= cost
    p.stocks_shares += shares
    return {"message": "bought", "game_state": game}


@app.post("/game/{game_id}/sell-stock")
async def sell_stock(game_id: str, shares: int = 1):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if not game.awaiting_action or not sq.is_market:
        raise HTTPException(status_code=400, detail="Not at market or not your action phase")
    if shares <= 0 or p.stocks_shares < shares:
        raise HTTPException(status_code=400, detail="Not enough shares")
    p.stocks_shares -= shares
    p.coins += game.stock_price * shares
    return {"message": "sold", "game_state": game}


@app.post("/game/{game_id}/sell-inventory")
async def sell_inventory(game_id: str, crop_type: str, qty: int):
    if game_id not in games:
        raise HTTPException(status_code=404, detail="Game not found")
    if qty <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")
    game = games[game_id]
    p = game.players[game.current_player]
    sq = game.board[p.position]
    if not game.awaiting_action or not sq.is_farm:
        raise HTTPException(status_code=400, detail="Not at farm or not your action phase")
    if not game.bazaar_offer_price:
        raise HTTPException(status_code=400, detail="No buyer at bazaar now")
    key = crop_type
    have = p.inventory.get(key, 0)
    if have <= 0:
        raise HTTPException(status_code=400, detail="No inventory for this crop")
    sell_n = min(have, qty)
    p.inventory[key] = have - sell_n
    p.coins += game.bazaar_offer_price * sell_n
    return {"message": "sold", "sold_qty": sell_n, "unit_price": game.bazaar_offer_price, "game_state": game}


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
    return {"message": "built", "game_state": game}


