import { ethers } from 'ethers';
import { config } from '../../config/config.js';
import { EventEmitter } from 'events';
import WebSocket from 'ws';

class BlockchainProvider extends EventEmitter {
  constructor() {
    super();
    this.provider = null;
    this.wsProvider = null;
    this.reconnectTimer = null;
  }

  async initialize() {
    this.provider = new ethers.JsonRpcProvider(config.rpc.url);

    if (config.rpc.wsUrl) {
      this.setupWebSocketProvider();
    }

    console.log('Blockchain provider initialized');
  }

  setupWebSocketProvider() {
    try {
      const ws = new WebSocket(config.rpc.wsUrl);

      ws.on('open', () => {
        console.log('WebSocket connection opened');
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        this.scheduleReconnection();
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error.message);
        this.scheduleReconnection();
      });

      this.wsProvider = new ethers.WebSocketProvider(ws, config.rpc.network);

      this.wsProvider.on('block', (blockNumber) => {
        console.log('New block:', blockNumber);
      });

      this.wsProvider.on('error', (error) => {
        console.error('Provider error:', error.message);
        this.emit('error', error);
        this.scheduleReconnection();
      });

    } catch (error) {
      console.error('Failed to setup WebSocket provider:', error.message);
    }
  }

  scheduleReconnection() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectTimer = setTimeout(() => {
      console.log('Attempting to reconnect WebSocket...');
      this.setupWebSocketProvider();
    }, config.rpc.retryDelay);
  }

  getProvider() {
    return this.provider;
  }

  getWebSocketProvider() {
    return this.wsProvider || this.provider;
  }

  async getCurrentBlockNumber() {
    return this.provider.getBlockNumber();
  }

  async getBlock(blockNumber) {
    return this.provider.getBlock(blockNumber);
  }

  async getTransaction(txHash) {
    return this.provider.getTransaction(txHash);
  }

  async getTransactionReceipt(txHash) {
    return this.provider.getTransactionReceipt(txHash);
  }

  async getBlockWithTransactions(blockNumber) {
    return this.provider.getBlock(blockNumber, true);
  }

  async getLogs(filter) {
    return this.provider.getLogs(filter);
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners();
      if (this.wsProvider._websocket instanceof WebSocket) {
        this.wsProvider._websocket.close();
      }
      if (this.rawWebSocket && this.rawWebSocket.readyState === WebSocket.OPEN) {
        this.rawWebSocket.close();
        this.rawWebSocket = null;
      }
      this.wsProvider = null;
    }
    console.log('Blockchain WebSocket disconnected');
  }
}

export const blockchainProvider = new BlockchainProvider();