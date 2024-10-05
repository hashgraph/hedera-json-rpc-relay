import { GlobalConfig } from './globalConfig';

export class ValidationService {
  static startUp(envs: NodeJS.Dict<string>) {
    // make sure that mandatory fields are passed
    Object.entries(GlobalConfig.ENTRIES).forEach(([entryName, entryInfo]) => {
      if (entryInfo.required) {
        if (!envs[entryName]) {
          throw new Error(`${entryName} is a mandatory and the relay can not operate without its value.`);
        }

        if (entryInfo.type === 'number' && isNaN(Number(envs[entryName]))) {
          throw new Error(`${entryName} must be a valid number.`);
        }
      }
    });

    // make sure that if OPERATOR_KEY_FORMAT is not specified, the provided OPERATOR_KEY_MAIN is in the DER format
    if (
      envs[GlobalConfig.ENTRIES.OPERATOR_KEY_MAIN.envName] &&
      !envs[GlobalConfig.ENTRIES.OPERATOR_KEY_FORMAT.envName] &&
      // @ts-ignore
      !envs[GlobalConfig.ENTRIES.OPERATOR_KEY_MAIN.envName].match(/^[0-9a-f]{96}$/)
    ) {
      throw new Error(
        `When ${GlobalConfig.ENTRIES.OPERATOR_KEY_FORMAT.envName} is not specified, the ${GlobalConfig.ENTRIES.OPERATOR_KEY_MAIN.envName} must be in DER format.`,
      );
    }

    // make sure that HBAR_RATE_LIMIT_TINYBAR is more than HBAR_DAILY_LIMIT_BASIC, HBAR_DAILY_LIMIT_EXTENDED, HBAR_DAILY_LIMIT_PRIVILEGED
    if (
      envs[GlobalConfig.ENTRIES.HBAR_RATE_LIMIT_TINYBAR.envName] &&
      envs[GlobalConfig.ENTRIES.HBAR_DAILY_LIMIT_BASIC.envName] &&
      envs[GlobalConfig.ENTRIES.HBAR_DAILY_LIMIT_EXTENDED.envName] &&
      envs[GlobalConfig.ENTRIES.HBAR_DAILY_LIMIT_PRIVILEGED.envName]
    ) {
      for (const field of [
        GlobalConfig.ENTRIES.HBAR_DAILY_LIMIT_BASIC.envName,
        GlobalConfig.ENTRIES.HBAR_DAILY_LIMIT_EXTENDED.envName,
        GlobalConfig.ENTRIES.HBAR_DAILY_LIMIT_PRIVILEGED.envName,
      ]) {
        if (Number(envs[GlobalConfig.ENTRIES.HBAR_RATE_LIMIT_TINYBAR.envName]) < Number(envs[field])) {
          throw new Error(`${GlobalConfig.ENTRIES.HBAR_RATE_LIMIT_TINYBAR.envName} can not be less than ${field}`);
        }
      }
    }
  }

  static typeCasting(envs: NodeJS.Dict<string>): NodeJS.Dict<any> {
    const typeCastedEnvs: NodeJS.Dict<any> = {};

    Object.entries(GlobalConfig.ENTRIES).forEach(([entryName, entryInfo]) => {
      if (!envs.hasOwnProperty(entryName)) {
        if (entryInfo.defaultValue) {
          typeCastedEnvs[entryName] = entryInfo.defaultValue;
        }
        return;
      }

      switch (entryInfo.type) {
        case 'number':
          typeCastedEnvs[entryName] = Number(envs[entryName]);
          break;
        case 'boolean':
          typeCastedEnvs[entryName] = envs[entryName] === 'true';
          break;
        default:
          // handle "string" and stringified array type
          typeCastedEnvs[entryName] = envs[entryName];
      }
    });

    return typeCastedEnvs;
  }
}
