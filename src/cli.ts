import { createInterface, Interface } from 'readline';
import { createHistory } from './history';
import { createImmediate } from './immediate';

/**
 * Data listener.
 * @param data The data.
 */
export type DataListener<T = string> = (data: T) => void | Promise<void>;

/**
 * Error listener.
 * @param error The error.
 */
export type ErrorListener = (error: unknown) => void;

/** The CLI. */
export interface CLI<T = string> {
  /** The `readline` interface. */
  readonly rl: Interface;
  /**
   * Starts the CLI.
   * @returns The CLI.
   */
  start(): this;
  /**
   * Starts the CLI.
   * @param data The parsed input.
   * @param parse Determines if the input should be parsed.
   * @returns The CLI.
   */
  start(data: T, parse?: false): this;
  /**
   * Starts the CLI.
   * @param input The raw input.
   * @param parse Determines if the input should be parsed.
   * @returns The CLI.
   */
  start(input: string, parse: true): this;
  /**
   * Accepts data and emits the data to the listeners.
   * @param data The parsed input.
   * @returns The CLI.
   */
  data(data: T): this;
  /**
   * Accepts raw input to parse and emits the data to the listeners.
   * @param input The raw input.
   * @returns The CLI.
   */
  input(input: string): this;
  /**
   * Calls `rl.prompt(true)` if not closed.
   * @returns The CLI.
   */
  prompt(): this;
  /**
   * Calls `rl.resume()`, ignores incoming `line` event data, and
   * removes ignored lines from `rl`'s `history`. Will automatically
   * unignore after `data` event listeners are emitted and resolved.
   * @param [ignore=true] Determines if incoming `line` events should be ignored.
   * @returns The CLI.
   */
  ignore(ignore?: boolean): this;
  /**
   * Adds data listener.
   * @param event The `data` event.
   * @param listener The data listener to add.
   * @returns The CLI.
   */
  on(event: 'data', listener: DataListener<T>): this;
  /**
   * Adds error listener.
   * @param event The `error` event.
   * @param listener The error listener to add.
   * @returns The CLI.
   */
  on(event: 'error', listener: ErrorListener): this;
  /**
   * Removes data listener.
   * @param event The `data` event.
   * @param listener The data listener to remove.
   * @returns The CLI.
   */
  off(event: 'data', listener: DataListener<T>): this;
  /**
   * Removes error listener.
   * @param event The `error` event.
   * @param listener The error listener to remove.
   * @returns The CLI.
   */
  off(event: 'error', listener: ErrorListener): this;
}

/** The CLI options. */
export interface CLIOptions<T> {
  /** The `readline` interface to use. */
  rl?: Interface;
  /**
   * Custom parser for parsing raw input.
   * @param input The raw input.
   */
  parser?(input: string): T | Promise<T>;
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

/**
 * Creates a CLI.
 * @param options The CLI options.
 * @returns The CLI.
 */
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

  const prompt: CLI<T>['prompt'] = () => {
    if (!closed) {
      rl.prompt(true);
    }
    return cli;
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
    input: string | T,
    parse: boolean,
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
    const handleData = async () => {
      let parsed: T;
      try {
        parsed = parse && parser ? await parser(input as string) : (input as T);
      } catch (error: unknown) {
        errorListeners.forEach(listener => listener(error));
        return;
      }
      // handle errors for each listener
      const promises = dataListeners.map(async listener => {
        try {
          await listener(parsed);
        } catch (error: unknown) {
          errorListeners.forEach(listener => listener(error));
        }
      });
      await Promise.all(promises);
    };
    handleData().finally(() => {
      ignore(false);
      resume();
      immediate.set(() => prompt());
    });
  };

  const data: CLI<T>['data'] = data => {
    handleInput(data, false, true);
    return cli;
  };

  const input: CLI<T>['input'] = input => {
    handleInput(input, true, true);
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
  rl.on('line', input => handleInput(input, true));
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
    createProperties({ rl, start, data, input, prompt, ignore, on, off })
  );
  return cli.ignore();
}

export default createCLI;
