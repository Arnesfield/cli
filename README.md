# cli

Simple interface for the command line.

Provides a simple command-line interface using the Node.js `readline` module.

```javascript
const cli = createCLI()
  .on('data', data => console.log('Hello %s!', data))
  .start();
```

## Usage

Create a CLI using the `createCLI` function and start it with `start()`. Add and remove event listeners via the `on` and `off` methods.

```javascript
// create the interface
const cli = createCLI();
// listen for data and do stuff
cli.on('data', data => {
  console.log('Hello %s!', data);
});
// start the CLI
cli.start();
```

Output:

```sh
> World
Hello World!
```

### Input Flow

This flow is used for every input:

1. A `line` event is emitted by the `readline` interface.
2. Call `rl.pause()`.
3. Parse `input` if a parser is provided and pass it to the `data` event listeners.
4. Call the `error` event listeners for each `data` event listener error.
5. Finally, call `rl.resume()` and `rl.prompt(true)`.
6. Since `rl.resume()` is called, the next line in the queue is emitted and the flow repeats.

### `CLIOptions`

You can pass `options` to `createCLI()`. You can pass your own `readline` `Interface` and a custom `parser` function.

```typescript
interface CLIOptions<T> {
  /** The `readline` interface to use. */
  rl?: Interface;

  /** Custom parser for parsing raw input. */
  parser?(input: string): T | Promise<T>;
}
```

The `parser` option accepts a function to transform the input.

In the example below, we create a CLI with a parser that trims and splits the input by spaces.

```javascript
const cli = createCLI({
  parser: input => input.trim().split(' ')
});
cli.on('data', data => {
  console.log('Array:', data);
});
cli.start();
```

Output:

```sh
> Hello World!
Array: [ 'Hello', 'World!' ]
```

### The `CLI` object

```typescript
interface CLI<T = string> {
  /** The `readline` interface. */
  readonly rl: Interface;

  /** Starts the CLI. Accepts data or input to parse. */
  start(): this;
  start(data: T, parse?: false): this;
  start(input: string, parse: true): this;

  /** Accepts data and emits the data to the listeners. */
  data(data: T): this;

  /** Accepts raw input to parse and emits the data to the listeners. */
  input(input: string): this;

  /** Calls `rl.prompt(true)` if not closed. */
  prompt(): this;

  /**
   * Ignores incoming `line` event data, and removes ignored
   * lines from `rl`'s `history` until `data` event is resolved.
   */
  ignore(ignore?: boolean): this;

  /** Adds listener. */
  on(event: 'data', listener: DataListener<T>): this;
  on(event: 'error', listener: ErrorListener): this;

  /** Removes listener. */
  off(event: 'data', listener: DataListener<T>): this;
  off(event: 'error', listener: ErrorListener): this;
}
```

#### Emit `data` events

You can emit `data` events through these methods:

```javascript
cli.input(input); // accepts input to parse
cli.data(data); // accepts parsed input
cli.start(input, true); // accepts input to parse before starting
cli.start(data); // accepts parsed input before starting
```

#### Using `cli.ignore()`

The `cli.ignore()` method does the following:

1. Calls `rl.resume()`.
2. Ignores incoming `line` event data including queued lines from `rl.pause()`.
3. Removes ignored lines from `rl`'s `history`.
4. Will automatically unignore after `data` event listeners are emitted and resolved.

A use case for `cli.ignore()` is when the `data` listener takes a while to finish (async) and you don't want to accept any input until the process has finished.

```javascript
const cli = createCLI();
cli.on('data', async data => {
  // ignore incoming lines
  cli.ignore();
  console.log('Processing "%s"', data);
  await new Promise(resolve => setTimeout(resolve, 2000));
  console.log('Done "%s"', data);
});
cli.start();
```

After entering `Hello World!`, input `foo`, `bar`, `baz` while the listener is not yet resolved. Output:

```sh
> Hello World!
Processing "Hello World!"
foo
bar
baz
Done "Hello World!"
```
