# EVM Blockchain Indexer

A simple EVM blockchain event indexer with REST API + MongoDB and WebSocket support for real-time event streaming. Built with Node.js ES modules, Express, and MongoDB. Currently used for my own Web3 projects.


## Features

-  **Real-time Event Indexing** ✅
	Automatically indexes smart contract events
-  **Transaction Processing** ✅
	Stores and indexes blockchain transactions
-  **REST API** ✅
	Full HTTP API for querying events and transactions
-  **WebSocket Support** ✅
	Real-time streaming of new events and transactions
-  **Auto Recovery** ✅
	Automatically replays missed events after downtime
-  **Confirmation Tracking** ✅
	Tracks event confirmations based on block depth
-  **Rate Limiting** ✅
	Built-in API rate limiting
-  **Validation** ✅
	Input validation for addresses and block numbers

## Installation

1. Clone the repository
2. Install dependencies:
```bash
npm install
```

3. Copy environment configuration:
```bash
cp .env.example .env
```

4. Update the `.env` file with your configuration:
```env
PORT=3000
MONGODB_URI=mongodb://root:root@localhost:27017/indexer
RPC_URL=http:// # or https://
WS_URL=ws:// # or wss://
CONFIRMATIONS=12
BATCH_SIZE=1000
RETRY_DELAY=5000
```

5. Configure your contracts in `src/config/contracts.js`

6. Start the server:
```bash
npm start
```

For development with auto-restart:
```bash
npm run dev
```

## Configuration

### Contracts Configuration

Edit `src/config/contracts.js` to add your smart contracts:

```javascript
export const contracts = [
  {
    address: '0xYourContractAddress', // Contract address
    abi: [
      {
        "anonymous": false,
        "inputs": [
          { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
          { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
          { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
        ],
        "name": "Transfer",
        "type": "event"
      }
    ],
    name: 'MyToken',
    startBlock: 12000000, // Starting block for historical sync
    events: ['Transferred', 'Approved'] // Specific events to index (optional)
  }
];
```

## API Endpoints

### Events

- `GET /api/events` - Get events with filtering options
- `GET /api/events/latest` - Get latest events
- `GET /api/events/range` - Get events in block range
- `GET /api/events/contract/:address` - Get events for specific contract

Query parameters:
- `contractAddress` - Filter by contract address
- `eventName` - Filter by event name
- `fromBlock` - Starting block number
- `toBlock` - Ending block number
- `confirmed` - Filter by confirmation status
- `limit` - Number of results (max 1000)
- `page` - Page number for pagination

### Transactions

- `GET /api/transactions` - Get transactions with filtering
- `GET /api/transactions/hash/:hash` - Get transaction by hash
- `GET /api/transactions/block/:blockNumber` - Get transactions by block
- `GET /api/transactions/address/:address` - Get transactions by address

### Status

- `GET /api/status/health` - Health check
- `GET /api/status/sync` - Synchronization status
- `GET /api/status/contracts` - Contract information
- `GET /api/status/stats` - General statistics

## WebSocket API

Connect to `ws://localhost:3000` for real-time updates.

### Message Types

#### Subscribe to channels:
```javascript
{
  "type": "subscribe",
  "channels": ["events", "transactions", "sync"]
}
```

#### Unsubscribe from channels:
```javascript
{
  "type": "unsubscribe", 
  "channels": ["events"]
}
```

#### Available channels:
- `events` - Individual new events
- `transactions` - Individual new transactions  
- `sync` - Synchronization progress updates
- `all` - All message types

### Example WebSocket Client

```javascript
const ws = new WebSocket('ws://localhost:3000');

ws.onopen = () => {
  // Subscribe to all events
  ws.send(JSON.stringify({
    type: 'subscribe',
    channels: ['events', 'transactions']
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);
};
```

## Usage Examples

### Query Events
```bash
# Get latest 10 events
curl "http://localhost:3000/api/events/latest?limit=10"

# Get Transfer events for specific contract
curl "http://localhost:3000/api/events?contractAddress=0x1234...&eventName=Transfer"

# Get events in block range
curl "http://localhost:3000/api/events/range?contractAddress=0x1234...&fromBlock=18000000&toBlock=18000100"
```

### Query Transactions
```bash
# Get transactions by block
curl "http://localhost:3000/api/transactions/block/18000000"

# Get transactions by address
curl "http://localhost:3000/api/transactions/address/0x1234...?type=from"
```

### Check Status
```bash
# Health check
curl "http://localhost:3000/api/status/health"

# Sync status
curl "http://localhost:3000/api/status/sync"
```

## Architecture

The indexer is built with a modular architecture:

- **`src/app.js`** - Main application entry point
- **`src/config/`** - Configuration files
- **`src/core/`** - Core directory (blockchain, DB, WebSocket)
- **`src/indexer/`** - Main indexing logic
- **`src/api/`** - REST API routes and middleware

## Database Schema

### Events Collection
```javascript
{
  contractAddress: String,
  contractName: String,
  eventName: String,
  blockNumber: Number,
  transactionHash: String,
  transactionIndex: Number,
  logIndex: Number,
  args: Object,
  timestamp: Date,
  confirmed: Boolean,
  createdAt: Date
}
```

### Transactions Collection
```javascript
{
  hash: String,
  blockNumber: Number,
  blockHash: String,
  transactionIndex: Number,
  from: String,
  to: String,
  value: String,
  gasPrice: String,
  gasLimit: String,
  gasUsed: String,
  nonce: Number,
  data: String,
  timestamp: Date,
  status: Number,
  contractAddress: String,
  logs: Array,
  createdAt: Date
}
```

### Sync State Collection
```javascript
{
  contractAddress: String,
  contractName: String,
  lastProcessedBlock: Number,
  isActive: Boolean,
  lastUpdated: Date
}
```

## Development

The indexer automatically handles:
- Historical event synchronization on startup
- Real-time event listening via WebSocket
- Event confirmation tracking
- Automatic reconnection on connection failures
- Duplicate event prevention
- Transaction processing and storage

## Error Handling

The indexer includes comprehensive error handling:
- Database connection failures
- RPC provider failures  
- WebSocket connection issues
- Invalid contract configurations
- Rate limiting protection