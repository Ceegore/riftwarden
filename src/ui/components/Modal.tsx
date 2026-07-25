import { useEffect, useRef } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';

const FOCUSABLE = [
  'button:not([disabled])',
  '[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface ModalProps {
  open: boolean;
  titleId: string;
  children: ReactNode;
  onRequestClose: () => void;
  initialFocusRef?: { current: HTMLElement | null };
}

export function Modal({ open, titleId, children, onRequestClose, initialFocusRef }: ModalProps) {
  const previous = useRef<HTMLElement | null>(null);
  const panel = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    previous.current = document.activeElement as HTMLElement;
    queueMicrotask(() => initialFocusRef?.current?.focus() ?? panel.current?.focus());
    return () => {
      const target = previous.current;
      if (target?.isConnected) target.focus();
    };
  }, [open, initialFocusRef]);

  if (!open) return null;

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onRequestClose();
      return;
    }
    if (event.key !== 'Tab' || !panel.current) return;
    const focusable = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');
    if (focusable.length === 0) {
      event.preventDefault();
      panel.current.focus();
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1) ?? first;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }

  return <>
    <div className="rw-modal-backdrop" aria-hidden="true" />
    <div
      ref={panel}
      className="rw-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  </>;
}
