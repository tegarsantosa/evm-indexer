import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';

import { config } from './config/config.js';
import { indexer } from './indexer/indexer.js';
import { WebSocketHandler } from './core/websocket-server.js';

import eventsRouter from './api/routes/events.js';
import transactionsRouter from './api/routes/transactions.js';
import statusRouter from './api/routes/status.js';

import {
  errorHandler,
  notFound,
  validateAddress,
  validateBlockNumber,
  rateLimiter
} from './api/middleware.js';

const app = express();
const server = createServer(app);

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter());

app.use('/api/events', validateAddress, validateBlockNumber, eventsRouter);
app.use('/api/transactions', validateAddress, validateBlockNumber, transactionsRouter);
app.use('/api/status', statusRouter);

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'EVM Indexer API - tegarsantosa.com',
    endpoints: {
      events: '/api/events',
      transactions: '/api/transactions',
      status: '/api/status',
      websocket: 'ws://localhost:' + config.port
    }
  });
});

app.use(notFound);
app.use(errorHandler);

const wsHandler = new WebSocketHandler(server);

async function startServer() {
  try {
    await indexer.initialize();
    await indexer.start();

    server.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`HTTP API: http://localhost:${config.port}/api`);
      console.log(`WebSocket: ws://localhost:${config.port}`);
    });

    indexer.on('event', (event) => {
      console.log(`New event: ${event.contractName}.${event.eventName} at block ${event.blockNumber}`);
    });

    indexer.on('progress', (progress) => {
      console.log(`Sync progress: ${progress.contract} - ${progress.progress.toFixed(2)}%`);
    });

    indexer.on('error', (error) => {
      console.error('Indexer error:', error.message);
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

async function stopServer() {
  console.log('Shutting down server...');
  
  try {
    await indexer.stop();
    server.close(() => {
      console.log('Server stopped');
      process.exit(0);
    });
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGINT', stopServer);
process.on('SIGTERM', stopServer);
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

startServer();