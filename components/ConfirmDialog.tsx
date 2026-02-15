import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'danger' | 'default';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = '确定',
  cancelLabel = '取消',
  confirmVariant = 'default',
  onConfirm,
  onCancel,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
          {/* 毛玻璃遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm pointer-events-auto"
            onClick={onCancel}
          />

          {/* iOS 风格居中卡片 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', damping: 25, stiffness: 400 }}
            className="relative w-[270px] bg-white/90 dark:bg-slate-800/90 backdrop-blur-xl rounded-[14px] overflow-hidden shadow-2xl pointer-events-auto"
          >
            {/* 内容区 */}
            <div className="px-4 pt-5 pb-4 text-center">
              <h3 className="text-[17px] font-semibold text-gray-900 dark:text-white leading-snug">
                {title}
              </h3>
              <p className="mt-1 text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
                {message}
              </p>
            </div>

            {/* 分隔线 */}
            <div className="h-px bg-gray-200/80 dark:bg-white/10" />

            {/* 按钮区 */}
            <div className="flex">
              <button
                onClick={onCancel}
                className="flex-1 py-[11px] text-[17px] font-normal text-blue-500 dark:text-blue-400 active:bg-gray-100/50 dark:active:bg-white/5 transition-colors"
              >
                {cancelLabel}
              </button>

              <div className="w-px bg-gray-200/80 dark:bg-white/10" />

              <button
                onClick={onConfirm}
                className={`flex-1 py-[11px] text-[17px] font-semibold active:bg-gray-100/50 dark:active:bg-white/5 transition-colors
                  ${confirmVariant === 'danger'
                    ? 'text-red-500 dark:text-red-400'
                    : 'text-blue-500 dark:text-blue-400'
                  }`}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ConfirmDialog;
