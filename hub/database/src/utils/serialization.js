// Helper function to serialize BigInt values for JSON responses
export const serializeBigInt = (obj) => {
  return JSON.parse(JSON.stringify(obj, (key, value) =>
    typeof value === 'bigint' ? value.toString() : value
  ));
};

// Middleware to automatically serialize BigInt values in responses
export const bigIntSerializationMiddleware = (req, res, next) => {
  const originalJson = res.json;
  
  res.json = function(obj) {
    return originalJson.call(this, serializeBigInt(obj));
  };
  
  next();
};