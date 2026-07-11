import React, { useState } from 'react';
import { ExtractedInfo } from '../types';
import { extractInfoFromText } from '../services/extractionService';
import { motion, AnimatePresence } from 'framer-motion';

interface AddPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (
    info: ExtractedInfo,
    originalText: string,
    options?: { sourceTimestamp?: number; preferSourceTimestamp?: boolean }
  ) => boolean;
}

const AddPackageModal: React.FC<AddPackageModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleTextSubmit = async () => {
    if (!textInput.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const info = await extractInfoFromText(textInput);
      const added = onAdd(info, textInput);
      if (added) {
        handleClose();
      } else {
        setError('该取件码已存在或已删除（3 天内不再导入）。');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '提取失败，请检查文本内容并重试。';
      setError(message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTextInput('');
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 pointer-events-auto"
            onClick={handleClose}
          />

          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg glass-panel bg-white/90 dark:bg-slate-900/90 border-t border-white/40 dark:border-white/10 rounded-t-[24px] shadow-2xl pointer-events-auto flex flex-col max-h-[90vh] pb-safe"
          >
            <div className="w-full flex justify-center pt-3 pb-2" onClick={handleClose}>
              <div className="w-12 h-1.5 bg-gray-300/50 dark:bg-gray-600/50 rounded-full"></div>
            </div>

            <div className="flex justify-between items-center px-6 pb-4">
              <h2 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
                新增取件
              </h2>
              <button
                onClick={handleClose}
                className="w-8 h-8 flex items-center justify-center bg-gray-200/50 dark:bg-gray-700/50 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-600/50 active-scale"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 no-scrollbar">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm font-medium rounded-xl flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0">
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {error}
                </motion.div>
              )}

              <div className="space-y-4">
                <p className="text-[13px] text-gray-500 dark:text-gray-400">
                  粘贴取件短信，自动识别取件码与地点。
                </p>
                <div className="bg-white/50 dark:bg-black/20 rounded-xl p-2 border border-white/20 dark:border-white/5 shadow-inner">
                  <textarea
                    className="w-full h-36 p-3 text-[17px] leading-relaxed rounded-lg outline-none resize-none bg-transparent placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                    placeholder="在此粘贴短信内容...&#10;例如: 【驿小哥】您的顺丰快递已到…可凭1-5-0366到店提取。"
                    value={textInput}
                    onChange={(event) => setTextInput(event.target.value)}
                  />
                </div>
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  onClick={handleTextSubmit}
                  disabled={isLoading || !textInput.trim()}
                  className={`w-full py-3.5 rounded-[16px] text-[17px] font-semibold text-white transition-all shadow-lg
                    ${
                      isLoading || !textInput.trim()
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'
                    }`}
                >
                  {isLoading ? '正在识别...' : '识别并添加'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddPackageModal;
