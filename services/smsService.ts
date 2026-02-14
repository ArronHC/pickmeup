import { registerPlugin } from '@capacitor/core';
import { extractPickupCode } from './pickupTextRules';

export interface SmsMessage {
    id: string;
    address: string;
    body: string;
    date: number;
    isRead: boolean;
}

export interface AutoImportedPackage {
    id: string;
    pickupCode: string;
    location: string;
    address?: string;
    timestamp: string;
    sourceTimestamp?: number;
    originalText: string;
}

export interface SmsReaderPlugin {
    checkPermission(): Promise<{ granted: boolean }>;
    requestPermission(): Promise<{ granted: boolean }>;
    getDeliverySms(options?: { limit?: number; sinceDays?: number; sinceTimestamp?: number }): Promise<{ messages: SmsMessage[] }>;
    getAllSms(options?: { limit?: number }): Promise<{ messages: SmsMessage[] }>;
    getAutoImportedPackages(): Promise<{ packages: AutoImportedPackage[] }>;
    clearAutoImportedPackages(options?: { ids?: string[] }): Promise<{ cleared: number }>;
}

const SmsReader = registerPlugin<SmsReaderPlugin>('SmsReader');

export { SmsReader };

// 辅助函数：检查是否在原生环境中运行
export const isNativePlatform = (): boolean => {
    return typeof (window as any).Capacitor !== 'undefined' &&
        (window as any).Capacitor.isNativePlatform();
};

// 辅助函数：格式化短信日期
export const formatSmsDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return `今天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays === 1) {
        return `昨天 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else if (diffDays < 7) {
        const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
        return `${weekDays[date.getDay()]} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    } else {
        return `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    }
};

// 辅助函数：从短信中预提取取件码（用于预览）
export const extractPickupCodePreview = (body: string): string | null => {
    return extractPickupCode(body);
};
