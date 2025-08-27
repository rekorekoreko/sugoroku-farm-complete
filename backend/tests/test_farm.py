import random
from fastapi.testclient import TestClient
from app.main import app, games, Player, trigger_random_event

client = TestClient(app)

def create_game():
    response = client.post("/game/create", params={"player_name": "Alice"})
    data = response.json()
    return data["game_id"]


def test_buy_farm():
    game_id = create_game()
    game = games[game_id]
    farm_index = next(i for i, sq in enumerate(game.board) if sq.is_farm)
    game.players[0].position = farm_index

    res = client.post(f"/game/{game_id}/buy-farm")
    assert res.status_code == 200
    data = res.json()
    player = data["game_state"]["players"][0]
    square = data["game_state"]["board"][farm_index]
    assert player["has_farm"] is True
    assert player["coins"] == 0
    assert square["farm_owner"] == "player1"


def test_roll_dice_returns_path():
    game_id = create_game()
    res = client.post(f"/game/{game_id}/roll-dice")
    assert res.status_code == 200
    data = res.json()
    dice = data["dice_value"]
    path = data["path"]
    assert len(path) == dice
    assert path[-1] == data["game_state"]["players"][0]["position"]


def test_trigger_random_event_before_after_farm(monkeypatch):
    monkeypatch.setattr(random, "choice", lambda events: events[0])
    player = Player(id="p1", name="P1", position=0, coins=100, crops_harvested=0)

    msg_no_farm = trigger_random_event(player)
    assert "特に何も起こらなかった" in msg_no_farm
    assert player.coins == 100

    player.has_farm = True
    msg_with_farm = trigger_random_event(player)
    assert "利益が出た" in msg_with_farm
    assert player.coins == 130
