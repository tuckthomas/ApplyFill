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
    const showTooltip = (event: Event) => {
      const target = getTooltipTarget(event.target);
      if (!target) {
        return;
      }

      activeTargetRef.current = target.element;
      activeTextRef.current = target.text;
      setTooltip(getInitialTooltipPosition(target.element, target.text));
    };

    const hideTooltip = (event: Event) => {
      if (!activeTargetRef.current) {
        return;
      }

      const nextTarget = 'relatedTarget' in event ? event.relatedTarget : null;
      if (nextTarget instanceof Node && activeTargetRef.current.contains(nextTarget)) {
        return;
      }

      activeTargetRef.current = null;
      activeTextRef.current = '';
      setTooltip(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        activeTargetRef.current = null;
        activeTextRef.current = '';
        setTooltip(null);
      }
    };

    document.addEventListener('pointerenter', showTooltip, true);
    document.addEventListener('pointerleave', hideTooltip, true);
    document.addEventListener('pointerover', showTooltip, true);
    document.addEventListener('pointerout', hideTooltip, true);
    document.addEventListener('mouseover', showTooltip, true);
    document.addEventListener('mouseout', hideTooltip, true);
    document.addEventListener('focusin', showTooltip);
    document.addEventListener('focusout', hideTooltip);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      document.removeEventListener('pointerenter', showTooltip, true);
      document.removeEventListener('pointerleave', hideTooltip, true);
      document.removeEventListener('pointerover', showTooltip, true);
      document.removeEventListener('pointerout', hideTooltip, true);
      document.removeEventListener('mouseover', showTooltip, true);
      document.removeEventListener('mouseout', hideTooltip, true);
      document.removeEventListener('focusin', showTooltip);
      document.removeEventListener('focusout', hideTooltip);
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
