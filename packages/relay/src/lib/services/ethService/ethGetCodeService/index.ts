import path from 'path';
import { readFileSync } from 'fs';
import { Logger } from 'pino';
import { EthImpl } from '../../../eth';

export class EthGetCodeService {
  constructor(private logger: Logger) {}

  public async execute(address: string): Promise<string> {
    if (!this.isSupported(address)) {
      return '';
    }
    const filePath = path.join(__dirname, 'config', `precompile.bytecode`);
    const result = readFileSync(filePath.replace('/dist/', '/src/'), 'utf-8');
    this.logger.trace(`Result for address ${address}: ${result}`);
    return result;
  }

  private isSupported(address: string) {
    return address === EthImpl.iHTSAddress;
  }
}
