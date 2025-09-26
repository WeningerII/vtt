import React, { lazy, Suspense, type ComponentType, type FC } from "react";
import { LoadingSpinner } from "../components/ui/LoadingSpinner";

type LazyImport<Props extends Record<string, unknown>> = () => Promise<{
  default: ComponentType<Props>;
}>;

export function lazyLoad<Props extends Record<string, unknown>>(
  importFunc: LazyImport<Props>,
): FC<Props> {
  const LazyComponent = lazy(importFunc);

  const LazyWrapper: FC<Props> = (props) => (
    <Suspense fallback={<LoadingSpinner showLabel label="Loading..." />}>
      <LazyComponent {...props} />
    </Suspense>
  );

  LazyWrapper.displayName = "LazyLoadedComponent";
  return LazyWrapper;
}

export function preloadComponent<Props extends Record<string, unknown>>(
  importFunc: LazyImport<Props>,
): void {
  void importFunc();
}
