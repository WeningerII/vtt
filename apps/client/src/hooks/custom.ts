import { useEffect, useState, useRef, useCallback } from "react";
import { 
  useLocalStorage,
  useMediaQuery,
  useOnClickOutside,
  useInterval,
  useTimeout,
  useToggle,
  useCounter,
  useHover,
  useScript,
  useWindowSize
} from "usehooks-ts";

// Re-export available hooks from libraries
export {
  useLocalStorage,
  useMediaQuery,
  useOnClickOutside,
  useInterval,
  useTimeout,
  useToggle,
  useCounter,
  useHover,
  useScript,
  useWindowSize,
} from "usehooks-ts";

// Implement missing hooks that are no longer exported
export const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useThrottle = <T>(value: T, interval: number): T => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastExecuted = useRef(Date.now());

  useEffect(() => {
    if (Date.now() >= lastExecuted.current + interval) {
      lastExecuted.current = Date.now();
      setThrottledValue(value);
    } else {
      const timerId = setTimeout(() => {
        lastExecuted.current = Date.now();
        setThrottledValue(value);
      }, interval);

      return () => clearTimeout(timerId);
    }
  }, [value, interval]);

  return throttledValue;
};

export const useFetch = <T>(url: string) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(url);
        if (!response.ok) {throw new Error('Failed to fetch');}
        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err as Error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [url]);

  return { data, loading, error };
};

export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const updatePosition = () => {
      setScrollPosition({ x: window.scrollX, y: window.scrollY });
    };

    window.addEventListener('scroll', updatePosition);
    updatePosition();

    return () => window.removeEventListener('scroll', updatePosition);
  }, []);

  return scrollPosition;
};

// Note: useAuth is provided by AuthProvider - do not duplicate here
// Note: useGame is provided by GameProvider - do not duplicate here  
// Note: useWebSocket is provided by WebSocketProvider - do not duplicate here
