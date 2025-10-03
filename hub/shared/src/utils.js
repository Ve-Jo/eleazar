// Shared utility functions
export function formatError(error, isDevelopment = false) {
  return {
    error: 'Internal server error',
    message: isDevelopment ? error.message : 'Something went wrong',
    timestamp: new Date().toISOString()
  };
}

export function validateRequired(data, requiredFields) {
  const missing = requiredFields.filter(field => !data[field]);
  if (missing.length > 0) {
    throw new Error(`Missing required fields: ${missing.join(', ')}`);
  }
}

export function createHealthResponse(serviceName, version = '1.0.0') {
  return {
    status: 'healthy',
    service: serviceName,
    version,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  };
}