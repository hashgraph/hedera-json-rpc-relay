import { RedisMemoryServer } from 'redis-memory-server';
import { Logger, P } from 'pino';

export class RedisInMemoryServer {
  private mockedRedisServer: RedisMemoryServer;
  private logger: Logger;
  private host: string;
  private port: number;
  private portToRunOn: number;

  constructor(logger: Logger, portToRunOn: number) {
    this.logger = logger;
    this.portToRunOn = portToRunOn;
  }

  async start() {
    this.mockedRedisServer = new RedisMemoryServer({
      instance: {
        port: this.portToRunOn,
      },
    });
    // let started;
    // try {
    //     started = await this.mockedRedisServer.start();
    // } catch(e) {
    //     this.logger.error(e)
    // }

    this.port = await this.mockedRedisServer.getPort();
    this.host = await this.mockedRedisServer.getHost();
    //console.log(this.mockedRedisServer.getInstanceInfo());
    //console.log(started);
  }

  async getPort(): Promise<number> {
    return this.port;
  }

  async getHost(): Promise<string> {
    return this.host;
  }

  getInstanceInfo() {
    return this.mockedRedisServer.getInstanceInfo();
  }

  async stop() {
    this.logger.info('Stopping Redis in-memory server....');
    const stopped = await this.mockedRedisServer.stop();
    if (stopped) {
      this.logger.info('Stopped Redis in-memory server sucessfully.');
    } else {
      this.logger.info('Couldnt stop Redis in-memory server sucessfully.');
    }
  }
}
