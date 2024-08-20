import { readFileSync } from 'fs';
import path from 'path';

export interface StorageSlot {
  slot: string;
  offset: number;
  type: string;
  label: string;
}

export const getStorageLayout = (type: string): StorageSlot[] => {
  const contractName = `${type.charAt(0).toUpperCase() + type.slice(1)}Token`;
  const filePath = path.join(__dirname, '..', 'config', `${type.toLowerCase()}.artifacts.json`);
  const result: { output: { contracts: any } } = JSON.parse(readFileSync(filePath.replace('/dist/', '/src/'), 'utf-8'));
  const contracts: { storageLayout: { storage: any[] } } =
    result.output.contracts[`contracts/${contractName}.sol`][contractName];
  const artifacts = contracts.storageLayout.storage;

  return artifacts.map((object: any): StorageSlot => {
    return {
      slot: object.slot,
      offset: object.offset,
      type: object.type,
      label: object.label,
    };
  });
};
