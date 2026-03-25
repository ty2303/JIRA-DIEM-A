import { useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { CANCEL_REASONS } from '@/types/order';

interface CancelOrderModalProps {
  orderId: string;
  onConfirm: (orderId: string, reason: string) => Promise<void>;
  onClose: () => void;
}

export default function CancelOrderModal({
  orderId,
  onConfirm,
  onClose,
}: CancelOrderModalProps) {
  const [selectedReason, setSelectedReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const [loading, setLoading] = useState(false);

  const finalReason =
    selectedReason === 'Khác' ? otherReason.trim() || 'Khác' : selectedReason;
  const canSubmit =
    selectedReason !== '' &&
    (selectedReason !== 'Khác' || otherReason.trim() !== '');

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setLoading(true);
    try {
      await onConfirm(orderId, finalReason);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 px-6 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-gray-800">Hủy đơn hàng</h3>
            <p className="text-xs text-gray-400">
              #{orderId.slice(-8).toUpperCase()}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5">
          <p className="mb-4 text-sm font-medium text-gray-700">
            Vui lòng chọn lý do hủy đơn hàng:
          </p>

          <div className="space-y-2">
            {CANCEL_REASONS.map((reason) => (
              <label
                key={reason}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-all ${
                  selectedReason === reason
                    ? 'border-red-300 bg-red-50 text-red-700'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="cancelReason"
                  value={reason}
                  checked={selectedReason === reason}
                  onChange={(e) => setSelectedReason(e.target.value)}
                  className="accent-red-500"
                />
                {reason}
              </label>
            ))}
          </div>

          {/* Other reason text input */}
          {selectedReason === 'Khác' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="mt-3"
            >
              <textarea
                value={otherReason}
                onChange={(e) => setOtherReason(e.target.value)}
                placeholder="Nhập lý do cụ thể..."
                maxLength={500}
                rows={3}
                className="w-full resize-none rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none placeholder:text-gray-400 focus:border-red-300 focus:bg-white focus:ring-1 focus:ring-red-200"
              />
              <p className="mt-1 text-right text-xs text-gray-400">
                {otherReason.length}/500
              </p>
            </motion.div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 transition-colors hover:bg-gray-50"
          >
            Không, giữ đơn hàng
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || loading}
            className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Xác nhận hủy'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
