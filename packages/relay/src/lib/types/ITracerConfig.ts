// SPDX-License-Identifier: Apache-2.0

export interface ICallTracerConfig {
  onlyTopCall?: boolean;
}

export interface IOpcodeLoggerConfig {
  enableMemory?: boolean;
  disableStack?: boolean;
  disableStorage?: boolean;
}

export type ITracerConfig = ICallTracerConfig | IOpcodeLoggerConfig;
