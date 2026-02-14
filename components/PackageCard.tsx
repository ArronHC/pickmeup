import React, { useRef, useState } from 'react';
import { PackageData } from '../types';
import { motion } from 'framer-motion';

interface PackageCardProps {
  pkg: PackageData;
  onToggleStatus: (id: string) => void;
  onDelete: (id: string) => void;
}

const PackageCard: React.FC<PackageCardProps> = ({ pkg, onToggleStatus, onDelete }) => {
  const date = new Date(pkg.timestamp);
  // Format: 10月24日 14:30
  const formattedDate = `${date.getMonth() + 1}月${date.getDate()}日 ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
  const expiresAtDate = pkg.expiresAt ? new Date(pkg.expiresAt) : null;
  const formattedExpiresAt = expiresAtDate
    ? `${expiresAtDate.getMonth() + 1}月${expiresAtDate.getDate()}日 ${expiresAtDate.getHours().toString().padStart(2, '0')}:${expiresAtDate.getMinutes().toString().padStart(2, '0')}`
    : null;
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef<number | null>(null);

  const handleCopy = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(pkg.pickupCode);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = pkg.pickupCode;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopied(true);
      if (copyTimer.current) {
        window.clearTimeout(copyTimer.current);
      }
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.error('复制失败', err);
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      className={`relative overflow-hidden rounded-[20px] glass-card border border-white/60 dark:border-white/10
      ${pkg.isPickedUp 
        ? 'bg-gray-100/40 dark:bg-gray-800/20 opacity-70' 
        : 'bg-white dark:bg-slate-800 shadow-sm'
      }`}
    >
      <div className="flex p-5">
        {/* Left Side: Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">{formattedDate}</span>
          </div>
          {pkg.isPickedUp && formattedExpiresAt && (
            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium mb-1">
              过期时间 {formattedExpiresAt}
            </div>
          )}
          
          <div className="my-1.5">
             <div className="text-[10px] text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wider mb-0.5">取件码</div>
             <motion.button
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={handleCopy}
              title="点击复制取件码"
              className={`text-left text-3xl font-bold tracking-tight font-sans transition-colors
                ${pkg.isPickedUp 
                  ? 'text-gray-400 dark:text-gray-600 line-through decoration-2' 
                  : 'text-gray-900 dark:text-white drop-shadow-sm hover:text-blue-700 dark:hover:text-blue-300'
                }`}
            >
              {pkg.pickupCode}
            </motion.button>
            {copied && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-xs font-semibold text-green-600 dark:text-green-400">已复制</motion.div>
            )}
          </div>

          <div className="mt-3 flex items-center gap-1.5 text-gray-600 dark:text-gray-300">
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 opacity-70">
              <path fillRule="evenodd" d="M9.69 18.933l.003.001C9.89 19.02 10 19 10 19s.11.02.308-.066l.002-.001.006-.003.018-.008a5.741 5.741 0 00.281-.14c.186-.096.446-.24.757-.433.62-.384 1.445-.966 2.274-1.765C15.302 14.988 17 12.493 17 9A7 7 0 103 9c0 3.492 1.698 5.988 3.355 7.584a13.731 13.731 0 002.273 1.765 11.842 11.842 0 00.976.544l.062.029.006.003.002.001.003.001a.79.79 0 00.01 0zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
            <span className="text-sm font-medium truncate opacity-90">{pkg.location}</span>
          </div>

          {pkg.address && (
            <div className="mt-2 flex items-start gap-1.5 text-gray-500 dark:text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 flex-shrink-0 opacity-70 mt-0.5">
                <path fillRule="evenodd" d="M10 18a.75.75 0 01-.75-.75v-1.5a.75.75 0 011.5 0V17.5A.75.75 0 0110 18zm0-4a.75.75 0 01-.75-.75v-6a.75.75 0 011.5 0v6A.75.75 0 0110 14zm0-9.5a.75.75 0 01.75.75V6a.75.75 0 01-1.5 0V5.25A.75.75 0 0110 4.5z" clipRule="evenodd" />
              </svg>
              <span className="text-xs leading-relaxed">{pkg.address}</span>
            </div>
          )}
        </div>

        {/* Right Side: Actions */}
        <div className="flex flex-col justify-center pl-4 border-l border-gray-100 dark:border-white/10 ml-2 gap-3">
           <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => onToggleStatus(pkg.id)}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors backdrop-blur-sm shadow-sm
              ${pkg.isPickedUp 
                ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500' 
                : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800/40'
              }`}
          >
            {pkg.isPickedUp ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path fillRule="evenodd" d="M9.53 2.47a.75.75 0 010 1.06L4.81 8.25H15a6.75 6.75 0 010 13.5h-3a.75.75 0 010-1.5h3a5.25 5.25 0 100-10.5H4.81l4.72 4.72a.75.75 0 11-1.06 1.06l-6-6a.75.75 0 010-1.06l6-6a.75.75 0 011.06 0z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            )}
          </motion.button>
          
          <motion.button 
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete(pkg.id)}
            className="w-11 h-11 rounded-full flex items-center justify-center bg-red-100/50 dark:bg-red-900/20 text-red-500 dark:text-red-400 backdrop-blur-sm hover:bg-red-200/50 dark:hover:bg-red-900/40 transition-colors"
          >
             <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.346-9zm5.48.058a.75.75 0 10-1.498-.058l-.347 9a.75.75 0 001.5.058l.345-9z" clipRule="evenodd" />
            </svg>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default PackageCard;
