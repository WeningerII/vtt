import { useEffect, useState, useRef, useCallback } from "react";
import { useLocalStorage, useDebounce } from "usehooks-ts";

// Re-export available hooks from libraries
export {
  useLocalStorage,
  useDebounce,
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

// Implement missing hooks locally
export const useThrottle = <T>(value: T, delay: number): T => {
  const [throttledValue, setThrottledValue] = useState(value);
  const lastExecuted = useRef<number>(Date.now());

  useEffect(() => {
    if (Date.now() >= lastExecuted.current + delay) {
      lastExecuted.current = Date.now();
      setThrottledValue(value);
    } else {
      const timer = setTimeout(() => {
        lastExecuted.current = Date.now();
        setThrottledValue(value);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [value, delay]);

  return throttledValue;
};

export const useScrollPosition = () => {
  const [scrollPosition, setScrollPosition] = useState(0);

  useEffect(() => {
    const updatePosition = () => {
      setScrollPosition(window.pageYOffset);
    };

    window.addEventListener('scroll', updatePosition);
    updatePosition();

    return () => window.removeEventListener('scroll', updatePosition);
  }, []);

  return scrollPosition;
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
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const result = await response.json();
        setData(result);
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

// Custom auth hook placeholder
export const useAuth = () => {
  // This should be implemented based on your auth system
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);

  return {
    isAuthenticated,
    user,
    login: async (credentials: any) => {
      // Implement login logic
    },
    logout: () => {
      setIsAuthenticated(false);
      setUser(null);
    },
  };
};

// Custom game hook placeholder
export const useGame = () => {
  const [gameState, setGameState] = useState(null);
  const [players, setPlayers] = useState([]);

  return {
    gameState,
    players,
    joinGame: (gameId: string) => {
      // Implement game join logic
    },
    leaveGame: () => {
      setGameState(null);
      setPlayers([]);
    },
  };
};

// WebSocket hook
export const useWebSocket = (url: string) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState(null);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(url);

    ws.current.onopen = () => setIsConnected(true);
    ws.current.onclose = () => setIsConnected(false);
    ws.current.onmessage = (event) => setLastMessage(event.data);

    return () => {
      ws.current?.close();
    };
  }, [url]);

  const sendMessage = useCallback((message: string) => {
    ws.current?.send(message);
  }, []);

  return { isConnected, lastMessage, sendMessage };
};
