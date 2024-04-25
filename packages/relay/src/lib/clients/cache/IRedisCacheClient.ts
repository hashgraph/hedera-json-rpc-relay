import type { ICacheClient } from './ICacheClient';

export interface IRedisCacheClient extends ICacheClient {
  disconnect: () => Promise<void>;
}
