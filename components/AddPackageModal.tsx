import React, { useState, useRef } from 'react';
import { ImportMethod, ExtractedInfo } from '../types';
import { extractInfoFromText, extractInfosFromImage } from '../services/geminiService';
import { motion, AnimatePresence } from 'framer-motion';

interface AddPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (info: ExtractedInfo, originalText: string, options?: { sourceTimestamp?: number; preferSourceTimestamp?: boolean }) => boolean;
}

const AddPackageModal: React.FC<AddPackageModalProps> = ({ isOpen, onClose, onAdd }) => {
  const [activeTab, setActiveTab] = useState<ImportMethod>(ImportMethod.TEXT);
  const [textInput, setTextInput] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        setError("已存在相同取件码，未导入。");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "提取失败，请检查文本内容并重试。";
      setError(message);
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleImageSubmit = async () => {
    if (!imagePreview) return;
    setIsLoading(true);
    setError(null);
    try {
        const base64Data = imagePreview.split(',')[1];
        const infos = await extractInfosFromImage(base64Data);
        let addedCount = 0;
        for (const info of infos) {
          const added = onAdd(info, "图片识别导入");
          if (added) {
            addedCount += 1;
          }
        }

        if (addedCount > 0) {
          handleClose();
        } else {
          setError("识别到了取件码，但都已存在，未导入。");
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "无法识别图片，请尝试更清晰的截图。";
        setError(message);
        console.error(err);
    } finally {
        setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTextInput('');
    setImagePreview(null);
    setError(null);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center pointer-events-none">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-[2px] pointer-events-auto" 
            onClick={handleClose}
          />
          
          {/* iOS Style Bottom Sheet with Glassmorphism */}
          <motion.div 
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg glass-panel bg-white/90 dark:bg-slate-900/90 border-t border-white/40 dark:border-white/10 rounded-t-[24px] shadow-2xl pointer-events-auto flex flex-col max-h-[90vh] pb-safe"
          >
            
            {/* Grab Handle */}
            <div className="w-full flex justify-center pt-3 pb-2" onClick={handleClose}>
                <div className="w-12 h-1.5 bg-gray-300/50 dark:bg-gray-600/50 rounded-full"></div>
            </div>

            <div className="flex justify-between items-center px-6 pb-4">
              <h2 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">新增取件</h2>
              <button 
                onClick={handleClose} 
                className="w-8 h-8 flex items-center justify-center bg-gray-200/50 dark:bg-gray-700/50 rounded-full text-gray-500 dark:text-gray-300 hover:bg-gray-300/50 dark:hover:bg-gray-600/50 active-scale backdrop-blur-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                </svg>
              </button>
            </div>

            {/* Tabs - Glass Segmented Control */}
            <div className="px-6 mb-6">
                <div className="flex p-1 bg-gray-200/50 dark:bg-black/30 rounded-[10px] backdrop-blur-sm">
                    <button 
                        className={`flex-1 py-1.5 text-[13px] font-semibold rounded-[8px] transition-all shadow-sm duration-300
                        ${activeTab === ImportMethod.TEXT 
                            ? 'bg-white dark:bg-slate-700 text-black dark:text-white' 
                            : 'bg-transparent text-gray-500 dark:text-gray-400 shadow-none'}`}
                        onClick={() => setActiveTab(ImportMethod.TEXT)}
                    >
                        粘贴短信
                    </button>
                    <button 
                        className={`flex-1 py-1.5 text-[13px] font-semibold rounded-[8px] transition-all shadow-sm duration-300
                        ${activeTab === ImportMethod.IMAGE 
                            ? 'bg-white dark:bg-slate-700 text-black dark:text-white' 
                            : 'bg-transparent text-gray-500 dark:text-gray-400 shadow-none'}`}
                        onClick={() => setActiveTab(ImportMethod.IMAGE)}
                    >
                        上传截图
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 pb-8 no-scrollbar">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-4 p-3 bg-red-100/80 dark:bg-red-900/30 text-red-600 dark:text-red-300 text-sm font-medium rounded-xl flex items-center gap-2 backdrop-blur-md"
                >
                   <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                   </svg>
                   {error}
                </motion.div>
              )}

              {activeTab === ImportMethod.TEXT ? (
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div className="bg-white/50 dark:bg-black/20 rounded-xl p-2 border border-white/20 dark:border-white/5 shadow-inner">
                      <textarea
                        className="w-full h-32 p-3 text-[17px] leading-relaxed rounded-lg outline-none resize-none bg-transparent placeholder-gray-400 dark:placeholder-gray-500 text-gray-900 dark:text-white"
                        placeholder="在此粘贴短信内容...&#10;例如: 【顺丰速运】您的包裹已存入丰巢快递柜，取件码 882233。"
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                      />
                  </div>
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleTextSubmit}
                    disabled={isLoading || !textInput.trim()}
                    className={`w-full py-3.5 rounded-[16px] text-[17px] font-semibold text-white transition-all shadow-lg
                      ${isLoading || !textInput.trim() 
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none' 
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'}`}
                  >
                    {isLoading ? '正在识别...' : '智能识别并添加'}
                  </motion.button>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                   <motion.div 
                    whileTap={{ scale: 0.98 }}
                    className="relative w-full h-48 bg-white/40 dark:bg-black/20 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-colors overflow-hidden"
                    onClick={() => fileInputRef.current?.click()}
                   >
                     {imagePreview ? (
                       <img src={imagePreview} alt="Preview" className="w-full h-full object-contain" />
                     ) : (
                       <>
                          <div className="w-12 h-12 bg-gray-100/50 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-3 text-gray-400 dark:text-gray-500 backdrop-blur-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a2.25 2.25 0 002.25-2.25V6a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 6v12a2.25 2.25 0 002.25 2.25zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                            </svg>
                          </div>
                          <span className="text-[15px] font-medium text-gray-500 dark:text-gray-400">点击选择图片</span>
                       </>
                     )}
                     <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        capture="environment"
                        onChange={handleImageUpload}
                     />
                   </motion.div>
                   
                   <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleImageSubmit}
                    disabled={isLoading || !imagePreview}
                    className={`w-full py-3.5 rounded-[16px] text-[17px] font-semibold text-white transition-all shadow-lg
                      ${isLoading || !imagePreview 
                        ? 'bg-gray-300 dark:bg-gray-700 cursor-not-allowed shadow-none' 
                        : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/30'}`}
                  >
                    {isLoading ? '正在分析...' : '识别并添加'}
                  </motion.button>
                </motion.div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default AddPackageModal;
