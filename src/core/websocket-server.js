import { WebSocketServer } from 'ws';
import { indexer } from '../indexer/indexer.js';

export class WebSocketHandler {
  constructor(server) {
    this.wss = new WebSocketServer({ server });
    this.clients = new Map();
    this.setupWebSocketServer();
    this.setupIndexerListeners();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      this.clients.set(clientId, {
        socket: ws,
        subscriptions: new Set(),
        connected: true
      });

      console.log(`WebSocket client connected: ${clientId}`);

      ws.on('message', (data) => {
        this.handleMessage(clientId, data);
      });

      ws.on('close', () => {
        console.log(`WebSocket client disconnected: ${clientId}`);
        this.clients.delete(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
      });

      this.sendMessage(clientId, {
        type: 'connected',
        clientId,
        message: 'Connected to blockchain indexer WebSocket'
      });
    });
  }

  setupIndexerListeners() {
    indexer.on('event', (event) => {
      this.broadcast({
        type: 'event',
        data: event
      }, 'events');
    });

    indexer.on('transaction', (transaction) => {
      this.broadcast({
        type: 'transaction',
        data: transaction
      }, 'transactions');
    });

    indexer.on('events', (events) => {
      this.broadcast({
        type: 'events_batch',
        data: events
      }, 'events');
    });

    indexer.on('transactions', (transactions) => {
      this.broadcast({
        type: 'transactions_batch',
        data: transactions
      }, 'transactions');
    });

    indexer.on('progress', (progress) => {
      this.broadcast({
        type: 'sync_progress',
        data: progress
      }, 'sync');
    });
  }

  handleMessage(clientId, data) {
    try {
      const message = JSON.parse(data.toString());
      const client = this.clients.get(clientId);

      if (!client) return;

      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(clientId, message.channels || []);
          break;
        case 'unsubscribe':
          this.handleUnsubscribe(clientId, message.channels || []);
          break;
        case 'ping':
          this.sendMessage(clientId, { type: 'pong' });
          break;
        default:
          this.sendMessage(clientId, {
            type: 'error',
            message: 'Unknown message type'
          });
      }
    } catch (error) {
      this.sendMessage(clientId, {
        type: 'error',
        message: 'Invalid JSON message'
      });
    }
  }

  handleSubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const validChannels = ['events', 'transactions', 'sync', 'all'];
    const subscribedChannels = [];

    channels.forEach(channel => {
      if (validChannels.includes(channel)) {
        client.subscriptions.add(channel);
        subscribedChannels.push(channel);
      }
    });

    this.sendMessage(clientId, {
      type: 'subscribed',
      channels: subscribedChannels
    });
  }

  handleUnsubscribe(clientId, channels) {
    const client = this.clients.get(clientId);
    if (!client) return;

    const unsubscribedChannels = [];

    channels.forEach(channel => {
      if (client.subscriptions.has(channel)) {
        client.subscriptions.delete(channel);
        unsubscribedChannels.push(channel);
      }
    });

    this.sendMessage(clientId, {
      type: 'unsubscribed',
      channels: unsubscribedChannels
    });
  }

  broadcast(message, channel = 'all') {
    this.clients.forEach((client, clientId) => {
      if (client.connected && 
          (client.subscriptions.has(channel) || client.subscriptions.has('all'))) {
        this.sendMessage(clientId, message);
      }
    });
  }

  sendMessage(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || !client.connected) return;

    try {
      client.socket.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.clients.delete(clientId);
    }
  }

  generateClientId() {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  getConnectedClientsCount() {
    return this.clients.size;
  }

  getClientSubscriptions(clientId) {
    const client = this.clients.get(clientId);
    return client ? Array.from(client.subscriptions) : [];
  }
}