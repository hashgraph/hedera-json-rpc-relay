import { MirrorNodeClient } from '../../../clients';
import { calculateOffset, converter, hexToDecimal, stringToIntHex256, toSnakeCase } from './utils/converter';
import { keccak256 } from 'ethers';
import { getStorageLayout, StorageSlot } from './utils/artifactParser';
import { Logger } from 'pino';
import { HashZero } from '@ethersproject/constants';
import constants from '../../../constants';
import { EthImpl } from '../../../eth';

export class EthGetStorageAtService {
  private static readonly MAX_ELEMENTS = 1000;
  private static readonly BALANCES_ARRAY = ['holders', 'balances'];
  constructor(
    private mirrorNodeClient: MirrorNodeClient,
    private logger: Logger,
  ) {}

  public async execute(address: string, slotNumber: string) {
    try {
      if (!(await this.isSupported(address))) {
        return '';
      }

      const type = (await this.mirrorNodeClient.isTokenFungible(address)) ? 'fungible' : 'nonFungible';
      const allSlots = getStorageLayout(type);

      // Slot === keccaked value (long strings, maps, arrays)
      const keccakedSlot = await this.guessSlotAndOffsetFromKeccakedNumber(slotNumber, allSlots);
      if (keccakedSlot) {
        const kecRes = `0x${(await this.getComplexElement(keccakedSlot.slot, address, keccakedSlot.offset)).padStart(
          64,
          '0',
        )}`;
        this.logger.error(`Get storage ${address} slot: ${slotNumber}, result: ${kecRes}`);
        return kecRes;
      }

      // Slot === decimal number (primitives)
      const decimalSlotNumber = hexToDecimal(slotNumber);
      const slots = allSlots.filter((search) => search.slot === decimalSlotNumber);
      slots.sort((first, second) => first.offset - second.offset);
      let result = '';
      for (let slotOffsetIndex = 0; slotOffsetIndex < slots.length; slotOffsetIndex++) {
        result = `${result}${await this.get(slots[slotOffsetIndex], address)}`;
      }
      this.logger.error(`Get storage ${address} slot: ${slotNumber}, result: 0x${result.padStart(64, '0')}`);

      return `0x${result.padStart(64, '0')}`;
    } catch (e: any) {
      this.logger.error(`Error occurred when extracting a storage for an address ${address}: ${e.message}`);
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

  private async guessSlotAndOffsetFromKeccakedNumber(input: string, slots: StorageSlot[]) {
    for (const slot of slots) {
      if (slot.type !== 't_string_storage' && !EthGetStorageAtService.BALANCES_ARRAY.includes(slot.label)) {
        continue;
      }
      const baseKeccak = keccak256(`0x${stringToIntHex256(slot.slot)}`);
      try {
        const offset = calculateOffset(baseKeccak, input);
        if (offset === null || offset > EthGetStorageAtService.MAX_ELEMENTS) {
          continue;
        }
        return { slot, offset };
      } catch (error) {
        this.logger.trace(`Offset difference could not be calculated for pair ${baseKeccak} and ${input}.`);
      }
    }

    return null;
  }

  private async getComplexElement(slot: any, address: string, offset: number): Promise<string> {
    if (EthGetStorageAtService.BALANCES_ARRAY.includes(slot.label)) {
      const result: { balances: { account: string; balance: number }[] } =
        await this.mirrorNodeClient.getTokenBalances(address);
      const balances = result.balances;
      if (slot.label === 'balances') {
        return stringToIntHex256(`${balances[offset]?.balance ?? 0}`);
      }
      if (!balances[offset]?.account) {
        return HashZero.slice(2);
      }
      const account: { evm_address: string } = await this.mirrorNodeClient.getAccount(balances[offset].account);
      return account.evm_address.slice(2);
    }
    if (converter(slot.type, offset)) {
      const tokenData = await this.mirrorNodeClient.getToken(address);
      return converter(slot.type, offset)(tokenData[toSnakeCase(slot.label)]);
    }
    return '0';
  }

  private async get(slot: StorageSlot, address: string): Promise<string> {
    if (EthGetStorageAtService.BALANCES_ARRAY.includes(slot.label)) {
      const result: { balances: { account: string; balance: number }[] } =
        await this.mirrorNodeClient.getTokenBalances(address);
      return stringToIntHex256(`${result.balances.length}`);
    }
    const tokenData = await this.mirrorNodeClient.getToken(address);
    const value = tokenData[toSnakeCase(slot.label)];
    if (!converter(slot.type) || !value) {
      return HashZero.slice(2);
    }

    return converter(slot.type)(value);
  }
}
