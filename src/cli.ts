import { createInterface, Interface } from 'readline';
import { createHistory } from './history';
import { createImmediate } from './immediate';

export type DataListener<T = string> = (data: T) => void | Promise<void>;

export type ErrorListener = (error: unknown) => void;

export interface CLI<T = string> {
  rl: Interface;
  start(): this;
  start(isData: true, data: T): this;
  start(isData: false, input: string): this;
  data(data: T): this;
  input(input: string): this;
  ignore(ignore?: boolean): this;
  on(event: 'data', listener: DataListener<T>): this;
  on(event: 'error', listener: ErrorListener): this;
  off(event: 'data', listener: DataListener<T>): this;
  off(event: 'error', listener: ErrorListener): this;
}

export interface CLIOptions<T> {
  rl?: Interface;
  parser?: (input: string) => T | Promise<T>;
}

function createProperties(obj: Record<string, any>): PropertyDescriptorMap {
  const map: PropertyDescriptorMap = {};
  for (const key in obj) {
    map[key] = {
      value: obj[key],
      writable: false,
      enumerable: true,
      configurable: false
    };
  }
  return map;
}

function errorHandler(error: unknown) {
  throw error;
}

export function createCLI<T = string>(options: CLIOptions<T> = {}): CLI<T> {
  const { parser } = options;
  const rl = options.rl || createInterface(process.stdin, process.stdout);
  let started = false;
  let closed = false;
  let isIgnoring = false;
  let didSetError = false;
  const cli: CLI<T> = {} as CLI<T>;
  const dataListeners: DataListener<T>[] = [];
  const errorListeners: ErrorListener[] = [errorHandler];
  const immediate = createImmediate();
  const history = createHistory((rl as any).history);

  const resume = () => {
    if (!closed) {
      rl.resume();
    }
  };

  const prompt = () => {
    if (!closed) {
      rl.prompt(true);
    }
  };

  // lock or unlock history
  const ignore: CLI<T>['ignore'] = (value = true) => {
    isIgnoring = value;
    if (isIgnoring) {
      history.lock();
      resume();
    } else {
      history.unlock();
    }
    return cli;
  };

  const handleInput = (
    isData: boolean,
    input: string | T,
    throwStartError = false
  ) => {
    if (throwStartError && !started) {
      throw new Error('Input not accepted without calling `start()`');
    }
    immediate.clear();
    if (isIgnoring) {
      history.restore();
      return;
    }
    rl.pause();
    (async () => {
      try {
        const value =
          !isData && parser ? await parser(input as string) : (input as T);
        await Promise.all(dataListeners.map(listener => listener(value)));
      } catch (error: unknown) {
        errorListeners.forEach(listener => listener(error));
      } finally {
        ignore(false);
        resume();
        immediate.set(() => prompt());
      }
    })();
  };

  const data: CLI<T>['data'] = (data: T) => {
    handleInput(true, data, true);
    return cli;
  };

  const input: CLI<T>['input'] = (input: string) => {
    handleInput(false, input, true);
    return cli;
  };

  const start: CLI<T>['start'] = (...args: any[]) => {
    if (started) {
      return cli;
    }
    started = true;
    ignore(false);
    if (args.length > 0) {
      handleInput(args[0], args[1]);
    } else {
      prompt();
    }
    return cli;
  };

  const on: CLI<T>['on'] = (event, listener) => {
    // remove default error handler
    if (event === 'error' && !didSetError) {
      didSetError = true;
      errorListeners.pop();
    }
    const listeners = event === 'data' ? dataListeners : errorListeners;
    listeners.push(listener);
    return cli;
  };

  const off: CLI<T>['off'] = (event, listener): CLI<T> => {
    const listeners = event === 'data' ? dataListeners : errorListeners;
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
    // set default error handler
    if (event === 'error' && errorListeners.length === 0) {
      didSetError = false;
      errorListeners.push(errorHandler);
    }
    return cli;
  };

  // add listeners
  rl.on('history', value => history.set(value));
  rl.on('line', input => handleInput(false, input));
  rl.on('close', () => {
    closed = true;
    isIgnoring = false;
    didSetError = false;
    rl.removeAllListeners();
    history.clear();
    dataListeners.splice(0);
    errorListeners.splice(0, errorListeners.length, errorHandler);
  });

  Object.defineProperties(
    cli,
    createProperties({ rl, start, data, input, ignore, on, off })
  );
  return cli.ignore();
}

export default createCLI;
