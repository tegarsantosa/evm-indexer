import express from 'express';
import { database } from '../../core/database.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      contractAddress,
      eventName,
      fromBlock,
      toBlock,
      confirmed,
      limit = 100,
      page = 1
    } = req.query;

    const filter = {};
    const options = {
      limit: Math.min(parseInt(limit), 1000),
      skip: (parseInt(page) - 1) * Math.min(parseInt(limit), 1000)
    };

    if (contractAddress) {
      filter.contractAddress = contractAddress;
    }

    if (eventName) {
      filter.eventName = eventName;
    }

    if (fromBlock || toBlock) {
      filter.blockNumber = {};
      if (fromBlock) filter.blockNumber.$gte = parseInt(fromBlock);
      if (toBlock) filter.blockNumber.$lte = parseInt(toBlock);
    }

    if (confirmed !== undefined) {
      filter.confirmed = confirmed === 'true';
    }

    const events = await database.getEvents(filter, options);
    const total = await database.getCollection('events').countDocuments(filter);

    res.json({
      success: true,
      data: {
        events,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
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

router.get('/range', async (req, res) => {
  try {
    const { contractAddress, fromBlock, toBlock } = req.query;

    if (!contractAddress || !fromBlock || !toBlock) {
      return res.status(400).json({
        success: false,
        error: 'contractAddress, fromBlock, and toBlock are required'
      });
    }

    const events = await database.getEventsInRange(
      contractAddress,
      parseInt(fromBlock),
      parseInt(toBlock)
    );

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const events = await database.getEvents(
      {},
      { 
        limit: Math.min(parseInt(limit), 500),
        sort: { blockNumber: -1, logIndex: -1 }
      }
    );

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/contract/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { limit = 100, eventName } = req.query;

    const filter = { contractAddress: address };
    if (eventName) {
      filter.eventName = eventName;
    }

    const events = await database.getEvents(
      filter,
      { 
        limit: Math.min(parseInt(limit), 1000),
        sort: { blockNumber: -1, logIndex: -1 }
      }
    );

    res.json({
      success: true,
      data: events
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;