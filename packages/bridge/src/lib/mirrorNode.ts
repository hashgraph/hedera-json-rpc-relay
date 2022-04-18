import Axios, { AxiosInstance } from 'axios';
import { predefined as errors } from './errors';

class MirrorNode {
  private client: AxiosInstance;

  public baseUrl: string;

  protected createAxiosClient(
    baseUrl: string
  ): AxiosInstance {
    return Axios.create({
      baseURL: baseUrl,
      responseType: 'json' as const,
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 10 * 1000
    });
  }

  constructor(baseUrl: string) {
    if (!baseUrl.match(/^https?:\/\//)) {
      baseUrl = `https://${baseUrl}`;
    }

    if (!baseUrl.match(/\/$/)) {
      baseUrl = `${baseUrl}/`;
    }

    baseUrl = `${baseUrl}api/v1/`;

    this.baseUrl = baseUrl;
    this.client = this.createAxiosClient(baseUrl);
  }

  async request(path: string): Promise<any> {
    try {
      const response = await this.client.get(path);
      return response.data;
    } catch (error) {
      this.handleError(error);
    }
    return {};
  }

  handleError(error: any) {
    throw errors['INTERNAL_ERROR'];
  }

  async getTransactionByHash(hash: string): Promise<any> {
    return this.request(`contracts/results/${hash}`);
  }

  // TODO: mirror node method is not yet implemented
  async getBlockByNumber(blockNumber: string): Promise<any> {
    return this.request(`blocks/${blockNumber}`);
  }
}

export default new MirrorNode(process.env.MIRROR_NODE_URL || '');