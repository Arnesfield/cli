# cli

Simple CLI.

```javascript
const cli = createCLI()
  .on('data', data => console.log('Hello %s!', data))
  .start();
```

## Examples

1. Basic usage:

   ```javascript
   const cli = createCLI();
   cli.on('data', data => console.log('Hello %s!', data));
   cli.start();
   ```

   Output:

   ```sh
   > World
   Hello World!
   ```

2. Create CLI with parser.

   ```javascript
   const cli = createCLI({ parser: input => input.trim().split(' ') });
   cli.on('data', data => console.log('data:', data));
   cli.rl.setPrompt('$ ');
   cli.start();
   ```

   Output:

   ```sh
   $   Hello World!
   data: [ 'Hello', 'World!' ]
   ```
