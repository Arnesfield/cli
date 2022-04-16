export interface CLIHistory {
  set(history: string[]): void;
  lock(): void;
  unlock(): void;
  clear(): void;
  restore(): void;
}

export function createHistory(history?: string[]): CLIHistory {
  let lockLength = -1;
  const set = (newHistory: string[]) => {
    history = newHistory;
  };
  const lock = () => {
    lockLength = Array.isArray(history) ? history.length : -1;
  };
  const unlock = () => {
    lockLength = -1;
  };
  const restore = () => {
    if (Array.isArray(history) && lockLength > -1) {
      // remove history outside of lockLength
      history.splice(0, Math.abs(history.length - lockLength));
    }
  };
  const clear = () => {
    if (Array.isArray(history)) {
      history.splice(0);
    }
  };
  return { set, lock, unlock, clear, restore };
}
