import { AlovaGlobalStorage, AlovaMethodConfig, AlovaOptions, MethodRequestConfig, RequestBody } from '~/typings';
import Method, { typeDelete, typeGet, typeHead, typeOptions, typePatch, typePost, typePut } from './Method';
import globalLocalStorage from './predefine/globalLocalStorage';
import { newInstance } from './utils/helper';
import { trueValue } from './utils/variables';

type AlovaMethodCreateConfig<R, T, RC, RH> = Partial<MethodRequestConfig> & AlovaMethodConfig<R, T, RC, RH>;

export const alovas = [] as Alova<any, any, any, any, any>[];
const defaultAlovaOptions = {
  /**
   * GET请求默认缓存5分钟（300000毫秒），其他请求默认不缓存
   */
  localCache: {
    [typeGet]: 300000
  },

  /**
   * 共享请求默认为true
   */
  shareRequest: trueValue
};

let idCounter = 0;
export default class Alova<S, E, RC, RE, RH> {
  public options: AlovaOptions<S, E, RC, RE, RH>;
  public id = ++idCounter + '';
  public storage: AlovaGlobalStorage;
  constructor(options: AlovaOptions<S, E, RC, RE, RH>) {
    // 如果storage未指定，则默认使用localStorage
    this.storage = options.storageAdapter || globalLocalStorage();

    // 合并默认options
    this.options = {
      ...defaultAlovaOptions,
      ...options
    };
  }
  Get<R, T = unknown>(url: string, config?: AlovaMethodCreateConfig<R, T, RC, RH>) {
    return newInstance(Method<S, E, R, T, RC, RE, RH>, typeGet, this, url, config);
  }
  Post<R, T = unknown>(url: string, data: RequestBody = {}, config?: AlovaMethodCreateConfig<R, T, RC, RH>) {
    return newInstance(Method<S, E, R, T, RC, RE, RH>, typePost, this, url, config, data);
  }
  Delete<R, T = unknown>(url: string, data: RequestBody = {}, config?: AlovaMethodCreateConfig<R, T, RC, RH>) {
    return newInstance(Method<S, E, R, T, RC, RE, RH>, typeDelete, this, url, config, data);
  }
  Put<R, T = unknown>(url: string, data: RequestBody = {}, config?: AlovaMethodCreateConfig<R, T, RC, RH>) {
    return newInstance(Method<S, E, R, T, RC, RE, RH>, typePut, this, url, config, data);
  }
  Head<R, T = unknown>(url: string, config?: AlovaMethodCreateConfig<R, T, RC, RH>) {
    return newInstance(Method<S, E, R, T, RC, RE, RH>, typeHead, this, url, config);
  }
  Patch<R, T = unknown>(url: string, data: RequestBody = {}, config?: AlovaMethodCreateConfig<R, T, RC, RH>) {
    return newInstance(Method<S, E, R, T, RC, RE, RH>, typePatch, this, url, config, data);
  }
  Options<R, T = unknown>(url: string, config?: AlovaMethodCreateConfig<R, T, RC, RH>) {
    return newInstance(Method<S, E, R, T, RC, RE, RH>, typeOptions, this, url, config);
  }
}
