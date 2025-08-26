import express from 'express';
import { indexer } from '../../indexer/indexer.js';
import { database } from '../../core/database.js';
import { blockchainProvider } from '../../core/blockchain/provider.js';
import { getAllContracts } from '../../config/contracts.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  try {
    const health = await indexer.getHealthStatus();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/sync', async (req, res) => {
  try {
    const syncStates = await database.getAllSyncStates();
    const contracts = getAllContracts();
    const currentBlock = await blockchainProvider.getCurrentBlockNumber();

    const syncStatus = contracts.map(contract => {
      const syncState = syncStates.find(s => s.contractAddress === contract.address);
      return {
        contractAddress: contract.address,
        contractName: contract.name,
        lastProcessedBlock: syncState?.lastProcessedBlock || 0,
        currentBlock,
        blocksBehind: currentBlock - (syncState?.lastProcessedBlock || 0),
        isActive: syncState?.isActive || false,
        lastUpdated: syncState?.lastUpdated || null
      };
    });

    res.json({
      success: true,
      data: {
        currentBlock,
        contracts: syncStatus
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/contracts', async (req, res) => {
  try {
    const contracts = getAllContracts();
    const syncStates = await database.getAllSyncStates();

    const contractsWithStats = await Promise.all(
      contracts.map(async (contract) => {
        const syncState = syncStates.find(s => s.contractAddress === contract.address);
        const eventCount = await database.getCollection('events')
          .countDocuments({ contractAddress: contract.address });

        return {
          address: contract.address,
          name: contract.name,
          startBlock: contract.startBlock || 0,
          events: contract.events,
          lastProcessedBlock: syncState?.lastProcessedBlock || 0,
          eventCount,
          isActive: syncState?.isActive || false,
          lastUpdated: syncState?.lastUpdated || null
        };
      })
    );

    res.json({
      success: true,
      data: contractsWithStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const [
      totalEvents,
      confirmedEvents,
      totalTransactions,
      currentBlock
    ] = await Promise.all([
      database.getCollection('events').countDocuments({}),
      database.getCollection('events').countDocuments({ confirmed: true }),
      database.getCollection('transactions').countDocuments({}),
      blockchainProvider.getCurrentBlockNumber()
    ]);

    const recentEvents = await database.getCollection('events')
      .find({})
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    const recentTransactions = await database.getCollection('transactions')
      .find({})
      .sort({ createdAt: -1 })
      .limit(1)
      .toArray();

    res.json({
      success: true,
      data: {
        currentBlock,
        events: {
          total: totalEvents,
          confirmed: confirmedEvents,
          pending: totalEvents - confirmedEvents
        },
        transactions: {
          total: totalTransactions
        },
        lastActivity: {
          lastEvent: recentEvents[0]?.createdAt || null,
          lastTransaction: recentTransactions[0]?.createdAt || null
        }
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;