import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ModalPhase = 'opening' | 'open' | 'closing';

type ModalRendererProps = {
  children: ReactNode;
  isOpen: boolean;
};

const EXIT_DURATION_MS = 220;

export default function ModalRenderer({ children, isOpen }: ModalRendererProps) {
  const [isMounted, setIsMounted] = useState(isOpen);
  const [phase, setPhase] = useState<ModalPhase>(isOpen ? 'opening' : 'closing');
  const renderedChildrenRef = useRef(children);

  if (isOpen) renderedChildrenRef.current = children;

  useEffect(() => {
    if (isOpen) {
      setIsMounted(true);
      setPhase('opening');
      const frame = window.requestAnimationFrame(() => setPhase('open'));
      return () => window.cancelAnimationFrame(frame);
    }

    if (!isMounted) return undefined;
    setPhase('closing');
    const timeout = window.setTimeout(() => setIsMounted(false), EXIT_DURATION_MS);
    return () => window.clearTimeout(timeout);
  }, [isMounted, isOpen]);

  useEffect(() => {
    if (!isMounted) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMounted]);

  if ((!isMounted && !isOpen) || typeof document === 'undefined') return null;

  const renderedPhase = isOpen && !isMounted ? 'opening' : phase;

  return createPortal(
    <div className="modal-presence" data-state={renderedPhase}>
      {renderedChildrenRef.current}
    </div>,
    document.body
  );
}
