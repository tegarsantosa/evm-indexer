export const errorHandler = (err, req, res, next) => {
  console.error('API Error:', err);

  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.message
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      error: 'Invalid ID format'
    });
  }

  res.status(500).json({
    success: false,
    error: 'Internal Server Error'
  });
};

export const notFound = (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found'
  });
};

export const validateAddress = (req, res, next) => {
  const address = req.params.address || req.query.contractAddress;
  
  if (address && !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid Ethereum address format'
    });
  }
  
  next();
};

export const validateBlockNumber = (req, res, next) => {
  const { fromBlock, toBlock, blockNumber } = req.query;
  
  if (fromBlock && (isNaN(fromBlock) || parseInt(fromBlock) < 0)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid fromBlock number'
    });
  }
  
  if (toBlock && (isNaN(toBlock) || parseInt(toBlock) < 0)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid toBlock number'
    });
  }
  
  if (blockNumber && (isNaN(blockNumber) || parseInt(blockNumber) < 0)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid block number'
    });
  }
  
  if (fromBlock && toBlock && parseInt(fromBlock) > parseInt(toBlock)) {
    return res.status(400).json({
      success: false,
      error: 'fromBlock cannot be greater than toBlock'
    });
  }
  
  next();
};

export const rateLimiter = (windowMs = 60000, max = 100) => {
  const requests = new Map();
  
  return (req, res, next) => {
    const ip = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requests.has(ip)) {
      requests.set(ip, []);
    }
    
    const ipRequests = requests.get(ip);
    const recentRequests = ipRequests.filter(timestamp => timestamp > windowStart);
    
    if (recentRequests.length >= max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests, please try again later'
      });
    }
    
    recentRequests.push(now);
    requests.set(ip, recentRequests);
    
    next();
  };
};