import { useEffect, useMemo, useRef, useState } from 'react';
import { Expand, Focus, Minimize2, MonitorOff, MousePointer2, RefreshCw } from 'lucide-react';
import type { BrowserConnectionState, BrowserInput, BrowserRunSnapshot } from '../../features/browser-agent';
import { mapClientPointToFrame } from './frameCoordinates';

type ManagedBrowserViewportProps = {
  connectionState: BrowserConnectionState;
  run: BrowserRunSnapshot;
  onInput: (input: BrowserInput) => void;
  onRetryConnection?: () => void;
};

type BrowserInputWithoutSequence =
  | Omit<Extract<BrowserInput, { kind: 'pointer' }>, 'frameSequence' | 'pageGeneration'>
  | Omit<Extract<BrowserInput, { kind: 'wheel' }>, 'frameSequence' | 'pageGeneration'>
  | Omit<Extract<BrowserInput, { kind: 'key' }>, 'frameSequence' | 'pageGeneration'>;

const sameOriginFrameUrl = (value: string | undefined) => {
  if (!value) return '';
  try {
    const url = new URL(value, window.location.origin);
    return url.origin === window.location.origin ? url.toString() : '';
  } catch {
    return '';
  }
};

export default function ManagedBrowserViewport({ connectionState, run, onInput, onRetryConnection }: ManagedBrowserViewportProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const queuedMove = useRef<BrowserInput | null>(null);
  const moveFrame = useRef<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [viewportFocused, setViewportFocused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const frameUrl = sameOriginFrameUrl(run.frameUrl);
  const hasFrameIdentity = Number.isSafeInteger(run.frameSequence)
    && Number.isSafeInteger(run.framePageGeneration)
    && (run.frameSequence ?? 0) > 0
    && (run.framePageGeneration ?? 0) > 0;
  const isUserControlled = run.controlOwner === 'user' && run.state === 'user-control';
  const frameAge = run.frameUpdatedAt ? now - Date.parse(run.frameUpdatedAt) : Number.POSITIVE_INFINITY;
  const frameIsStale = frameAge > 8_000;
  const unavailableReason = useMemo(() => {
    if (connectionState === 'connecting') return 'Connecting to the application…';
    if (connectionState === 'reconnecting') return 'Connection interrupted. Reconnecting…';
    if (connectionState === 'disconnected') return 'The live view is disconnected. Your application is still saved.';
    if (!frameUrl) return 'Waiting for the application page…';
    if (!hasFrameIdentity) return 'Waiting for a verified application page…';
    if (frameIsStale) return 'The page view is out of date. Input is paused while ApplyFill reconnects.';
    return '';
  }, [connectionState, frameIsStale, frameUrl, hasFrameIdentity]);
  const acceptsInput = isUserControlled && !unavailableReason;

  useEffect(() => () => {
    if (moveFrame.current !== null) cancelAnimationFrame(moveFrame.current);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 2_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!acceptsInput || !wrapper || !hasFrameIdentity || typeof ResizeObserver === 'undefined') return;
    let resizeFrame: number | null = null;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        const viewportWidth = Math.max(320, Math.min(3840, Math.round(entry.contentRect.width)));
        const viewportHeight = Math.max(240, Math.min(2160, Math.round(entry.contentRect.height)));
        if (viewportWidth === run.frameWidth && viewportHeight === run.frameHeight) return;
        onInput({
          frameSequence: run.frameSequence!,
          kind: 'resize',
          pageGeneration: run.framePageGeneration!,
          viewportHeight,
          viewportWidth,
        });
      });
    });
    observer.observe(wrapper);
    return () => {
      observer.disconnect();
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
    };
  }, [acceptsInput, hasFrameIdentity, onInput, run.frameHeight, run.framePageGeneration, run.frameSequence, run.frameWidth]);

  const emit = (input: BrowserInputWithoutSequence) => {
    if (!hasFrameIdentity) return;
    onInput({
      ...input,
      frameSequence: run.frameSequence!,
      pageGeneration: run.framePageGeneration!,
    } as BrowserInput);
  };

  const queuePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!acceptsInput) return;
    const point = mapClientPointToFrame(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      run.frameWidth ?? 0,
      run.frameHeight ?? 0,
    );
    if (!point || !hasFrameIdentity) return;
    queuedMove.current = {
      event: 'move',
      frameSequence: run.frameSequence!,
      kind: 'pointer',
      pageGeneration: run.framePageGeneration!,
      ...point,
    };
    if (moveFrame.current !== null) return;
    moveFrame.current = requestAnimationFrame(() => {
      if (queuedMove.current) onInput(queuedMove.current);
      queuedMove.current = null;
      moveFrame.current = null;
    });
  };

  const leaveViewport = () => {
    setViewportFocused(false);
    wrapperRef.current?.blur();
  };

  return (
    <section className={`browser-viewport-shell${focusMode ? ' is-focus-mode' : ''}`} aria-labelledby="managed-browser-title">
      <div className="browser-viewport-heading">
        <div>
          <h2 id="managed-browser-title">Application page</h2>
          <p title={run.currentUrl}>{run.currentDomain || 'Opening application'}</p>
        </div>
        <button
          aria-label={focusMode ? 'Leave application focus mode' : 'Enter application focus mode'}
          className="browser-viewport-focus-button"
          onClick={() => setFocusMode((current) => !current)}
          type="button"
        >
          {focusMode ? <Minimize2 aria-hidden="true" size={18} /> : <Expand aria-hidden="true" size={18} />}
          {focusMode ? 'Leave Focus Mode' : 'Focus Mode'}
        </button>
      </div>

      <div
        aria-describedby="browser-viewport-instructions"
        aria-disabled={!acceptsInput}
        aria-label={acceptsInput ? 'Live application page. You have control.' : 'Live application page. ApplyFill has control.'}
        className={`browser-viewport${acceptsInput ? ' accepts-input' : ''}${viewportFocused ? ' has-focus' : ''}`}
        onBlur={() => setViewportFocused(false)}
        onFocus={() => setViewportFocused(true)}
        onKeyDown={(event) => {
          if (!acceptsInput) return;
          if (event.key === 'Escape') {
            event.preventDefault();
            leaveViewport();
            return;
          }
          event.preventDefault();
          emit({ kind: 'key', event: 'down', key: event.key, code: event.code, alt: event.altKey, control: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey });
        }}
        onKeyUp={(event) => {
          if (!acceptsInput || event.key === 'Escape') return;
          event.preventDefault();
          emit({ kind: 'key', event: 'up', key: event.key, code: event.code, alt: event.altKey, control: event.ctrlKey, meta: event.metaKey, shift: event.shiftKey });
        }}
        onPointerDown={(event) => {
          if (!acceptsInput) return;
          const point = mapClientPointToFrame(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), run.frameWidth ?? 0, run.frameHeight ?? 0);
          if (!point) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          event.currentTarget.focus();
          emit({ kind: 'pointer', event: 'down', ...point, button: event.button });
        }}
        onPointerMove={queuePointerMove}
        onPointerUp={(event) => {
          if (!acceptsInput) return;
          const point = mapClientPointToFrame(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), run.frameWidth ?? 0, run.frameHeight ?? 0);
          if (point) emit({ kind: 'pointer', event: 'up', ...point, button: event.button });
        }}
        onWheel={(event) => {
          if (!acceptsInput) return;
          const point = mapClientPointToFrame(event.clientX, event.clientY, event.currentTarget.getBoundingClientRect(), run.frameWidth ?? 0, run.frameHeight ?? 0);
          if (!point) return;
          event.preventDefault();
          emit({ kind: 'wheel', ...point, deltaX: event.deltaX, deltaY: event.deltaY });
        }}
        ref={wrapperRef}
        role="application"
        style={{ aspectRatio: `${run.frameWidth || 16} / ${run.frameHeight || 9}` }}
        tabIndex={acceptsInput ? 0 : -1}
      >
        {frameUrl ? <img alt="" draggable={false} src={frameUrl} /> : null}
        {unavailableReason ? (
          <div className="browser-viewport-overlay" role="status">
            <MonitorOff aria-hidden="true" size={30} />
            <strong>Live view unavailable</strong>
            <span>{unavailableReason}</span>
            {connectionState === 'disconnected' && onRetryConnection ? (
              <button className="browser-viewport-retry" onClick={onRetryConnection} type="button">
                <RefreshCw aria-hidden="true" size={17} /> Try Again
              </button>
            ) : null}
          </div>
        ) : !isUserControlled ? (
          <div className="browser-viewport-control-shield" aria-hidden="true">
            <Focus size={22} />
            <span>ApplyFill is working</span>
          </div>
        ) : null}
        {acceptsInput && viewportFocused ? (
          <div className="browser-viewport-exit-hint">Press Escape to return to ApplyFill controls</div>
        ) : null}
      </div>
      <p className="browser-viewport-instructions" id="browser-viewport-instructions">
        {acceptsInput
          ? <><MousePointer2 aria-hidden="true" size={16} /> You have control. Select the page to type or click; press Escape to leave the application view.</>
          : 'Page input stays locked while ApplyFill is working. Choose Take Control whenever you need it.'}
      </p>
      <p className="visually-hidden">Third-party application pages are shown as a live image. Their internal controls are not directly available to screen readers; use Take Control with sighted assistance if needed.</p>
    </section>
  );
}
