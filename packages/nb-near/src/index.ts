import axios, { AxiosInstance } from 'axios';
import { validators } from 'near-api-js';
export type {
  AccountView,
  BlockHeader,
  BlockResult,
  EpochValidatorInfo,
  Provider,
} from 'near-api-js/lib/providers/provider.js';

export const validatorApi = validators;

export class RPC {
  request: AxiosInstance;

  constructor(baseURL: string) {
    this.request = axios.create({ baseURL });
  }

  async callFunction(
    contractId: string,
    methodName: string,
    args: string,
    blockId?: number | string,
  ) {
    const params = {
      account_id: contractId,
      args_base64: args,
      method_name: methodName,
      request_type: 'call_function',
    };

    if (blockId) {
      return this.query({ ...params, block_id: blockId });
    }

    return this.query({ ...params, finality: 'final' });
  }

  decodeResult<T>(result: string): T {
    return JSON.parse(Buffer.from(result, 'base64').toString());
  }

  encodeArgs(args: unknown) {
    return Buffer.from(JSON.stringify(args)).toString('base64');
  }

  async query(params: unknown, method = 'query') {
    return this.request.post('', {
      id: 'near',
      jsonrpc: '2.0',
      method,
      params,
    });
  }

  async viewAccount(accountId: string, blockId: number | string) {
    return this.query({
      account_id: accountId,
      block_id: blockId,
      request_type: 'view_account',
    });
  }
}
