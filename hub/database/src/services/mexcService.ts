type DepositAddressResponse = {
  address: string;
};

type DepositHistoryRequest = {
  coin?: string;
  limit?: number;
};

type CurrencyConfig = {
  currency: string;
  networks: string[];
};

class MexcService {
  initialized: boolean;

  constructor() {
    this.initialized = false;
  }

  async initialize(): Promise<void> {
    this.initialized = true;
  }

  async getDepositAddress(currency: string): Promise<DepositAddressResponse> {
    return {
      address: `test_${currency}_${Date.now()}`,
    };
  }

  async createListenKey(): Promise<string> {
    return `listen_${Date.now()}`;
  }

  connectWebSocket(_listenKey: string, _onMessage?: (message: unknown) => void): never {
    throw new Error("MEXC WebSocket not configured in this environment");
  }

  disconnectWebSocket(_listenKey?: string): null {
    return null;
  }

  async getDepositHistory(_request?: DepositHistoryRequest): Promise<unknown[]> {
    return [];
  }

  async processDepositNotification(_message?: unknown): Promise<null> {
    return null;
  }

  async getCurrencyConfig(currency: string): Promise<CurrencyConfig> {
    return {
      currency,
      networks: [],
    };
  }
}

export default MexcService;
