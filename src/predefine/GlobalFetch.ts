import alovaError from '@/utils/alovaError';
import { isSpecialRequestBody, isString } from '@/utils/helper';
import {
  JSONStringify,
  clearTimeoutTimer,
  falseValue,
  len,
  promiseReject,
  promiseThen,
  setTimeoutFn,
  trueValue
} from '@/utils/variables';
import { Method, RequestElements } from '~/typings';
import { FetchRequestInit } from '~/typings/globalfetch';

const isBodyData = (data: any): data is BodyInit => isString(data) || isSpecialRequestBody(data);
export default function GlobalFetch() {
  return function (elements: RequestElements, method: Method<any, any, any, any, FetchRequestInit, Response, Headers>) {
    // 设置了中断时间，则在指定时间后中断请求
    const adapterConfig = method.config;
    const timeout = adapterConfig.timeout || 0;
    const ctrl = new AbortController();
    let abortTimer: NodeJS.Timeout | number;
    let isTimeout = falseValue;
    if (timeout > 0) {
      abortTimer = setTimeoutFn(() => {
        isTimeout = trueValue;
        ctrl.abort();
      }, timeout);
    }

    const data = elements.data;
    const fetchPromise = fetch(elements.url, {
      ...adapterConfig,
      method: elements.type,
      signal: ctrl.signal,
      body: isBodyData(data) ? data : JSONStringify(data)
    });

    return {
      response: () =>
        promiseThen(
          fetchPromise,
          response => {
            // 请求成功后清除中断处理
            clearTimeoutTimer(abortTimer);

            // Response的Readable只能被读取一次，需要克隆才可重复使用
            return response.clone();
          },
          err => promiseReject(alovaError(isTimeout ? 'fetchError: network timeout' : err.message))
        ),

      // headers函数内的then需捕获异常，否则会导致内部无法获取到正确的错误对象
      headers: () =>
        promiseThen(
          fetchPromise,
          ({ headers }) => headers,
          () => ({} as Headers)
        ),
      // 因nodeFetch库限制，这块代码无法进行单元测试，但已在浏览器中通过测试
      /* c8 ignore start */
      onDownload: (cb: (total: number, loaded: number) => void) => {
        promiseThen(fetchPromise, response => {
          const { headers, body } = response.clone();
          const reader = body?.getReader().read();
          const total = Number(headers.get('Content-Length') || headers.get('content-length') || 0);
          if (total <= 0) {
            return;
          }
          let loaded = 0;
          const progressTimer = setInterval(() => {
            reader &&
              promiseThen(reader, ({ done, value = new Uint8Array() }) => {
                done && clearInterval(progressTimer);
                loaded += len(value);
                cb(total, loaded);
              });
          }, 0);
        });
      },
      /* c8 ignore start */
      abort: () => {
        ctrl.abort();
        clearTimeoutTimer(abortTimer);
      }
    };
  };
}
