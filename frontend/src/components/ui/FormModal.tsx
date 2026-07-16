import { useEffect, useId, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertTriangle, Pencil, Trash2, X } from 'lucide-react';
import Button from './Button';
import ModalRenderer from './ModalRenderer';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

type FormModalProps = {
  children: ReactNode;
  className?: string;
  closeLabel: string;
  description?: string;
  dirtyKey?: string;
  initialFocusId?: string;
  isOpen: boolean;
  onClose: () => void;
  title: string;
};

export default function FormModal({
  children,
  className = '',
  closeLabel,
  description,
  dirtyKey,
  initialFocusId,
  isOpen,
  onClose,
  title
}: FormModalProps) {
  const generatedTitleId = useId();
  const confirmRef = useRef<HTMLElement>(null);
  const currentDirtyKeyRef = useRef(dirtyKey);
  const dialogRef = useRef<HTMLElement>(null);
  const dirtyBaselineRef = useRef<string | undefined>(undefined);
  const initialFocusIdRef = useRef(initialFocusId);
  const onCloseRef = useRef(onClose);
  const requestCloseRef = useRef<() => void>(() => undefined);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const showDiscardPromptRef = useRef(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

  currentDirtyKeyRef.current = dirtyKey;
  initialFocusIdRef.current = initialFocusId;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    showDiscardPromptRef.current = showDiscardPrompt;
  }, [showDiscardPrompt]);

  const closeWithoutPrompt = () => {
    showDiscardPromptRef.current = false;
    setShowDiscardPrompt(false);
    onCloseRef.current();
  };

  const requestClose = () => {
    const hasUnsavedChanges = dirtyBaselineRef.current !== undefined
      && currentDirtyKeyRef.current !== undefined
      && currentDirtyKeyRef.current !== dirtyBaselineRef.current;

    if (hasUnsavedChanges) {
      showDiscardPromptRef.current = true;
      setShowDiscardPrompt(true);
      window.requestAnimationFrame(() => {
        confirmRef.current?.querySelector<HTMLElement>('[data-confirm-cancel]')?.focus();
      });
      return;
    }
    closeWithoutPrompt();
  };

  const keepEditing = () => {
    showDiscardPromptRef.current = false;
    setShowDiscardPrompt(false);
  };

  requestCloseRef.current = requestClose;

  useEffect(() => {
    if (!isOpen) return undefined;

    dirtyBaselineRef.current = currentDirtyKeyRef.current;
    setShowDiscardPrompt(false);

    returnFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;

    const focusFrame = window.requestAnimationFrame(() => {
      const initialTarget = initialFocusIdRef.current
        ? dialogRef.current?.querySelector<HTMLElement>(`#${CSS.escape(initialFocusIdRef.current)}`)
        : null;
      (initialTarget ?? dialogRef.current?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? dialogRef.current)?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showDiscardPromptRef.current) {
          event.preventDefault();
          showDiscardPromptRef.current = false;
          setShowDiscardPrompt(false);
          return;
        }

        const hasOpenChildPopup = dialogRef.current?.querySelector(
          '.date-picker-popover, [role="combobox"][aria-expanded="true"]'
        );
        if (hasOpenChildPopup) return;

        event.preventDefault();
        requestCloseRef.current();
        return;
      }

      const focusRoot = showDiscardPromptRef.current ? confirmRef.current : dialogRef.current;
      if (event.key !== 'Tab' || !focusRoot) return;

      const focusableElements = Array.from(
        focusRoot.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((element) => element.getClientRects().length > 0 && !element.closest('[inert]'));

      if (focusableElements.length === 0) {
        event.preventDefault();
        focusRoot.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const activeElement = document.activeElement;

      if (!focusRoot.contains(activeElement)) {
        event.preventDefault();
        firstElement.focus();
      } else if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleKeyDown);

      window.requestAnimationFrame(() => {
        if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      });
    };
  }, [isOpen]);

  const titleId = `form-modal-${generatedTitleId.replace(/:/g, '')}`;
  const dialogClasses = ['modal-dialog', className].filter(Boolean).join(' ');

  return (
    <ModalRenderer isOpen={isOpen}>
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) requestClose();
        }}
      >
        <section
          aria-labelledby={titleId}
          aria-modal="true"
          className={dialogClasses}
          onClickCapture={(event) => {
            const target = event.target as HTMLElement;
            if (!target.closest('[data-modal-close]')) return;
            event.preventDefault();
            event.stopPropagation();
            requestClose();
          }}
          ref={dialogRef}
          role="dialog"
          tabIndex={-1}
          inert={showDiscardPrompt}
        >
          <div className="modal-header">
            <div>
              <h3 className="section-title" id={titleId}>{title}</h3>
              {description ? <p className="section-copy">{description}</p> : null}
            </div>
            <button
              aria-label={closeLabel}
              className="icon-button"
              data-tooltip="Close"
              onClick={requestClose}
              type="button"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          {children}

        </section>

        {showDiscardPrompt ? (
          <div className="modal-discard-backdrop" role="presentation">
            <section
              aria-labelledby={`${titleId}-discard-title`}
              aria-modal="true"
              className="modal-discard-dialog"
              ref={confirmRef}
              role="alertdialog"
            >
              <div className="modal-discard-icon" aria-hidden="true">
                <AlertTriangle size={22} />
              </div>
              <div>
                <h4 className="section-title" id={`${titleId}-discard-title`}>Discard unsaved changes?</h4>
                <p className="section-copy">The information entered in this window has not been saved.</p>
              </div>
              <div className="modal-form-actions">
                <Button
                  data-confirm-cancel
                  onClick={keepEditing}
                  variant="secondary"
                >
                  <Pencil aria-hidden="true" size={18} />
                  Keep Editing
                </Button>
                <Button onClick={closeWithoutPrompt} variant="danger">
                  <Trash2 aria-hidden="true" size={18} />
                  Discard Changes
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </ModalRenderer>
  );
}
