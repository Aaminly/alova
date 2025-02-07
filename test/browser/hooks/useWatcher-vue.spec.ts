import { getAlovaInstance, Result, untilCbCalled } from '#/utils';
import { setCache, useWatcher } from '@/index';
import Method from '@/Method';
import VueHook from '@/predefine/VueHook';
import { getResponseCache } from '@/storage/responseCache';
import { key } from '@/utils/helper';
import { computed, reactive, ref } from 'vue';

describe('use useWatcher hook to send GET with vue', function () {
  test('should specify at least one watching state', () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    expect(() => useWatcher(() => alova.Get<Result>('/unit-test'), [])).toThrowError();
  });
  test('should send request when change value', done => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const mutateStr = ref('a');
    let currentGet: Method;
    const { loading, data, downloading, error, onSuccess } = useWatcher(() => {
      const get = (currentGet = alova.Get('/unit-test', {
        params: { num: mutateNum.value, str: mutateStr.value },
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        },
        transformData: (result: Result) => result.data,
        localCache: 100 * 1000
      }));
      return get;
    }, [mutateNum, mutateStr]);
    const initialData = () => {
      expect(loading.value).toBeFalsy();
      expect(data.value).toBeUndefined();
      expect(downloading.value).toEqual({ total: 0, loaded: 0 });
      expect(error.value).toBeUndefined();
    };
    // 一开始和两秒后数据都没有改变，表示监听状态未改变时不会触发请求
    initialData();
    setTimeout(() => {
      initialData();
      // 当监听状态改变时触发请求，且两个状态都变化只会触发一次请求
      mutateNum.value = 1;
      mutateStr.value = 'b';
    }, 1000);
    const mockCallback = jest.fn(() => {});
    onSuccess(mockCallback);

    const successTimesFns = [
      () => {
        expect(loading.value).toBeFalsy();
        expect(data.value.path).toBe('/unit-test');
        expect(data.value.params.num).toBe('1');
        expect(data.value.params.str).toBe('b');
        expect(downloading.value).toEqual({ total: 0, loaded: 0 });
        expect(error.value).toBeUndefined();
        // 缓存有值
        const cacheData = getResponseCache(alova.id, key(currentGet));
        expect(cacheData.path).toBe('/unit-test');
        expect(cacheData.params).toEqual({ num: '1', str: 'b' });
        expect(mockCallback.mock.calls.length).toBe(1);
        mutateNum.value = 2;
        mutateStr.value = 'c';
      },
      () => {
        expect(data.value.params.num).toBe('2');
        expect(data.value.params.str).toBe('c');
        const cacheData = getResponseCache(alova.id, key(currentGet));
        expect(cacheData.params).toEqual({ num: '2', str: 'c' });
        expect(mockCallback.mock.calls.length).toBe(2);
        done();
      }
    ];

    // 根据触发次数来运行不同回调函数
    let watchTimes = 0;
    onSuccess(() => {
      successTimesFns[watchTimes]();
      watchTimes++;
    });
  });

  test('should work when receive a method instance', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const mutateStr = ref('a');
    const currentGet = alova.Get('/unit-test', {
      params: { num: mutateNum.value, str: mutateStr.value },
      transformData: (result: Result) => result.data,
      localCache: 0
    });
    const { data, downloading, error, onSuccess } = useWatcher(currentGet, [mutateNum, mutateStr], {
      immediate: true
    });
    const successMockFn = jest.fn();
    onSuccess(successMockFn);

    await untilCbCalled(onSuccess);
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('0');
    expect(data.value.params.str).toBe('a');
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    expect(successMockFn).toBeCalledTimes(1);

    mutateNum.value = 2;
    mutateStr.value = 'c';
    await untilCbCalled(onSuccess);

    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('0');
    expect(data.value.params.str).toBe('a');
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    expect(successMockFn).toBeCalledTimes(2);
  });

  test('should also send request when nest value changed', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateObj = ref({
      num: 0
    });
    const mutateObjReactive = reactive({
      str: ''
    });
    const { loading, data, downloading, error, onSuccess } = useWatcher(
      () =>
        alova.Get('/unit-test', {
          params: { num: mutateObj.value.num, str: mutateObjReactive.str },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 100 * 1000
        }),
      [mutateObj, mutateObjReactive]
    );
    // 一开始和两秒后数据都没有改变，表示监听状态未改变时不会触发请求
    expect(loading.value).toBeFalsy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    // 改变数据触发请求
    mutateObj.value.num = 1;
    await untilCbCalled(onSuccess);
    expect(loading.value).toBeFalsy();
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('');
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    // 再次改变数据，触发请求
    mutateObj.value.num = 2;
    mutateObjReactive.str = 'c';
    await untilCbCalled(onSuccess);
    expect(data.value.params.num).toBe('2');
    expect(data.value.params.str).toBe('c');
  });

  test('should also send request when computed value changed', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const computedStr = computed(() => (mutateNum.value === 0 ? 'str1' : 'str2'));
    const { loading, data, downloading, error, onSuccess } = useWatcher(
      () =>
        alova.Get('/unit-test', {
          params: { str: computedStr.value },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 100 * 1000
        }),
      [computedStr]
    );
    // 一开始和两秒后数据都没有改变，表示监听状态未改变时不会触发请求
    expect(loading.value).toBeFalsy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    // 改变数据触发请求
    mutateNum.value = 1;
    await untilCbCalled(onSuccess);
    expect(loading.value).toBeFalsy();
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.str).toBe('str2');
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    // 再次改变数据，触发请求
    mutateNum.value = 0;
    await untilCbCalled(onSuccess);
    expect(data.value.params.str).toBe('str1');
  });

  test("should send request one time when value change's time less then debounce", done => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const mutateStr = ref('a');
    let currentGet: Method;
    const { loading, data, downloading, error, onSuccess } = useWatcher(
      () => {
        const get = (currentGet = alova.Get('/unit-test', {
          params: { num: mutateNum.value, str: mutateStr.value },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 100 * 1000
        }));
        return get;
      },
      [mutateNum, mutateStr],
      { debounce: 2000 }
    );

    // 在两秒内重新改变状态值，只会触发一次请求
    setTimeout(() => {
      mutateNum.value = 1;
      mutateStr.value = 'b';
      expect(loading.value).toBeFalsy();
      expect(data.value).toBeUndefined();
      expect(downloading.value).toEqual({ total: 0, loaded: 0 });
      expect(error.value).toBeUndefined();
      setTimeout(() => {
        mutateNum.value = 2;
        mutateStr.value = 'c';
        expect(loading.value).toBeFalsy();
        expect(data.value).toBeUndefined();
        expect(downloading.value).toEqual({ total: 0, loaded: 0 });
        expect(error.value).toBeUndefined();
      }, 500);
    }, 500);
    const mockCallback = jest.fn(() => {});
    onSuccess(mockCallback);
    onSuccess(() => {
      expect(loading.value).toBeFalsy();
      expect(data.value.path).toBe('/unit-test');
      expect(data.value.params.num).toBe('2');
      expect(data.value.params.str).toBe('c');
      expect(downloading.value).toEqual({ total: 0, loaded: 0 });
      expect(error.value).toBeUndefined();
      // 缓存有值
      const cacheData = getResponseCache(alova.id, key(currentGet));
      expect(cacheData.path).toBe('/unit-test');
      expect(cacheData.params).toEqual({ num: '2', str: 'c' });
      expect(mockCallback.mock.calls.length).toBe(1);
      done();
    });
  });

  test('in different debounce time when set param debounce to be a array', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const mutateStr = ref('a');
    const { loading, data, downloading, error, onSuccess } = useWatcher(
      () => {
        const get = alova.Get('/unit-test', {
          params: { num: mutateNum.value, str: mutateStr.value },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 100 * 1000
        });
        return get;
      },
      [mutateNum, mutateStr],
      { debounce: [1000, 200] }
    );

    // 暂没发送请求
    expect(loading.value).toBeFalsy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();

    await untilCbCalled(setTimeout, 100);
    mutateNum.value = 1;
    let startTs = Date.now();
    await untilCbCalled(onSuccess);
    let endTs = Date.now();
    // 请求已响应
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('a');
    expect(endTs - startTs).toBeLessThan(1100);

    mutateStr.value = 'b';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    // 请求已响应
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('b');
    expect(endTs - startTs).toBeLessThan(250);

    // 同时改变，以后一个为准
    mutateNum.value = 3;
    mutateStr.value = 'c';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('3');
    expect(data.value.params.str).toBe('c');
    expect(endTs - startTs).toBeLessThan(250);
  });

  test('set param debounce to be a array that contain a item', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const mutateStr = ref('a');
    const { data, onSuccess } = useWatcher(
      () => {
        const get = alova.Get('/unit-test', {
          params: { num: mutateNum.value, str: mutateStr.value },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 100 * 1000
        });
        return get;
      },
      [mutateNum, mutateStr],
      { debounce: [500] }
    );

    await untilCbCalled(setTimeout, 100);
    mutateNum.value = 1;
    let startTs = Date.now();
    // 请求已响应
    await untilCbCalled(onSuccess);
    let endTs = Date.now();
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('a');
    expect(endTs - startTs).toBeLessThan(600);

    mutateStr.value = 'b';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    // 第二个值未设置防抖，请求已发送并响应
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('b');
    expect(endTs - startTs).toBeLessThan(100);

    // 同时改变，以后一个为准
    mutateNum.value = 3;
    mutateStr.value = 'c';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('3');
    expect(data.value.params.str).toBe('c');
    expect(endTs - startTs).toBeLessThan(100);
  });

  test('the debounce should be effective when nest value is changed', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateObj = ref({
      num: 0
    });
    const mutateObjReactive = reactive({
      str: 'a'
    });
    const { data, onSuccess } = useWatcher(
      () => {
        const get = alova.Get('/unit-test', {
          params: { num: mutateObj.value.num, str: mutateObjReactive.str },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 100 * 1000
        });
        return get;
      },
      [mutateObj, mutateObjReactive],
      { debounce: 1000 }
    );

    await untilCbCalled(setTimeout, 100);
    mutateObj.value.num = 1;
    let startTs = Date.now();
    await untilCbCalled(onSuccess);
    let endTs = Date.now();
    // 请求已响应
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('a');
    let diffTs = endTs - startTs;
    expect(diffTs).toBeGreaterThanOrEqual(1000);
    expect(diffTs).toBeLessThan(1100);

    mutateObjReactive.str = 'b';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    // 请求已响应
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('b');
    diffTs = endTs - startTs;
    expect(diffTs).toBeGreaterThanOrEqual(1000);
    expect(diffTs).toBeLessThan(1100);

    // 同时改变，以后一个为准
    mutateObj.value.num = 3;
    mutateObjReactive.str = 'c';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('3');
    expect(data.value.params.str).toBe('c');
    diffTs = endTs - startTs;
    expect(diffTs).toBeGreaterThanOrEqual(1000);
    expect(diffTs).toBeLessThan(1100);
  });

  test('the debounce of array should be effective when nest value is changed', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateObj = ref({
      num: 0
    });
    const mutateObjReactive = reactive({
      str: 'a'
    });
    const { data, onSuccess } = useWatcher(
      () => {
        const get = alova.Get('/unit-test', {
          params: { num: mutateObj.value.num, str: mutateObjReactive.str },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 100 * 1000
        });
        return get;
      },
      [mutateObj, mutateObjReactive],
      { debounce: [1000, 200] }
    );

    await untilCbCalled(setTimeout, 100);
    mutateObj.value.num = 1;
    let startTs = Date.now();
    await untilCbCalled(onSuccess);
    let endTs = Date.now();
    // 请求已响应
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('a');
    let diffTs = endTs - startTs;
    expect(diffTs).toBeGreaterThanOrEqual(1000);
    expect(diffTs).toBeLessThan(1100);

    mutateObjReactive.str = 'b';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    // 请求已响应
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('1');
    expect(data.value.params.str).toBe('b');
    diffTs = endTs - startTs;
    expect(diffTs).toBeGreaterThanOrEqual(200);
    expect(diffTs).toBeLessThan(250);

    // 同时改变，以后一个为准
    mutateObj.value.num = 3;
    mutateObjReactive.str = 'c';
    startTs = Date.now();
    await untilCbCalled(onSuccess);
    endTs = Date.now();
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.num).toBe('3');
    expect(data.value.params.str).toBe('c');
    diffTs = endTs - startTs;
    expect(diffTs).toBeGreaterThanOrEqual(200);
    expect(diffTs).toBeLessThan(250);
  });

  test('should send request when set the param `immediate`', done => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const mutateStr = ref('a');
    let currentGet: Method<any, any, any, any, any, any, any>;
    const { loading, data, downloading, error, onSuccess } = useWatcher(
      () => {
        const get = (currentGet = alova.Get('/unit-test', {
          params: { num: mutateNum.value, str: mutateStr.value },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 0
        }));
        return get;
      },
      [mutateNum, mutateStr],
      { immediate: true }
    );
    expect(loading.value).toBeTruthy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    const mockCallback = jest.fn(() => {});
    onSuccess(mockCallback);
    const successTimesFns = [
      () => {
        expect(loading.value).toBeFalsy();
        expect(data.value.path).toBe('/unit-test');
        expect(data.value.params.num).toBe('0');
        expect(data.value.params.str).toBe('a');
        expect(downloading.value).toEqual({ total: 0, loaded: 0 });
        expect(error.value).toBeUndefined();
        // 缓存有值
        const cacheData = getResponseCache(alova.id, key(currentGet));
        expect(cacheData).toBeUndefined();
        expect(mockCallback.mock.calls.length).toBe(1);
        mutateNum.value = 2;
        mutateStr.value = 'c';
      },
      () => {
        expect(data.value.params.num).toBe('2');
        expect(data.value.params.str).toBe('c');
        const cacheData = getResponseCache(alova.id, key(currentGet));
        expect(cacheData).toBeUndefined();
        expect(mockCallback.mock.calls.length).toBe(2);
        done();
      }
    ];

    // 根据触发次数来运行不同回调函数
    let watchTimes = 0;
    onSuccess(() => {
      successTimesFns[watchTimes]();
      watchTimes++;
    });
  });

  test("initial request shouldn't delay when set the `immediate` and `debounce`", done => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const mutateNum = ref(0);
    const mutateStr = ref('a');
    let currentGet: Method;
    const { loading, data, downloading, error, onSuccess } = useWatcher(
      () => {
        const get = (currentGet = alova.Get('/unit-test', {
          params: { num: mutateNum.value, str: mutateStr.value },
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json'
          },
          transformData: (result: Result) => result.data,
          localCache: 0
        }));
        return get;
      },
      [mutateNum, mutateStr],
      { immediate: true, debounce: 1000 }
    );

    // 监听时立即出发一次请求，因此loading的值为true
    expect(loading.value).toBeTruthy();
    expect(data.value).toBeUndefined();
    expect(downloading.value).toEqual({ total: 0, loaded: 0 });
    expect(error.value).toBeUndefined();
    const mockCallback = jest.fn(() => {});
    onSuccess(mockCallback);
    const successTimesFns = [
      () => {
        expect(loading.value).toBeFalsy();
        expect(data.value.path).toBe('/unit-test');
        expect(data.value.params.num).toBe('0');
        expect(data.value.params.str).toBe('a');
        expect(downloading.value).toEqual({ total: 0, loaded: 0 });
        expect(error.value).toBeUndefined();
        // 缓存有值
        const cacheData = getResponseCache(alova.id, key(currentGet));
        expect(cacheData).toBeUndefined();
        expect(mockCallback.mock.calls.length).toBe(1);
        mutateNum.value = 2;
        mutateStr.value = 'c';

        // 因为值改变后延迟1000毫秒发出请求，因此500毫秒后应该还是原数据
        setTimeout(() => {
          expect(data.value.params.num).toBe('0');
          expect(data.value.params.str).toBe('a');
        }, 500);
      },
      () => {
        expect(data.value.params.num).toBe('2');
        expect(data.value.params.str).toBe('c');
        const cacheData = getResponseCache(alova.id, key(currentGet));
        expect(cacheData).toBeUndefined();
        expect(mockCallback.mock.calls.length).toBe(2);
        done();
      }
    ];

    // 根据触发次数来运行不同回调函数
    let watchTimes = 0;
    onSuccess(() => {
      successTimesFns[watchTimes]();
      watchTimes++;
    });
  });

  test('It would return the useHookConfig object when second param is function in `useRequest`', async () => {
    const alova = getAlovaInstance(VueHook, {
      responseExpect: r => r.json()
    });
    const getGetterObj = alova.Get('/unit-test', {
      timeout: 10000,
      transformData: ({ data }: Result<true>) => data,
      params: {
        val: '1'
      }
    });

    const ctrlVal = ref(0);
    const { data, send, onSuccess } = useWatcher(() => getGetterObj, [ctrlVal], {
      force: (isForce = false) => isForce
    });

    setCache(getGetterObj, {
      path: '/unit-test',
      method: 'GET',
      params: { val: '-1' },
      data: {}
    });

    ctrlVal.value = 1;
    await untilCbCalled(onSuccess);
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.val).toBe('-1');

    send(true);
    await untilCbCalled(onSuccess);
    expect(data.value.path).toBe('/unit-test');
    expect(data.value.params.val).toBe('1');
    const cacheData = getResponseCache(alova.id, key(getGetterObj));
    expect(cacheData.params).toEqual({ val: '1' });
  });
});
