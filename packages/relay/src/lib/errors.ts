export class JsonRpcError {
  public code: number;
  public message: string;
  public name: string;

  constructor(args: { name: string, code: number, message: string }) {
    this.code = args.code;
    this.name = args.name;
    this.message = args.message;
  }
}

export const predefined = {
  'NO_MINING_WORK': new JsonRpcError({
    name: 'No mining work',
    code: -32000,
    message: 'No mining work available yet'
  }),
  'INVALID_REQUEST': new JsonRpcError({
    name: 'Invalid request',
    code: -32600,
    message: 'Invalid request'
  }),
  'METHOD_NOT_FOUND': new JsonRpcError({
    name: 'Method not found',
    code: -32601,
    message: 'Unsupported JSON-RPC method'
  }),
  'INVALID_PARAMETERS': new JsonRpcError({
    name: 'Invalid parameters',
    code: -32602,
    message: 'Invalid params'
  }),
  'INTERNAL_ERROR': new JsonRpcError({
    name: 'Internal error',
    code: -32603,
    message: 'Unknown error invoking RPC'
  }),
  'PARSE_ERROR': new JsonRpcError({
    name: 'Parse error',
    code: -32700,
    message: 'Unable to parse JSON'
  })
};