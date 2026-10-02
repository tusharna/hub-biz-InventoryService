# Inventory

NestJS app that reserves stock for orders. It does not call the orders API. It listens on Azure Service Bus and writes a Cosmos container of its own.

The orders app lives in the sibling `Azure SB` folder. That app publishes `OrderCreated` with `items` (`productId` and `quantity`). This app must be the only consumer of `inventory-subscription`.

## What it does

```text
OrderCreated on inventory-subscription
        |
        v
Read stock for each productId
        |
        +--> product id ends with -oos, unknown product, or quantity above available
        |         publish InventoryReservationFailed
        |         stock unchanged
        |
        +--> otherwise decrement each product with its ETag
                  a later conflict puts earlier quantities back
                  then publish InventoryReservationFailed
                  or publish InventoryReserved
```

A saved reservation is keyed by `orderId`. A redelivered `OrderCreated` republishes that outcome and does not decrement again.

`correlationId` on the result is the order id. `causationId` is the `OrderCreated` event id.

Stock documents and reservation documents share the `stock` container. The partition key is `/productId`. A stock row uses the product id as its partition. A reservation row uses `reservation:<orderId>` as its partition so it can be point-read. One Cosmos batch cannot update every product, because each product is its own partition.

## Run

Use the same Cosmos account and Service Bus namespace as the orders app. The topic and `inventory-subscription` must already exist (`infra/azure/create-resources.sh` in the orders repo creates the subscription). This app creates the `stock` container on startup.

```bash
npm install
cp .env.example .env
npm run start:dev
```

Default port is `3001`.

| Variable | Purpose |
| --- | --- |
| `COSMOS_ENDPOINT`, `COSMOS_KEY`, `COSMOS_DATABASE` | Same account and database as orders |
| `COSMOS_STOCK_CONTAINER` | Defaults to `stock` |
| `SERVICE_BUS_CONNECTION_STRING` | Same namespace as orders |
| `SERVICE_BUS_ORDERS_TOPIC` | `orders-topic` |
| `SERVICE_BUS_INVENTORY_SUBSCRIPTION` | `inventory-subscription` |

Seed stock, then create an order from the orders app:

```bash
curl -s -X POST http://localhost:3001/products \
  -H 'content-type: application/json' \
  -d '{"productId":"sku-1","available":10}'

curl -s http://localhost:3001/products/sku-1
curl -s http://localhost:3001/health
```

## HTTP

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Cosmos stock container up or degraded |
| `POST` | `/products` | Set `productId` and `available` |
| `GET` | `/products/:productId` | Read one stock row and its ETag |

## Tests

```bash
npm test
```

The suite covers `-oos`, insufficient stock, compensation after a later product conflict, and redelivery that does not decrement twice.
