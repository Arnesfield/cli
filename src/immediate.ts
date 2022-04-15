export interface Immediate {
  set: (callback: () => void) => void;
  clear: () => void;
}

export function createImmediate(): Immediate {
  let timer: NodeJS.Immediate | undefined;
  const clear = () => {
    if (typeof timer !== 'undefined') {
      clearImmediate(timer);
      timer = undefined;
    }
  };
  const set = (callback: () => void) => {
    timer = setImmediate(() => {
      callback();
      clear();
    });
  };
  return { set, clear };
}
