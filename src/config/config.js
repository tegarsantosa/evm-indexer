import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: process.env.PORT || 3000,
  mongodb: {
    uri: process.env.MONGODB_URI
  },
  rpc: {
    url: process.env.RPC_URL,
    wsUrl: process.env.WS_URL,
    retryDelay: parseInt(process.env.RETRY_DELAY) || 5000
  },
  indexer: {
    confirmations: parseInt(process.env.CONFIRMATIONS) || 12,
    batchSize: parseInt(process.env.BATCH_SIZE) || 1000,
  }
};