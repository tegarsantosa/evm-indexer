import { MongoClient } from 'mongodb';
import { config } from '../config/config.js';

class Database {
  constructor() {
    this.client = null;
    this.db = null;
  }

  async connect() {
    this.client = new MongoClient(config.mongodb.uri);
    await this.client.connect();
    this.db = this.client.db();
    await this.createIndexes();
    console.log('Connected to MongoDB');
  }

  async disconnect() {
    if (this.client) {
      await this.client.close();
      console.log('Disconnected from MongoDB');
    }
  }

  async createIndexes() {
    const eventsCollection = this.db.collection('events');
    const syncCollection = this.db.collection('sync_state');
    const transactionsCollection = this.db.collection('transactions');

    await eventsCollection.createIndex({ contractAddress: 1, blockNumber: 1 });
    await eventsCollection.createIndex({ transactionHash: 1, logIndex: 1 }, /* { unique: true } */);
    await eventsCollection.createIndex({ eventName: 1, blockNumber: 1 });
    await eventsCollection.createIndex({ confirmed: 1 });

    await syncCollection.createIndex({ contractAddress: 1 }, { unique: true });

    await transactionsCollection.createIndex({ hash: 1 }, /* { unique: true } */);
    await transactionsCollection.createIndex({ blockNumber: 1 });
    await transactionsCollection.createIndex({ from: 1 });
    await transactionsCollection.createIndex({ to: 1 });
  }

  getCollection(name) {
    return this.db.collection(name);
  }

  async saveEvents(events) {
    if (events.length === 0) return;

    const operations = events.map(event => ({
      updateOne: {
        filter: {
          transactionHash: event.transactionHash,
          logIndex: event.logIndex
        },
        update: { $set: event },
        upsert: true
      }
    }));

    await this.getCollection('events').bulkWrite(operations);
  }

  async saveTransactions(transactions) {
    if (transactions.length === 0) return;

    const operations = transactions.map(tx => ({
      updateOne: {
        filter: { hash: tx.hash },
        update: { $set: tx },
        upsert: true
      }
    }));

    await this.getCollection('transactions').bulkWrite(operations);
  }

  async updateSyncState(contractAddress, contractName, blockNumber) {
    await this.getCollection('sync_state').updateOne(
      { contractAddress },
      {
        $set: {
          contractAddress,
          contractName,
          lastProcessedBlock: blockNumber,
          isActive: true,
          lastUpdated: new Date()
        }
      },
      { upsert: true }
    );
  }

  async getSyncState(contractAddress) {
    return this.getCollection('sync_state').findOne({ contractAddress });
  }

  async markEventsAsConfirmed(blockNumber) {
    await this.getCollection('events').updateMany(
      { blockNumber: { $lte: blockNumber }, confirmed: false },
      { $set: { confirmed: true } }
    );
  }

  async getEvents(filter = {}, options = {}) {
    const limit = options.limit || 100;
    const sort = options.sort || { blockNumber: -1, logIndex: -1 };

    return this.getCollection('events')
      .find(filter)
      .sort(sort)
      .limit(limit)
      .toArray();
  }

  async getEventsInRange(contractAddress, fromBlock, toBlock) {
    return this.getCollection('events')
      .find({
        contractAddress,
        blockNumber: { $gte: fromBlock, $lte: toBlock }
      })
      .sort({ blockNumber: 1, logIndex: 1 })
      .toArray();
  }

  async getTransactionsByBlock(blockNumber) {
    return this.getCollection('transactions')
      .find({ blockNumber })
      .sort({ transactionIndex: 1 })
      .toArray();
  }

  async getAllSyncStates() {
    return this.getCollection('sync_state').find({}).toArray();
  }
}

export const database = new Database();