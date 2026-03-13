class MexcService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
  }

  async getDepositAddress(currency) {
    return {
      address: `test_${currency}_${Date.now()}`,
    };
  }

  async createListenKey() {
    return `listen_${Date.now()}`;
  }

  connectWebSocket() {
    throw new Error("MEXC WebSocket not configured in this environment");
  }

  async getDepositHistory() {
    return [];
  }

  async processDepositNotification() {
    return null;
  }
}

export default MexcService;
