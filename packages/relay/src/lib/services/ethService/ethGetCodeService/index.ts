import { MirrorNodeClient } from '../../../clients';
import path from 'path';
import { readFileSync } from 'fs';
import { Logger } from 'pino';
import constants from '../../../constants';
import { EthImpl } from '../../../eth';

export class EthGetCodeService {
  constructor(private logger: Logger) {}

  public async execute(address: string): Promise<string> {
    try {
      if (!this.isSupported(address)) {
        return '';
      }
      const filePath = path.join(__dirname, 'config', `precompile.bytecode`);
      const result = readFileSync(filePath.replace('/dist/', '/src/'), 'utf-8');
      this.logger.trace(`Result for address ${address}: ${result}`);
      return result;
    } catch (e: any) {
      this.logger.trace(`Error occurred for address ${address}`);
      this.logger.trace(e.message);
      return '';
    }
  }

  private isSupported(address: string) {
    return address === EthImpl.iHTSAddress;
  }
}
