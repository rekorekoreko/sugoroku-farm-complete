import random
from fastapi.testclient import TestClient
from app.main import app, games

client = TestClient(app)

def create_game():
    res = client.post("/game/create", params={"player_name": "Alice"})
    return res.json()["game_id"]


def test_buy_sell_reko():
    game_id = create_game()
    game = games[game_id]
    crypto_pos = next(i for i, s in enumerate(game.board) if s.is_crypto_exchange)
    player = game.players[0]
    player.position = crypto_pos
    start_coins = player.coins
    price = game.crypto_price

    res = client.post(f"/game/{game_id}/buy-reko")
    assert res.status_code == 200
    data = res.json()["game_state"]["players"][0]
    assert data["reko_coin"] == 1
    assert data["coins"] == start_coins - price

    res = client.post(f"/game/{game_id}/sell-reko")
    assert res.status_code == 200
    data = res.json()["game_state"]["players"][0]
    assert data["reko_coin"] == 0
    assert data["coins"] == start_coins


def test_crypto_price_updates(monkeypatch):
    game_id = create_game()
    game = games[game_id]
    initial_price = game.crypto_price

    def fake_randint(a, b):
        if (a, b) == (1, 6):
            return 1
        if (a, b) == (-5, 5):
            return 2
        return a

    monkeypatch.setattr(random, "randint", fake_randint)
    client.post(f"/game/{game_id}/roll-dice")
    updated = games[game_id]
    assert updated.crypto_price == initial_price + 2 * len(updated.players)
    assert len(updated.crypto_history) == len(updated.players) + 1
