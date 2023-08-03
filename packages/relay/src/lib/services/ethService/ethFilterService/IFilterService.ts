export interface IFilterService {
  uninstallFilter(filterId: string, requestId?: string): Promise<boolean>;
}
