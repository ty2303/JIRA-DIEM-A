import { Camera, Loader2, X } from 'lucide-react';

const MAX_IMAGES = 5;
const MAX_SIZE_MB = 2;
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
const ACCEPTED_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

interface ReviewImageUploadProps {
  images: string[];
  onAdd: (file: File) => Promise<void>;
  onRemove: (index: number) => void;
  uploading: boolean;
  disabled?: boolean;
  /** Per-field error from validation */
  error?: string;
  /** Called when image validation fails locally */
  onValidationError?: (message: string) => void;
}

export default function ReviewImageUpload({
  images,
  onAdd,
  onRemove,
  uploading,
  disabled = false,
  error,
  onValidationError,
}: ReviewImageUploadProps) {
  const canAddMore = images.length < MAX_IMAGES;

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    event.target.value = '';

    if (file.size > MAX_SIZE_BYTES) {
      onValidationError?.(`Ảnh đánh giá phải nhỏ hơn ${MAX_SIZE_MB}MB.`);
      return;
    }

    if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
      onValidationError?.('Chỉ hỗ trợ ảnh định dạng JPEG, PNG, WebP hoặc GIF.');
      return;
    }

    try {
      await onAdd(file);
    } catch {
      onValidationError?.('Không thể đọc ảnh đã chọn.');
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {images.map((url, index) => (
          <div key={index} className="group relative">
            <img
              src={url}
              alt={`Ảnh đánh giá ${index + 1}`}
              className="h-20 w-20 rounded-xl border border-border object-cover"
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="absolute -right-1.5 -top-1.5 cursor-pointer rounded-full bg-red-500 p-0.5 text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                aria-label={`Xóa ảnh ${index + 1}`}
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        ))}

        {canAddMore && !disabled && (
          <label
            className={`flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed transition-colors ${
              uploading
                ? 'border-brand/30 bg-brand/5'
                : 'border-border hover:border-brand hover:bg-brand/5'
            }`}
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            ) : (
              <>
                <Camera className="h-5 w-5 text-text-muted" />
                <span className="text-[10px] text-text-muted">Thêm ảnh</span>
              </>
            )}
            <input
              type="file"
              accept={ACCEPTED_TYPES}
              className="hidden"
              disabled={uploading || disabled}
              onChange={(event) => void handleFileChange(event)}
            />
          </label>
        )}
      </div>

      <p className="mt-2 text-xs text-text-muted">
        Tối đa {MAX_IMAGES} ảnh, mỗi ảnh dưới {MAX_SIZE_MB}MB (JPEG, PNG, WebP,
        GIF).
      </p>

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
