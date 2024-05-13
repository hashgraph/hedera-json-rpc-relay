import { IOpcode } from './IOpcode';

export interface IOpcodesResponse {
  address?: string;
  contract_id?: string;
  gas?: number;
  failed?: boolean;
  return_value?: string;
  opcodes?: IOpcode[];
}
