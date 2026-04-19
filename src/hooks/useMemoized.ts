import { useMemo, useRef, useEffect } from 'react';

// Deep comparison hook
export function useDeepMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useRef<{ deps: React.DependencyList; value: T } | null>(null);

  const isSame = () => {
    if (!ref.current || ref.current.deps.length !== deps.length) return false;
    return deps.every((dep, i) => isEqual(dep, ref.current?.deps[i]));
  };

  if (!isSame()) {
    ref.current = { deps, value: factory() };
  }

  return ref.current!.value;
}

// Deep equality check
function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object' || a === null || b === null) return false;
  
  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;
  const aKeys = Object.keys(aObj);
  const bKeys = Object.keys(bObj);
  
  if (aKeys.length !== bKeys.length) return false;
  
  for (const key of aKeys) {
    if (!bKeys.includes(key)) return false;
    if (!isEqual(aObj[key], bObj[key])) {
      return false;
    }
  }
  
  return true;
}

// Hook para memoizar callbacks com deep equality
export function useDeepCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  deps: React.DependencyList
): T {
  const ref = useRef<T>(callback);
  const depsRef = useRef<React.DependencyList>(deps);

  useEffect(() => {
    const isSame = deps.every((dep, i) => isEqual(dep, depsRef.current[i]));
    if (!isSame) {
      ref.current = callback;
      depsRef.current = deps;
    }
  }, [deps, callback]);

  return useMemo(() => ((...args: unknown[]) => ref.current(...args)) as T, []);
}

// Hook para cache de resultados de funções
export function useCachedFunction<T extends (...args: unknown[]) => unknown>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string
): T {
  const cache = useRef(new Map<string, ReturnType<T>>());

  return useMemo(() => {
    return ((...args: Parameters<T>): ReturnType<T> => {
      const key = keyGenerator(...args);
      if (cache.current.has(key)) {
        return cache.current.get(key)!;
      }
      const result = fn(...args) as ReturnType<T>;
      cache.current.set(key, result);
      
      // Limit cache size
      if (cache.current.size > 100) {
        const firstKey = cache.current.keys().next().value as string;
        if (firstKey) cache.current.delete(firstKey);
      }
      
      return result;
    }) as T;
  }, [fn, keyGenerator]);
}

// Hook para previnir re-renders em listas
export function useStableArray<T>(array: T[]): T[] {
  const ref = useRef(array);
  
  if (array.length !== ref.current.length || 
      !array.every((item, i) => item === ref.current[i])) {
    ref.current = array;
  }
  
  return ref.current;
}
