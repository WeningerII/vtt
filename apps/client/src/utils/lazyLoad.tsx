import { lazy, Suspense, ComponentType } from 'react';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

/**
 * Wrapper for lazy loading components with a loading fallback
 */
export function lazyLoad<T extends ComponentType<any>>(
  importFunc: () => Promise<{ default: T }>
) {
  const LazyComponent = lazy(importFunc);

  return (props: any) => (
    <Suspense fallback={<LoadingSpinner showLabel label="Loading..." />}>
      <LazyComponent {...props} />
    </Suspense>
  );
}

/**
 * Preload a lazy component
 */
export function preloadComponent(
  importFunc: () => Promise<any>
) {
  importFunc();
}
