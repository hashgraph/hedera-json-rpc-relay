import { GlobalConfig } from './globalConfig';

export class LoggerService {
  public static sensitiveFields = [
    GlobalConfig.ENTRIES.OPERATOR_KEY_MAIN.envName,
    GlobalConfig.ENTRIES.OPERATOR_KEY_ETH_SENDRAWTRANSACTION.envName,
    GlobalConfig.ENTRIES.GITHUB_TOKEN.envName,
  ];

  static maskUpEnv(envName, envValue) {
    if (this.sensitiveFields.indexOf(envName) > -1) {
      return `${envName} = **********${envValue?.slice(-4)}`;
    }

    return `${envName} = ${envValue}`;
  }
}
