# Hedera HTTP Explorer Server

This package provides REST API endpoints for exposing EVM-centric data from the Hedera network, similar to Etherscan's API. It supports querying token transfers for ERC20, ERC721, and ERC1155 tokens, as well as fetching tokens owned by an address.

## Features

- ERC20 token transfer events
- ERC721 NFT transfer events  
- ERC1155 multi-token transfer events
- Tokens owned by an address
- Pagination support
- Block range filtering
- Address filtering
- Contract filtering

## API Endpoints

### Token Transfers

Get ERC20 token transfers:
```
GET /api?module=account&action=tokentx&address={address}&contractaddress={contractaddress}&startblock={startblock}&endblock={endblock}&page={page}&offset={offset}&sort={asc|desc}
```

Get ERC721 (NFT) token transfers:
```
GET /api?module=account&action=tokennfttx&address={address}&contractaddress={contractaddress}&startblock={startblock}&endblock={endblock}&page={page}&offset={offset}&sort={asc|desc}
```

Get ERC1155 token transfers:
```
GET /api?module=account&action=token1155tx&address={address}&contractaddress={contractaddress}&startblock={startblock}&endblock={endblock}&page={page}&offset={offset}&sort={asc|desc}
```

### Account Tokens

Get tokens owned by an address:
```
GET /api/account/{address}/tokens?page={page}&offset={offset}
```

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
npm start
```

## Configuration

The server can be configured through environment variables:

- `PORT` - Server port (default: 3000)
- `HOST` - Server host (default: localhost)
- `RATE_LIMIT` - Rate limiting configuration
- `PAGINATION_DEFAULT_SIZE` - Default page size (default: 100)
- `PAGINATION_MAX_SIZE` - Maximum page size (default: 1000)
- `MAX_BLOCK_RANGE` - Maximum block range for queries (default: 1000)
- `REDIS_URL` - Redis connection URL for caching

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Fix linting issues
npm run lint:fix
``` 
