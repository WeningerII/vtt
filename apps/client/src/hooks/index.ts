import { 
  useCallback, 
  useEffect, 
  useLayoutEffect, 
  useMemo, 
  useRef, 
  useState,
  useContext,
  useReducer,
  useImperativeHandle,
  useDebugValue,
  useId,
  useTransition,
  useDeferredValue,
  useSyncExternalStore
} from 'react';

// Re-export all React hooks for easier imports
export {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useContext,
  useReducer,
  useImperativeHandle,
  useDebugValue,
  useId,
  useTransition,
  useDeferredValue,
  useSyncExternalStore
};

// Export type definitions
export type {
  Dispatch,
  SetStateAction,
  RefObject,
  MutableRefObject,
  EffectCallback,
  DependencyList,
  Reducer,
  ReducerState,
  ReducerAction,
} from 'react';
