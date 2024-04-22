import { RedisMemoryServer } from 'redis-memory-server';
import { Logger } from 'pino';
import { RedisInstanceDataT } from 'redis-memory-server/lib/RedisMemoryServer';

export class RedisInMemoryServer {
  /**
   * The instance of the in memory Redis server
   *
   * @private
   */
  private inMemoryRedisServer: RedisMemoryServer;

  /**
   * The logger used for logging all output from this class.
   * @private
   */
  private logger: Logger;

  /**
   * The host of the in memory server.
   * @private
   */
  private host: string;

  /**
   * The port of the in memory server.
   * @private
   */
  private port: number;

  /**
   * The desired port to run on.
   * @private
   */
  private portToRunOn: number;

  constructor(logger: Logger, portToRunOn: number) {
    this.logger = logger;
    this.portToRunOn = portToRunOn;
  }

  async start(): Promise<void> {
    this.inMemoryRedisServer = new RedisMemoryServer({
      instance: {
        port: this.portToRunOn,
      },
    });

    this.port = await this.inMemoryRedisServer.getPort();
    this.host = await this.inMemoryRedisServer.getHost();
  }

  async getPort(): Promise<number> {
    return this.port;
  }

  async getHost(): Promise<string> {
    return this.host;
  }

  getInstanceInfo(): false | RedisInstanceDataT {
    return this.inMemoryRedisServer.getInstanceInfo();
  }

  async stop(): Promise<void> {
    this.logger.info('Stopping Redis in-memory server....');
    const stopped = await this.inMemoryRedisServer.stop();
    if (stopped) {
      this.logger.info('Stopped Redis in-memory server sucessfully.');
    } else {
      this.logger.info('Couldnt stop Redis in-memory server sucessfully.');
    }
  }
}
