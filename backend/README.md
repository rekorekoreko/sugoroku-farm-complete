# Sugoroku Farm Backend

This service provides the API for the Sugoroku Farm game. In addition to
planting and harvesting crops, players can now purchase a **farm** tile.

* When a game is created one random square on the 20-tile board becomes the
  farm.
* Landing on that tile allows a player to buy the farm for **100 coins** via
  `POST /game/{game_id}/buy-farm`.
* Owners receive random profit or loss events each turn, while players without
  a farm experience neutral events.

These mechanics are exposed through the standard FastAPI endpoints used by the
frontend application.
