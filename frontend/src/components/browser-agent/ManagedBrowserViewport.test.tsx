import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BrowserInput, BrowserRunSnapshot } from '../../features/browser-agent';
import ManagedBrowserViewport from './ManagedBrowserViewport';
import { mapClientPointToFrame } from './frameCoordinates';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ManagedBrowserViewport frame coordinates', () => {
  it('maps displayed coordinates to browser viewport pixels', () => {
    const point = mapClientPointToFrame(
      410,
      320,
      { height: 600, left: 10, top: 20, width: 800 },
      1600,
      900,
    );

    expect(point).toEqual({ x: 800, y: 450 });
  });

  it('rejects input in object-fit letterboxing', () => {
    const point = mapClientPointToFrame(
      410,
      40,
      { height: 600, left: 10, top: 20, width: 800 },
      1600,
      900,
    );

    expect(point).toBeNull();
  });

  it('binds viewport resize to the displayed frame identity', async () => {
    let resizeCallback: ResizeObserverCallback | undefined;
    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }
      disconnect() { return undefined; }
      observe() { return undefined; }
      unobserve() { return undefined; }
    }
    vi.stubGlobal('ResizeObserver', TestResizeObserver);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', () => undefined);
    const inputs: BrowserInput[] = [];
    const run = {
      activity: [],
      applicationStage: 'Application',
      canResume: true,
      checkpointRetained: true,
      controlOwner: 'user',
      currentDomain: 'jobs.example.test',
      currentUrl: 'https://jobs.example.test/apply',
      frameDeviceScaleFactor: 1,
      frameHeight: 720,
      framePageGeneration: 4,
      frameSequence: 19,
      frameUpdatedAt: new Date().toISOString(),
      frameUrl: '/api/browser-agent/runs/run-1/frame/latest?sequence=19',
      frameWidth: 1280,
      id: 'run-1',
      revision: 2,
      state: 'user-control',
      statusMessage: 'You have control.',
      updatedAt: new Date().toISOString(),
    } satisfies BrowserRunSnapshot;
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<ManagedBrowserViewport connectionState="connected" onInput={(input) => inputs.push(input)} run={run} />);
    });

    await act(async () => {
      resizeCallback?.([
        { contentRect: { height: 600, width: 1000 } } as ResizeObserverEntry,
      ], {} as ResizeObserver);
    });

    expect(inputs).toContainEqual({
      frameSequence: 19,
      kind: 'resize',
      pageGeneration: 4,
      viewportHeight: 600,
      viewportWidth: 1000,
    });
    act(() => root.unmount());
  });

  it('offers an accessible retry when the live view disconnects', async () => {
    const run = {
      activity: [],
      applicationStage: 'Application',
      canResume: true,
      checkpointRetained: true,
      controlOwner: 'agent',
      currentDomain: 'jobs.example.test',
      currentUrl: 'https://jobs.example.test/apply',
      frameDeviceScaleFactor: 1,
      frameHeight: 720,
      framePageGeneration: 4,
      frameSequence: 19,
      frameUpdatedAt: new Date().toISOString(),
      frameUrl: '/api/browser-agent/runs/run-1/frame/latest?sequence=19',
      frameWidth: 1280,
      id: 'run-1',
      revision: 2,
      state: 'agent-running',
      statusMessage: 'ApplyFill is working.',
      updatedAt: new Date().toISOString(),
    } satisfies BrowserRunSnapshot;
    const retry = vi.fn();
    const container = document.createElement('div');
    const root = createRoot(container);
    await act(async () => {
      root.render(<ManagedBrowserViewport connectionState="disconnected" onInput={() => undefined} onRetryConnection={retry} run={run} />);
    });

    expect(container.textContent).toContain('Your application is still saved.');
    const retryButton = [...container.querySelectorAll('button')].find((button) => button.textContent?.includes('Try Again'));
    await act(async () => retryButton?.click());
    expect(retry).toHaveBeenCalledOnce();
    act(() => root.unmount());
  });
});
