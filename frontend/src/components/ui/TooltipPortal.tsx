import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type TooltipPlacement = 'bottom' | 'top';

type TooltipState = {
  arrowLeft: number;
  isMeasured: boolean;
  left: number;
  placement: TooltipPlacement;
  text: string;
  top: number;
};

const TOOLTIP_OFFSET = 10;
const VIEWPORT_MARGIN = 12;
const MIN_ARROW_INSET = 12;
const HOVER_SHOW_DELAY = 500;
const HIDE_DELAY = 140;
const TOOLTIP_ID = 'applyfill-tooltip';

const getTooltipTarget = (target: EventTarget | null) => {
  if (!(target instanceof Element)) {
    return null;
  }

  const element = target.closest<HTMLElement>('[data-tooltip]');
  if (!element || element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true') {
    return null;
  }

  const text = element.getAttribute('data-tooltip')?.trim();
  return text ? { element, text } : null;
};

const getInitialTooltipPosition = (element: HTMLElement, text: string): TooltipState => {
  const rect = element.getBoundingClientRect();

  return {
    arrowLeft: 0,
    isMeasured: false,
    left: rect.left + rect.width / 2,
    placement: 'top',
    text,
    top: rect.top - TOOLTIP_OFFSET
  };
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const getTooltipPosition = (
  element: HTMLElement,
  tooltipElement: HTMLDivElement,
  text: string
): TooltipState => {
  const targetRect = element.getBoundingClientRect();
  const tooltipRect = tooltipElement.getBoundingClientRect();
  const targetCenter = targetRect.left + targetRect.width / 2;
  const maxLeft = window.innerWidth - tooltipRect.width - VIEWPORT_MARGIN;
  const left = clamp(
    targetCenter - tooltipRect.width / 2,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, maxLeft)
  );
  const topPlacementTop = targetRect.top - TOOLTIP_OFFSET - tooltipRect.height;
  const bottomPlacementTop = targetRect.bottom + TOOLTIP_OFFSET;
  const hasRoomAbove = topPlacementTop >= VIEWPORT_MARGIN;
  const placement: TooltipPlacement = hasRoomAbove ? 'top' : 'bottom';
  const fallbackTop = window.innerHeight - tooltipRect.height - VIEWPORT_MARGIN;
  const top = placement === 'top'
    ? topPlacementTop
    : clamp(bottomPlacementTop, VIEWPORT_MARGIN, Math.max(VIEWPORT_MARGIN, fallbackTop));

  return {
    arrowLeft: clamp(targetCenter - left, MIN_ARROW_INSET, tooltipRect.width - MIN_ARROW_INSET),
    isMeasured: true,
    left,
    placement,
    text,
    top
  };
};

const isSameTooltipPosition = (current: TooltipState, next: TooltipState) => (
  current.arrowLeft === next.arrowLeft
  && current.isMeasured === next.isMeasured
  && current.left === next.left
  && current.placement === next.placement
  && current.text === next.text
  && current.top === next.top
);

export default function TooltipPortal() {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const activeTargetRef = useRef<HTMLElement | null>(null);
  const activeTextRef = useRef('');
  const dismissedTargetRef = useRef<HTMLElement | null>(null);
  const focusedTargetRef = useRef<HTMLElement | null>(null);
  const pointerTargetRef = useRef<HTMLElement | null>(null);
  const pendingTargetRef = useRef<HTMLElement | null>(null);
  const isKeyboardInteractionRef = useRef(true);
  const isTooltipHoveredRef = useRef(false);
  const showTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const clearShowTimer = () => {
    if (showTimerRef.current !== null) {
      window.clearTimeout(showTimerRef.current);
      showTimerRef.current = null;
    }
    pendingTargetRef.current = null;
  };

  const clearHideTimer = () => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  const detachTooltipDescription = () => {
    const target = activeTargetRef.current;
    if (!target) return;
    const descriptions = (target.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter((id) => id && id !== TOOLTIP_ID);
    if (descriptions.length) {
      target.setAttribute('aria-describedby', descriptions.join(' '));
    } else {
      target.removeAttribute('aria-describedby');
    }
  };

  const hideTooltipNow = () => {
    clearShowTimer();
    clearHideTimer();
    detachTooltipDescription();
    activeTargetRef.current = null;
    activeTextRef.current = '';
    isTooltipHoveredRef.current = false;
    setTooltip(null);
  };

  const showTooltipNow = (element: HTMLElement, text: string) => {
    clearShowTimer();
    clearHideTimer();
    if (activeTargetRef.current && activeTargetRef.current !== element) {
      detachTooltipDescription();
    }
    activeTargetRef.current = element;
    activeTextRef.current = text;
    const descriptions = new Set(
      (element.getAttribute('aria-describedby') ?? '').split(/\s+/).filter(Boolean)
    );
    descriptions.add(TOOLTIP_ID);
    element.setAttribute('aria-describedby', [...descriptions].join(' '));
    setTooltip(getInitialTooltipPosition(element, text));
  };

  const scheduleTooltip = (element: HTMLElement, text: string, delay: number) => {
    clearHideTimer();
    if (dismissedTargetRef.current === element || activeTargetRef.current === element) return;
    if (activeTargetRef.current && activeTargetRef.current !== element) {
      hideTooltipNow();
    }
    clearShowTimer();
    pendingTargetRef.current = element;
    if (delay === 0) {
      showTooltipNow(element, text);
      return;
    }
    showTimerRef.current = window.setTimeout(() => {
      if (pendingTargetRef.current === element) showTooltipNow(element, text);
    }, delay);
  };

  const scheduleHide = () => {
    const activeTarget = activeTargetRef.current;
    const pendingTarget = pendingTargetRef.current;
    const retainedTarget = activeTarget ?? pendingTarget;
    if (!retainedTarget) return;
    if (
      pointerTargetRef.current === retainedTarget
      || focusedTargetRef.current === retainedTarget
      || isTooltipHoveredRef.current
    ) {
      return;
    }
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(hideTooltipNow, HIDE_DELAY);
  };

  const updatePosition = () => {
    const activeTarget = activeTargetRef.current;
    const tooltipElement = tooltipRef.current;
    const activeText = activeTextRef.current;

    if (!activeTarget || !tooltipElement || !activeText) {
      return;
    }

    const nextTooltip = getTooltipPosition(activeTarget, tooltipElement, activeText);
    setTooltip((current) => {
      if (current && isSameTooltipPosition(current, nextTooltip)) {
        return current;
      }

      return nextTooltip;
    });
  };

  useLayoutEffect(() => {
    updatePosition();
  });

  useEffect(() => {
    const handlePointerOver = (event: PointerEvent | MouseEvent) => {
      if ('pointerType' in event && event.pointerType === 'touch') return;
      const target = getTooltipTarget(event.target);
      if (!target) return;
      const relatedTarget = event.relatedTarget;
      if (relatedTarget instanceof Node && target.element.contains(relatedTarget)) return;

      pointerTargetRef.current = target.element;
      clearHideTimer();
      scheduleTooltip(target.element, target.text, HOVER_SHOW_DELAY);
    };

    const handlePointerOut = (event: PointerEvent | MouseEvent) => {
      const target = getTooltipTarget(event.target);
      if (!target) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && target.element.contains(nextTarget)) return;
      if (nextTarget instanceof Node && tooltipRef.current?.contains(nextTarget)) {
        pointerTargetRef.current = null;
        return;
      }

      if (pointerTargetRef.current === target.element) pointerTargetRef.current = null;
      if (pendingTargetRef.current === target.element) clearShowTimer();
      if (
        dismissedTargetRef.current === target.element
        && focusedTargetRef.current !== target.element
      ) {
        dismissedTargetRef.current = null;
      }
      scheduleHide();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      isKeyboardInteractionRef.current = true;
      if (event.key === 'Escape') {
        dismissedTargetRef.current = activeTargetRef.current ?? pendingTargetRef.current;
        hideTooltipNow();
      }
    };

    const handlePointerDown = () => {
      isKeyboardInteractionRef.current = false;
      hideTooltipNow();
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = getTooltipTarget(event.target);
      if (!target) return;
      focusedTargetRef.current = target.element;
      clearHideTimer();
      if (isKeyboardInteractionRef.current) {
        scheduleTooltip(target.element, target.text, 0);
      }
    };

    const handleFocusOut = (event: FocusEvent) => {
      const target = getTooltipTarget(event.target);
      if (!target) return;
      const nextTarget = event.relatedTarget;
      if (nextTarget instanceof Node && target.element.contains(nextTarget)) return;
      if (focusedTargetRef.current === target.element) focusedTargetRef.current = null;
      if (
        dismissedTargetRef.current === target.element
        && pointerTargetRef.current !== target.element
      ) {
        dismissedTargetRef.current = null;
      }
      scheduleHide();
    };

    document.addEventListener('pointerover', handlePointerOver, true);
    document.addEventListener('pointerout', handlePointerOut, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('mouseover', handlePointerOver, true);
    document.addEventListener('mouseout', handlePointerOut, true);
    document.addEventListener('mousedown', handlePointerDown, true);
    document.addEventListener('focusin', handleFocusIn);
    document.addEventListener('focusout', handleFocusOut);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      clearShowTimer();
      clearHideTimer();
      detachTooltipDescription();
      document.removeEventListener('pointerover', handlePointerOver, true);
      document.removeEventListener('pointerout', handlePointerOut, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('mouseover', handlePointerOver, true);
      document.removeEventListener('mouseout', handlePointerOut, true);
      document.removeEventListener('mousedown', handlePointerDown, true);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, []);

  if (!tooltip) {
    return null;
  }

  return createPortal(
    <div
      className="tooltip-portal"
      data-placement={tooltip.placement}
      id={TOOLTIP_ID}
      onPointerEnter={() => {
        isTooltipHoveredRef.current = true;
        clearHideTimer();
      }}
      onPointerLeave={() => {
        isTooltipHoveredRef.current = false;
        scheduleHide();
      }}
      ref={tooltipRef}
      role="tooltip"
      style={{
        left: tooltip.left,
        top: tooltip.top,
        visibility: tooltip.isMeasured ? 'visible' : 'hidden'
      }}
    >
      {tooltip.text}
      <span
        className="tooltip-portal-arrow"
        aria-hidden="true"
        style={{ left: tooltip.arrowLeft }}
      />
    </div>,
    document.body
  );
}
