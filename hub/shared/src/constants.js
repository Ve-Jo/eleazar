// Shared constants across services
export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500
};

export const SERVICES = {
  DATABASE: 'database',
  RENDERING: 'rendering'
};

export const DEFAULT_PORTS = {
  DATABASE: 3001,
  RENDERING: 3002
};