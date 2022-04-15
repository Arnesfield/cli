import { createInterface, Interface } from 'readline';
import { createImmediate } from './immediate';

export type Listener = (...args: any[]) => void | Promise<void>;

export type DataListener<T = string> = (
  data: T,
  input: string
) => void | Promise<void>;

export type ErrorListener = (error: unknown) => void;

export interface CLI<T = string> {
  rl: Interface;
  start(): this;
  close(): void;
  input(input: string): this;
  ignore(ignore?: boolean): this;
  on(event: 'data', listener: DataListener<T>): this;
  on(event: 'error', listener: ErrorListener): this;
  on(event: string, listener: Listener): this;
  off(event: 'data', listener: DataListener<T>): this;
  off(event: 'error', listener: ErrorListener): this;
  off(event: string, listener: Listener): this;
}

export interface CLIOptions<T> {
  rl?: Interface;
  parser?: (input: string) => T | Promise<T>;
}

function prop(value: any): PropertyDescriptor {
  return { value, writable: false, enumerable: true, configurable: false };
}

export function createCLI<T = string>(options: CLIOptions<T> = {}): CLI<T> {
  const { parser } = options;
  const rl = options.rl || createInterface(process.stdin, process.stdout);
  let isIgnoring = false;
  let didSetError = false;
  const cli: CLI<T> = {} as CLI<T>;
  const listeners = new Map<Listener, Listener[]>();
  const errorHandler = (error: unknown) => {
    throw error;
  };
  const errorListeners: ErrorListener[] = [errorHandler];
  const immediate = createImmediate();

  const ignore: CLI<T>['ignore'] = (value = true) => {
    isIgnoring = value;
    if (value) {
      rl.resume();
    }
    return cli;
  };

  const start: CLI<T>['start'] = () => {
    isIgnoring = false;
    rl.prompt(true);
    return cli;
  };

  const close: CLI<T>['close'] = () => {
    rl.close();
    rl.removeAllListeners();
    listeners.clear();
    didSetError = false;
    errorListeners.splice(0, errorListeners.length, errorHandler);
  };

  const on: CLI<T>['on'] = (event, listener: Listener) => {
    if (event === 'error') {
      // remove default error handler
      if (!didSetError) {
        didSetError = true;
        errorListeners.pop();
      }
      errorListeners.push(listener);
      return cli;
    }
    const isData = event === 'data';
    event = isData ? 'line' : event;
    const isLine = event === 'line';
    // get existing listener if it exists
    const handlers = listeners.get(listener);
    // line events will be paused
    const wrapped = async (...args: any[]) => {
      if (isLine) {
        immediate.clear();
        if (isIgnoring) {
          return;
        }
        rl.pause();
      }
      try {
        const line = args[0];
        const all = isData ? [parser ? await parser(line) : line, line] : args;
        await listener(...all);
      } catch (error: unknown) {
        errorListeners.forEach(listener => listener(error));
      } finally {
        if (isLine) {
          isIgnoring = false;
          rl.resume();
          immediate.set(() => rl.prompt(true));
        }
      }
    };
    if (handlers) {
      handlers.push(wrapped);
    } else {
      listeners.set(listener, [wrapped]);
    }
    rl.on(event, wrapped);
    return cli;
  };

  const off: CLI<T>['off'] = (event, listener: Listener): CLI<T> => {
    if (event === 'error') {
      const index = errorListeners.indexOf(listener);
      if (index > -1) {
        errorListeners.splice(index, 1);
      }
      // set default error handler
      if (errorListeners.length === 0) {
        didSetError = false;
        errorListeners.push(errorHandler);
      }
      return cli;
    }
    event = event === 'data' ? 'line' : event;
    const handlers = listeners.get(listener);
    const handler = handlers?.pop() || listener;
    if (typeof handler === 'function') {
      rl.off(event, handler);
    }
    if (handlers && handlers.length === 0) {
      listeners.delete(listener);
    }
    return cli;
  };

  Object.defineProperties(cli, {
    rl: prop(rl),
    start: prop(start),
    close: prop(close),
    ignore: prop(ignore),
    on: prop(on),
    off: prop(off)
  });

  return cli.ignore();
}

export default createCLI;
