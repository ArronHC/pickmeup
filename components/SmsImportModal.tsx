import React, { useState, useEffect } from 'react';
import { SmsReader, SmsMessage, isNativePlatform, formatSmsDate, extractPickupCodePreview } from '../services/smsService';
import { extractInfoFromText } from '../services/extractionService';
import { ExtractedInfo } from '../types';
import { motion, AnimatePresence } from 'framer-motion';

interface SmsImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (info: ExtractedInfo, originalText: string, options?: { sourceTimestamp?: number; preferSourceTimestamp?: boolean }) => boolean;
}

const SmsImportModal: React.FC<SmsImportModalProps> = ({ isOpen, onClose, onImport }) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [messages, setMessages] = useState<SmsMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [processing, setProcessing] = useState<string | null>(null);
    const [batchProcessing, setBatchProcessing] = useState(false);
    const [batchProgress, setBatchProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [startDate, setStartDate] = useState<string>('');
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    useEffect(() => {
        if (isOpen && isNativePlatform()) {
            checkPermission();
        }
        if (isOpen) {
            setSelectedIds(new Set());
            setBatchProcessing(false);
            setBatchProgress(0);
            setError(null);
            setSuccessMessage(null);
        }
    }, [isOpen]);

    const checkPermission = async () => {
        try {
            const result = await SmsReader.checkPermission();
            setHasPermission(result.granted);
            if (result.granted) {
                loadMessages();
            }
        } catch (err) {
            setError('检查权限失败');
        }
    };

    const requestPermission = async () => {
        try {
            setLoading(true);
            const result = await SmsReader.requestPermission();
            setHasPermission(result.granted);
            if (result.granted) {
                loadMessages();
            } else {
                setError('需要短信权限才能读取取件通知');
            }
        } catch (err) {
            setError('请求权限失败');
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (sinceTimestamp?: number) => {
        try {
            setLoading(true);
            setError(null);
            setSelectedIds(new Set());
            const result = await SmsReader.getDeliverySms({
                limit: 200,
                sinceDays: 7,
                ...(sinceTimestamp ? { sinceTimestamp } : {}),
            });
            setMessages(result.messages);
        } catch (err) {
            setError('读取短信失败');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectMessage = async (message: SmsMessage) => {
        try {
            setProcessing(message.id);
            const info = await extractInfoFromText(message.body);
            const added = onImport(info, message.body, { sourceTimestamp: message.date, preferSourceTimestamp: true });
            if (added) {
                onClose();
            } else {
                setError("已存在相同取件码，未导入。");
            }
        } catch (err) {
            const errMsg = err instanceof Error ? err.message : '';
            if (errMsg.includes('未提取到取件码')) {
                setError(`无法从该短信中提取取件码，可能格式不在支持范围内。来源：${message.address}`);
            } else if (errMsg.includes('不是快递')) {
                setError('该短信不是快递取件通知。');
            } else {
                setError(errMsg || '解析短信内容失败，请重试');
            }
        } finally {
            setProcessing(null);
        }
    };

    const handleToggleSelect = (id: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleRowClick = (message: SmsMessage) => {
        if (batchProcessing) return;
        if (selectedIds.size > 0) {
            handleToggleSelect(message.id);
            return;
        }
        handleSelectMessage(message);
    };

    const handleSelectAll = () => {
        setSelectedIds(prev => {
            const next = new Set<string>();
            if (prev.size === messages.length) {
                return next;
            }
            messages.forEach(message => next.add(message.id));
            return next;
        });
    };

    const handleBatchImport = async () => {
        if (selectedIds.size === 0) return;
        setBatchProcessing(true);
        setBatchProgress(0);
        setError(null);
        setSuccessMessage(null);

        const selectedMessages = messages.filter(message => selectedIds.has(message.id));
        let failedCount = 0;
        let duplicateCount = 0;
        let successCount = 0;
        const failedSources: string[] = [];

        for (let index = 0; index < selectedMessages.length; index += 1) {
            const message = selectedMessages[index];
            try {
                const info = await extractInfoFromText(message.body);
                const added = onImport(info, message.body, { sourceTimestamp: message.date, preferSourceTimestamp: true });
                if (!added) {
                    duplicateCount += 1;
                } else {
                    successCount += 1;
                }
            } catch (err) {
                failedCount += 1;
                failedSources.push(message.address);
            } finally {
                setBatchProgress(index + 1);
            }
        }

        setBatchProcessing(false);
        setSelectedIds(new Set());

        const errorParts: string[] = [];
        if (failedCount > 0) {
            const sourcesPreview = failedSources.slice(0, 3).join('、');
            const extra = failedSources.length > 3 ? `等 ${failedSources.length} 条` : '';
            errorParts.push(`${failedCount} 条无法提取取件码（${sourcesPreview}${extra}）`);
        }
        if (duplicateCount > 0) {
            errorParts.push(`${duplicateCount} 条已存在相同取件码`);
        }
        if (errorParts.length > 0) {
            setError(errorParts.join('；'));
        }
        if (successCount > 0) {
            setSuccessMessage(`成功导入 ${successCount} 条短信`);
        }
        if (failedCount === 0 && duplicateCount === 0) {
            onClose();
        }
    };

    const handleStartDateChange = (value: string) => {
        setStartDate(value);
        if (!value) {
            loadMessages();
            return;
        }
        const sinceTimestamp = new Date(`${value}T00:00:00`).getTime();
        if (!Number.isNaN(sinceTimestamp)) {
            loadMessages(sinceTimestamp);
        }
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
                        onClick={onClose}
                    />

                    {/* Modal */}
                    <motion.div 
                        initial={{ y: "100%" }}
                        animate={{ y: 0 }}
                        exit={{ y: "100%" }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative w-full max-w-lg glass-panel bg-white/95 dark:bg-slate-900/95 rounded-t-[28px] shadow-2xl max-h-[85vh] flex flex-col pointer-events-auto"
                    >
                        {/* Handle */}
                        <div className="flex justify-center pt-3 pb-2" onClick={onClose}>
                            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
                        </div>

                        {/* Header */}
                        <div className="px-6 pb-4 border-b border-gray-200/50 dark:border-gray-700/50">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                                    从短信导入
                                </h2>
                                <button
                                    onClick={onClose}
                                    className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400 active-scale"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                    </svg>
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                支持批量识别并可指定开始日期
                            </p>
                            {isNativePlatform() && hasPermission === true && (
                                <motion.div 
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    className="mt-3 flex flex-col gap-2"
                                >
                                    <div className="flex items-center gap-2">
                                        <label className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                            开始日期
                                        </label>
                                        <input
                                            type="date"
                                            value={startDate}
                                            onChange={(e) => handleStartDateChange(e.target.value)}
                                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-slate-700 text-sm text-gray-700 dark:text-gray-100"
                                        />
                                        <button
                                            onClick={() => handleStartDateChange('')}
                                            className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                                        >
                                            最近7天
                                        </button>
                                    </div>
                                    <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/60 rounded-xl px-3 py-2">
                                        <div className="text-xs text-gray-500 dark:text-gray-300">
                                            已选择 {selectedIds.size} 条
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={handleSelectAll}
                                                disabled={messages.length === 0 || batchProcessing}
                                                className="px-2.5 py-1.5 text-xs font-semibold text-gray-500 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white disabled:opacity-50"
                                            >
                                                {selectedIds.size === messages.length && messages.length > 0 ? '取消全选' : '全选'}
                                            </button>
                                            <button
                                                onClick={handleBatchImport}
                                                disabled={selectedIds.size === 0 || batchProcessing}
                                                className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-50 transition-colors"
                                            >
                                                {batchProcessing ? `识别中 ${batchProgress}/${selectedIds.size}` : '批量识别'}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>

                        {/* Content */}
                        <div className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar">
                            {!isNativePlatform() && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-blue-600 dark:text-blue-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        需要 Android 应用
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-[250px]">
                                        短信读取功能仅在 Android 应用中可用，请安装 APK 后使用。
                                    </p>
                                </div>
                            )}

                            {isNativePlatform() && hasPermission === false && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-amber-600 dark:text-amber-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        需要短信权限
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-[250px]">
                                        为了自动识别取件码，我们需要读取您的短信。您的数据仅在本地处理。
                                    </p>
                                    <motion.button
                                        whileTap={{ scale: 0.95 }}
                                        onClick={requestPermission}
                                        disabled={loading}
                                        className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors disabled:opacity-50 shadow-lg shadow-blue-500/30"
                                    >
                                        {loading ? '请求中...' : '授权读取短信'}
                                    </motion.button>
                                </div>
                            )}

                            {isNativePlatform() && hasPermission === true && loading && (
                                <div className="flex flex-col items-center justify-center py-12">
                                    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                    <p className="text-gray-500 dark:text-gray-400 mt-4">正在读取短信...</p>
                                </div>
                            )}

                            {isNativePlatform() && hasPermission === true && !loading && messages.length === 0 && (
                                <div className="flex flex-col items-center justify-center py-12 text-center">
                                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-gray-400">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 9v.906a2.25 2.25 0 01-1.183 1.981l-6.478 3.488M2.25 9v.906a2.25 2.25 0 001.183 1.981l6.478 3.488m8.839 2.51l-4.66-2.51m0 0l-1.023-.55a2.25 2.25 0 00-2.134 0l-1.022.55m0 0l-4.661 2.51m16.5 1.615a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V8.844a2.25 2.25 0 011.183-1.98l7.5-4.04a2.25 2.25 0 012.134 0l7.5 4.04a2.25 2.25 0 011.183 1.98V19.5z" />
                                        </svg>
                                    </div>
                                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                        暂无快递短信
                                    </h3>
                                    <p className="text-gray-500 dark:text-gray-400 mt-2 max-w-[250px]">
                                        最近7天内没有发现快递相关短信
                                    </p>
                                    <button
                                        onClick={loadMessages}
                                        className="mt-4 text-blue-600 dark:text-blue-400 font-medium"
                                    >
                                        刷新
                                    </button>
                                </div>
                            )}

                            {isNativePlatform() && hasPermission === true && !loading && messages.length > 0 && (
                                <motion.div 
                                    initial="hidden"
                                    animate="visible"
                                    variants={{
                                        hidden: { opacity: 0 },
                                        visible: {
                                            opacity: 1,
                                            transition: {
                                                staggerChildren: 0.05
                                            }
                                        }
                                    }}
                                    className="space-y-3"
                                >
                                    {messages.map((message) => {
                                        const previewCode = extractPickupCodePreview(message.body);
                                        const isProcessing = processing === message.id;
                                        const isSelected = selectedIds.has(message.id);

                                        return (
                                            <motion.button
                                                key={message.id}
                                                variants={{
                                                    hidden: { opacity: 0, y: 10 },
                                                    visible: { opacity: 1, y: 0 }
                                                }}
                                                onClick={() => handleRowClick(message)}
                                                disabled={isProcessing || batchProcessing}
                                                className={`w-full text-left p-4 rounded-2xl transition-colors disabled:opacity-50 active:scale-[0.98]
                                                    ${isSelected
                                                        ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700'
                                                        : 'bg-gray-50 dark:bg-slate-800/50 hover:bg-gray-100 dark:hover:bg-slate-800'
                                                    }`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <input
                                                                type="checkbox"
                                                                checked={isSelected}
                                                                onChange={() => handleToggleSelect(message.id)}
                                                                onClick={(e) => e.stopPropagation()}
                                                                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                                            />
                                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                                {message.address}
                                                            </span>
                                                            <span className="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">
                                                                {formatSmsDate(message.date)}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                                                            {message.body}
                                                        </p>
                                                        {previewCode && (
                                                            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                                                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-blue-600 dark:text-blue-400">
                                                                    <path fillRule="evenodd" d="M4.5 2A1.5 1.5 0 003 3.5v13A1.5 1.5 0 004.5 18h11a1.5 1.5 0 001.5-1.5V7.621a1.5 1.5 0 00-.44-1.06l-4.12-4.122A1.5 1.5 0 0011.378 2H4.5zm2.25 8.5a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5zm0 3a.75.75 0 000 1.5h6.5a.75.75 0 000-1.5h-6.5z" clipRule="evenodd" />
                                                                </svg>
                                                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                                                    取件码: {previewCode}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {isProcessing ? (
                                                            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                                        ) : (
                                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-gray-400">
                                                                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                                            </svg>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.button>
                                        );
                                    })}
                                </motion.div>
                            )}

                            {successMessage && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-xl"
                                >
                                    <p className="text-sm text-green-700 dark:text-green-300">{successMessage}</p>
                                </motion.div>
                            )}

                            {error && (
                                <motion.div 
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl"
                                >
                                    <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
                                </motion.div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default SmsImportModal;
