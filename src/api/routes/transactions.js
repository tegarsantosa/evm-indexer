import express from 'express';
import { database } from '../../core/database.js';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const {
      fromBlock,
      toBlock,
      from,
      to,
      limit = 100,
      page = 1
    } = req.query;

    const filter = {};
    const options = {
      limit: Math.min(parseInt(limit), 1000),
      skip: (parseInt(page) - 1) * Math.min(parseInt(limit), 1000),
      sort: { blockNumber: -1, transactionIndex: -1 }
    };

    if (fromBlock || toBlock) {
      filter.blockNumber = {};
      if (fromBlock) filter.blockNumber.$gte = parseInt(fromBlock);
      if (toBlock) filter.blockNumber.$lte = parseInt(toBlock);
    }

    if (from) {
      filter.from = from.toLowerCase();
    }

    if (to) {
      filter.to = to.toLowerCase();
    }

    const transactions = await database.getCollection('transactions')
      .find(filter)
      .sort(options.sort)
      .skip(options.skip)
      .limit(options.limit)
      .toArray();

    const total = await database.getCollection('transactions').countDocuments(filter);

    res.json({
      success: true,
      data: {
        transactions,
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

router.get('/hash/:hash', async (req, res) => {
  try {
    const { hash } = req.params;
    
    const transaction = await database.getCollection('transactions')
      .findOne({ hash: hash.toLowerCase() });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/block/:blockNumber', async (req, res) => {
  try {
    const { blockNumber } = req.params;
    
    const transactions = await database.getTransactionsByBlock(parseInt(blockNumber));

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/address/:address', async (req, res) => {
  try {
    const { address } = req.params;
    const { type = 'all', limit = 100 } = req.query;

    let filter = {};
    
    if (type === 'from') {
      filter.from = address.toLowerCase();
    } else if (type === 'to') {
      filter.to = address.toLowerCase();
    } else {
      filter.$or = [
        { from: address.toLowerCase() },
        { to: address.toLowerCase() }
      ];
    }

    const transactions = await database.getCollection('transactions')
      .find(filter)
      .sort({ blockNumber: -1, transactionIndex: -1 })
      .limit(Math.min(parseInt(limit), 1000))
      .toArray();

    res.json({
      success: true,
      data: transactions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;