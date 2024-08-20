import { MirrorNodeClient } from '../../../clients';
import path from 'path';
import { readFileSync } from 'fs';
import { Logger } from 'pino';
import constants from '../../../constants';
import { EthImpl } from '../../../eth';

export class EthGetCodeService {
  constructor(
    private mirrorNodeClient: MirrorNodeClient,
    private logger: Logger,
  ) {}

  public async execute(address: string): Promise<string> {
    try {
      if (!(await this.isSupported(address))) {
        return '';
      }
      const type = (await this.mirrorNodeClient.isTokenFungible(address)) ? 'fungible' : 'nonFungible';
      const filePath = path.join(__dirname, 'config', `${type.toLowerCase()}.bytecode`);
      const result = readFileSync(filePath.replace('/dist/', '/src/'), 'utf-8');
      this.logger.trace(`Result for address ${address}: ${result}`);
      return result;
    } catch (e: any) {
      this.logger.trace(`Error occurred for address ${address}`);
      this.logger.trace(e.message);
      return '';
    }
  }

  private async isSupported(address: string) {
    const resolved = await this.mirrorNodeClient.resolveEntityType(
      address,
      [constants.TYPE_TOKEN],
      EthImpl.ethGetStorageAt,
    );
    return resolved !== null && resolved.type === constants.TYPE_TOKEN;
  }
}
