import { useEffect, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  title: string;
  icon?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZES = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' };

export function Modal({ open, title, icon, onClose, children, footer, size = 'md' }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-16 overflow-y-auto"
      onMouseDown={onClose}>
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" />
      <div
        className={`relative w-full ${SIZES[size]} bg-white dark:bg-ink-800 rounded-2xl shadow-elevated animate-scale-in`}
        onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
          <h3 className="text-lg font-bold text-ink-800 dark:text-ink-100 flex items-center gap-2">
            {icon && <i className={`fa-solid ${icon} text-royal-600 dark:text-royal-300`}></i>}
            {title}
          </h3>
          <button onClick={onClose}
            className="w-9 h-9 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-ink-700 dark:hover:text-ink-100 transition">
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>
        <div className="px-6 py-5">{children}</div>
        {footer && (
          <footer className="px-6 py-4 border-t border-gray-100 dark:border-white/10 flex justify-end gap-3 bg-gray-50 dark:bg-ink-900/50 rounded-b-2xl">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

interface ConfirmProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open, title, message, confirmText = 'تأكيد', danger, onConfirm, onCancel,
}: ConfirmProps) {
  return (
    <Modal open={open} title={title} icon="fa-circle-question" onClose={onCancel} size="sm"
      footer={
        <>
          <button className="btn-ghost" onClick={onCancel}>إلغاء</button>
          <button className={danger ? 'btn-danger' : 'btn-primary'} onClick={onConfirm}>{confirmText}</button>
        </>
      }>
      <p className="text-ink-600 dark:text-ink-300 leading-relaxed">{message}</p>
    </Modal>
  );
}
