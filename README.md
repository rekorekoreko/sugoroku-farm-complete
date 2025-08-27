# Sugoroku Farm

This project contains the backend (FastAPI) and frontend (Vite + React) for a simple board game.

## RekoCoin Crypto System

- One board tile is randomly chosen as a crypto exchange.
- The `crypto_price` changes randomly every turn and a `crypto_history` array is tracked.
- Players standing on the exchange can buy or sell one RekoCoin using the
  `/game/{game_id}/buy-reko` and `/game/{game_id}/sell-reko` endpoints.

## Price History Graph

The frontend includes a modal line chart (powered by Recharts) that plots the
price history of RekoCoin. Use the **価格推移** button in the interface to toggle
the graph.
