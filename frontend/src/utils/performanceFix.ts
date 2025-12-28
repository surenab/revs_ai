/**
 * Fix for React DevTools performance measurement errors with large data.
 * This prevents React from trying to clone large data structures for performance measurement.
 */

// Disable React DevTools performance profiling for large data
if (typeof window !== 'undefined') {
  // Override performance.measure to handle large data gracefully
  const originalMeasure = performance.measure;

  performance.measure = function(name: string, startOrMeasureOptions?: string | PerformanceMeasureOptions, endMark?: string) {
    try {
      return originalMeasure.call(performance, name, startOrMeasureOptions, endMark);
    } catch (error) {
      // Silently ignore DataCloneError for performance measurements
      if (error instanceof DOMException && error.name === 'DataCloneError') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Performance measurement skipped due to large data:', name);
        }
        return null;
      }
      throw error;
    }
  };

  // Override performance.mark to handle large data
  const originalMark = performance.mark;

  performance.mark = function(name: string, markOptions?: PerformanceMarkOptions) {
    try {
      return originalMark.call(performance, name, markOptions);
    } catch (error) {
      // Silently ignore DataCloneError for performance marks
      if (error instanceof DOMException && error.name === 'DataCloneError') {
        if (process.env.NODE_ENV === 'development') {
          console.warn('Performance mark skipped due to large data:', name);
        }
        return null;
      }
      throw error;
    }
  };

  // Disable React DevTools profiling if it's causing issues
  // This is a more aggressive approach - only enable if needed
  if (process.env.NODE_ENV === 'development') {
    // Try to disable React DevTools profiling hooks
    const reactDevTools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (reactDevTools && reactDevTools.onCommitFiberRoot) {
      const originalOnCommitFiberRoot = reactDevTools.onCommitFiberRoot;
      reactDevTools.onCommitFiberRoot = function(...args: unknown[]) {
        try {
          return originalOnCommitFiberRoot.apply(this, args);
        } catch (error) {
          // Silently ignore DataCloneError from React DevTools
          if (error instanceof DOMException && error.name === 'DataCloneError') {
            console.warn('React DevTools profiling skipped due to large data');
            return;
          }
          throw error;
        }
      };
    }
  }
}

/**
 * Check if data is too large for React DevTools to handle
 */
export function isDataTooLarge(data: unknown): boolean {
  try {
    // Try to serialize the data to check size
    const serialized = JSON.stringify(data);
    // If serialized size is > 10MB, consider it too large
    const sizeInMB = new Blob([serialized]).size / (1024 * 1024);
    return sizeInMB > 10;
  } catch {
    // If serialization fails, assume it's too large
    return true;
  }
}

/**
 * Create a lightweight version of data for React DevTools
 */
export function createLightweightData<T>(data: T): T | { __lightweight: true; length: number } {
  if (Array.isArray(data)) {
    if (data.length > 1000) {
      return { __lightweight: true, length: data.length } as unknown as T;
    }
  }
  return data;
}
