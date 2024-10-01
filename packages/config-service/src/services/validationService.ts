import { RelayEnvsTypes } from './relayConfigs';

export class ValidationService {
  // TODO: implement
  static startUp(envs) {
    return envs;
  }

  static typeCasting(envs) {
    // TODO: cast each env variable to a proper type defined in RelayEnvsTypes
    //  this is PoC, will add types and adequate loop iterations
    let pairs = {};
    Object.entries(RelayEnvsTypes.TYPES).map((envInfo) => {
      // TODO: if the prop is missing in the current .env
      //  we should populate default values for some env variables, right?
      if (!envs.hasOwnProperty(envInfo[0])) {
        return;
      }

      switch (envInfo[1]) {
        case 'string':
          pairs[envInfo[0]] = envs[envInfo[0]];
          break;
        case 'number':
          pairs[envInfo[0]] = Number(envs[envInfo[0]]);
          break;
        case 'boolean':
          pairs[envInfo[0]] = envs[envInfo[0]] === 'true';
          break;
        case 'Array<number>':
          // @ts-ignore
          pairs[envInfo[0]] = envs[envInfo[0]]
            .replace('[', '')
            .replace(']', '')
            .split()
            .map((el) => Number(el));
          break;
      }
    });

    return pairs;
  }
}
