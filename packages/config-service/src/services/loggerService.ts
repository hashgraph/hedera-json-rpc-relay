import { RelayEnvs } from './relayConfigs';
import { ConfigService } from './';

// TODO:
//  - use pino as a logger
//  - mask up the private keys and other sensitive information
//  - use TS types
export class LoggerService {
  static printEnvs() {
    for (let obj in RelayEnvs) {
      if (ConfigService.get(obj) === undefined) continue;
      console.log(this.maskUpEnv(obj, ConfigService.get(obj)));
    }
  }

  static maskUpEnv(envName, envValue) {
    return `${envName} = ${envValue}`;
  }
}
