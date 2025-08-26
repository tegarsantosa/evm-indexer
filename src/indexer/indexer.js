import { EventEmitter } from 'events';
import { ContractListener } from '../core/blockchain/contract-listener.js';
import { blockchainProvider } from '../core/blockchain/provider.js';
import { database } from '../core/database.js';
import { getAllContracts } from '../config/contracts.js';
import { config } from '../config/config.js';

class BlockchainIndexer extends EventEmitter {
  constructor() {
    super();
    this.contractListeners = new Map();
    this.isRunning = false;
    this.confirmationTimer = null;
  }

  async initialize() {
    await blockchainProvider.initialize();
    await database.connect();
    
    this.setupContractListeners();
    console.log('Blockchain indexer initialized');
  }

  setupContractListeners() {
    const contracts = getAllContracts();
    
    for (const contractConfig of contracts) {
      const listener = new ContractListener(
        blockchainProvider.getWebSocketProvider(),
        contractConfig
      );
      
      listener.on('event', (event) => {
        this.processRealtimeEvent(event, listener);
      });
      
      this.contractListeners.set(contractConfig.address, listener);
    }
  }

  async start() {
    try {
      this.isRunning = true;
      
      await this.performInitialSync();
      this.startRealTimeListening();
      this.startConfirmationProcess();
      
      console.log('Blockchain indexer started');
      this.emit('started');
      
    } catch (error) {
      console.error('Failed to start indexer:', error);
      this.emit('error', error);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    
    if (this.confirmationTimer) {
      clearTimeout(this.confirmationTimer);
    }

    this.contractListeners.forEach((listener) => {
      listener.stopListening();
    });

    blockchainProvider.disconnect();
    await database.disconnect();
    
    console.log('Blockchain indexer stopped');
    this.emit('stopped');
  }

  async performInitialSync() {
    console.log('Starting initial sync...');
    
    const currentBlock = await blockchainProvider.getCurrentBlockNumber();
    
    for (const [address, listener] of this.contractListeners) {
      await this.syncContractHistory(listener, currentBlock);
    }
    
    console.log('Initial sync completed');
    this.emit('synced');
  }

  async syncContractHistory(listener, currentBlock) {
    const contractAddress = listener.getAddress();
    const contractName = listener.getName();
    
    const syncState = await database.getSyncState(contractAddress);
    const contractConfig = listener.getConfig();
    
    const startBlock = syncState 
      ? syncState.lastProcessedBlock + 1 
      : contractConfig.startBlock || 0;

    if (startBlock > currentBlock) {
      console.log(`Contract ${contractName} is already up to date`);
      return;
    }

    console.log(`Syncing contract ${contractName} from block ${startBlock} to ${currentBlock}`);
    
    let fromBlock = startBlock;
    
    while (fromBlock <= currentBlock) {
      const toBlock = Math.min(fromBlock + config.indexer.batchSize - 1, currentBlock);
      
      try {
        await this.processHistoricalEvents(listener, fromBlock, toBlock);
        await database.updateSyncState(contractAddress, contractName, toBlock);
        
        this.emit('progress', {
          contract: contractName,
          fromBlock,
          toBlock,
          progress: ((toBlock - startBlock) / (currentBlock - startBlock)) * 100
        });
        
        fromBlock = toBlock + 1;
        
      } catch (error) {
        console.error(`Error syncing contract ${contractName} blocks ${fromBlock}-${toBlock}:`, error.message);
        await this.delay(config.rpc.retryDelay);
      }
    }
  }

  async processHistoricalEvents(listener, fromBlock, toBlock) {
    const events = await listener.getHistoricalEvents(fromBlock, toBlock);
    
    if (events.length === 0) return;

    const indexedEvents = [];
    const transactionHashes = new Set();
    
    for (const event of events) {
      const indexedEvent = await this.convertEventToIndexedEvent(event, listener);
      indexedEvents.push(indexedEvent);
      transactionHashes.add(event.transactionHash);
    }
    
    const transactions = [];
    for (const txHash of transactionHashes) {
      try {
        const tx = await this.processTransaction(txHash);
        if (tx) transactions.push(tx);
      } catch (error) {
        console.error(`Error processing transaction ${txHash}:`, error.message);
      }
    }
    
    await Promise.all([
      database.saveEvents(indexedEvents),
      database.saveTransactions(transactions)
    ]);
    
    this.emit('events', indexedEvents);
    this.emit('transactions', transactions);
  }

  startRealTimeListening() {
    this.contractListeners.forEach((listener) => {
      listener.startListening();
    });
    
    console.log('Started real-time listening');
  }

  async processRealtimeEvent(event, listener) {
    try {
      const indexedEvent = await this.convertEventToIndexedEvent(event, listener);
      const transaction = await this.processTransaction(event.log.transactionHash);
      
      await Promise.all([
        database.saveEvents([indexedEvent]),
        transaction ? database.saveTransactions([transaction]) : Promise.resolve()
      ]);
      
      await database.updateSyncState(
        listener.getAddress(), 
        listener.getName(), 
        event.log.blockNumber
      );
      
      this.emit('event', indexedEvent);
      if (transaction) {
        this.emit('transaction', transaction);
      }
      
    } catch (error) {
      console.error('Error processing real-time event:', error.message);
      this.emit('error', error);
    }
  }

  async processTransaction(txHash) {
    try {
      const [tx, receipt] = await Promise.all([
        blockchainProvider.getTransaction(txHash),
        blockchainProvider.getTransactionReceipt(txHash)
      ]);

      if (!tx || !receipt) return null;

      const block = await blockchainProvider.getBlock(tx.blockNumber);
      
      return {
        hash: tx.hash,
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        transactionIndex: tx.transactionIndex,
        from: tx.from,
        to: tx.to || '',
        value: tx.value.toString(),
        gasPrice: tx.gasPrice?.toString() || '0',
        gasLimit: tx.gasLimit.toString(),
        gasUsed: receipt.gasUsed.toString(),
        nonce: tx.nonce,
        data: tx.data,
        timestamp: new Date(block.timestamp * 1000),
        status: receipt.status,
        contractAddress: receipt.contractAddress || undefined,
        logs: receipt.logs,
        createdAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to process transaction ${txHash}: ${error.message}`);
    }
  }

  async convertEventToIndexedEvent(event, listener) {
    try {
      const log = event.log || event;
      const block = await blockchainProvider.getBlock(event.blockNumber);
      return {
        contractAddress: listener.getAddress(),
        contractName: listener.getName(),
        eventName: event.fragment ? event.fragment.name : log.event || 'UnknownEvent',
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        transactionIndex: log.transactionIndex,
        logIndex: log.logIndex,
        args: this.serializeEventArgs(event.args || {}),
        timestamp: new Date(block.timestamp * 1000),
        confirmed: false,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Error converting event:', error.message);
      throw error;
    }
  }

  serializeEventArgs(args) {
    const result = {};
    
    if (Array.isArray(args)) {
      args.forEach((arg, index) => {
        result[index] = this.serializeValue(arg);
      });
    }
    
    Object.keys(args).forEach(key => {
      if (isNaN(Number(key))) {
        result[key] = this.serializeValue(args[key]);
      }
    });
    
    return result;
  }

  serializeValue(value) {
    try {
      if (value && typeof value === 'object' && value._isBigNumber) {
        return value.toString();
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      if (Array.isArray(value)) {
        return value.map(item => this.serializeValue(item));
      }
      if (typeof value === 'object' && value !== null) {
        const result = {};
        Object.keys(value).forEach(key => {
          try {
            result[key] = this.serializeValue(value[key]);
          } catch (error) {
            result[key] = String(value[key]);
          }
        });
        return result;
      }
      return value;
    } catch (error) {
      return String(value);
    }
  }

  startConfirmationProcess() {
    this.confirmationTimer = setInterval(async () => {
      try {
        const currentBlock = await blockchainProvider.getCurrentBlockNumber();
        const confirmedBlock = currentBlock - config.indexer.confirmations;
        
        if (confirmedBlock > 0) {
          await database.markEventsAsConfirmed(confirmedBlock);
        }
      } catch (error) {
        console.error('Error in confirmation process:', error.message);
      }
    }, 30000);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getHealthStatus() {
    try {
      const currentBlock = await blockchainProvider.getCurrentBlockNumber();
      const syncStates = await database.getAllSyncStates();
      
      return {
        healthy: this.isRunning,
        currentBlock,
        syncStates,
        contractsCount: this.contractListeners.size,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

export const indexer = new BlockchainIndexer();