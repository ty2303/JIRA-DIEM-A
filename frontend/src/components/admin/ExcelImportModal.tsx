/**
 * ExcelImportModal - Import sản phẩm từ file Excel (.xlsx / .xls)
 *
 * Cột Excel mẫu (theo thứ tự):
 * name | brand | price | originalPrice | image | categoryId | rating | badge | specs
 */
import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  X,
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  FileSpreadsheet,
  Loader2,
  Trash2,
} from 'lucide-react';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { CreateProductPayload } from '@/types/product';
import type { ApiResponse } from '@/api/types';
import type { Product } from '@/types/product';

interface Props {
  onClose: () => void;
  onSuccess: () => void;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

const EXCEL_COLUMNS = [
  'name',
  'brand',
  'price',
  'originalPrice',
  'image',
  'categoryId',
  'rating',
  'badge',
  'specs',
] as const;

/** Validate một row từ Excel */
function validateRow(row: Record<string, unknown>, index: number): RowError[] {
  const errors: RowError[] = [];
  if (!row.name || String(row.name).trim() === '') {
    errors.push({
      row: index + 2,
      field: 'name',
      message: 'Tên sản phẩm không được để trống',
    });
  }
  if (!row.brand || String(row.brand).trim() === '') {
    errors.push({
      row: index + 2,
      field: 'brand',
      message: 'Thương hiệu không được để trống',
    });
  }
  if (!row.image || String(row.image).trim() === '') {
    errors.push({
      row: index + 2,
      field: 'image',
      message: 'URL ảnh không được để trống',
    });
  }
  const price = Number(row.price);
  if (isNaN(price) || price < 0) {
    errors.push({
      row: index + 2,
      field: 'price',
      message: 'Giá phải là số không âm',
    });
  }
  return errors;
}

/** Chuyển row Excel → CreateProductPayload */
function rowToPayload(row: Record<string, unknown>): CreateProductPayload {
  return {
    name: String(row.name ?? '').trim(),
    brand: String(row.brand ?? '').trim(),
    price: Number(row.price ?? 0),
    originalPrice: row.originalPrice ? Number(row.originalPrice) : undefined,
    image: String(row.image ?? '').trim(),
    categoryId: row.categoryId ? String(row.categoryId).trim() : undefined,
    rating: row.rating ? Number(row.rating) : 0,
    badge: row.badge ? String(row.badge).trim() : undefined,
    specs: row.specs ? String(row.specs).trim() : undefined,
  };
}

/** Tải file Excel mẫu */
function downloadTemplate() {
  const ws = XLSX.utils.aoa_to_sheet([
    [...EXCEL_COLUMNS],
    [
      'iPhone 16 Pro Max',
      'Apple',
      35990000,
      39990000,
      'https://example.com/iphone16.png',
      '',
      4.9,
      'Hot',
      'Chip A18 Pro, Camera 48MP, 6.9 inch',
    ],
    [
      'Samsung Galaxy S25 Ultra',
      'Samsung',
      31990000,
      '',
      'https://example.com/s25ultra.png',
      '',
      4.8,
      'New',
      'Snapdragon 8 Elite, 200MP, 6.9 inch',
    ],
  ]);

  // Đặt độ rộng cột
  ws['!cols'] = [
    { wch: 30 },
    { wch: 15 },
    { wch: 15 },
    { wch: 15 },
    { wch: 40 },
    { wch: 20 },
    { wch: 8 },
    { wch: 10 },
    { wch: 40 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');
  XLSX.writeFile(wb, 'template_san_pham.xlsx');
}

export default function ExcelImportModal({ onClose, onSuccess }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<CreateProductPayload[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    success: number;
    message: string;
  } | null>(null);

  const handleFile = (file: File) => {
    setFileName(file.name);
    setErrors([]);
    setRows([]);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
        defval: '',
      });

      const allErrors: RowError[] = [];
      const validRows: CreateProductPayload[] = [];

      rawRows.forEach((row, i) => {
        const rowErrors = validateRow(row, i);
        if (rowErrors.length > 0) {
          allErrors.push(...rowErrors);
        } else {
          validRows.push(rowToPayload(row));
        }
      });

      setErrors(allErrors);
      setRows(validRows);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const res = await apiClient.post<ApiResponse<Product[]>>(
        ENDPOINTS.PRODUCTS.BATCH,
        rows,
      );
      setImportResult({
        success: res.data.data.length,
        message: `Đã thêm thành công ${res.data.data.length} sản phẩm!`,
      });
      onSuccess();
    } catch {
      setImportResult({
        success: 0,
        message: 'Import thất bại, vui lòng thử lại.',
      });
    } finally {
      setImporting(false);
    }
  };

  const reset = () => {
    setRows([]);
    setErrors([]);
    setFileName('');
    setImportResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
      <div className="flex w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-green-400 to-emerald-600">
              <FileSpreadsheet className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800">Import từ Excel</h3>
              <p className="text-xs text-gray-400">
                Tải lên file .xlsx để thêm nhiều sản phẩm cùng lúc
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Download template */}
          <div className="flex items-center justify-between rounded-xl border border-dashed border-green-300 bg-green-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-green-700">
                Tải file mẫu Excel
              </p>
              <p className="text-xs text-green-600">
                Điền dữ liệu vào file mẫu rồi upload lại
              </p>
            </div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-white hover:bg-green-600 transition-colors"
            >
              <Download className="h-4 w-4" />
              Tải mẫu
            </button>
          </div>

          {/* Cột Excel */}
          <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
              Các cột trong file Excel (theo thứ tự)
            </p>
            <div className="flex flex-wrap gap-2">
              {[
                { col: 'name', req: true },
                { col: 'brand', req: true },
                { col: 'price', req: true },
                { col: 'originalPrice', req: false },
                { col: 'image', req: true },
                { col: 'categoryId', req: false },
                { col: 'rating', req: false },
                { col: 'badge', req: false },
                { col: 'specs', req: false },
              ].map(({ col, req }) => (
                <span
                  key={col}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    req
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {col}
                  {req && <span className="ml-0.5 text-red-400">*</span>}
                </span>
              ))}
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 py-10 text-center transition-colors hover:border-purple-400 hover:bg-purple-50"
          >
            <Upload className="h-10 w-10 text-gray-300" />
            <p className="mt-3 text-sm font-medium text-gray-600">
              Kéo thả file vào đây hoặc{' '}
              <span className="text-purple-600 underline">chọn file</span>
            </p>
            <p className="mt-1 text-xs text-gray-400">Hỗ trợ .xlsx, .xls</p>
            {fileName && (
              <div className="mt-3 flex items-center gap-2 rounded-lg bg-white px-3 py-1.5 shadow-sm">
                <FileSpreadsheet className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium text-gray-700">
                  {fileName}
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    reset();
                  }}
                  className="cursor-pointer text-gray-400 hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </div>

          {/* Lỗi validation */}
          {errors.length > 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <p className="text-sm font-semibold text-red-600">
                  {errors.length} lỗi tìm thấy — Các hàng lỗi sẽ bị bỏ qua
                </p>
              </div>
              <ul className="space-y-1">
                {errors.slice(0, 8).map((err, i) => (
                  <li key={i} className="text-xs text-red-500">
                    • Hàng {err.row} — <strong>{err.field}</strong>:{' '}
                    {err.message}
                  </li>
                ))}
                {errors.length > 8 && (
                  <li className="text-xs text-red-400">
                    ... và {errors.length - 8} lỗi khác
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* Preview bảng */}
          {rows.length > 0 && !importResult && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-700">
                  Preview —{' '}
                  <span className="text-purple-600">
                    {rows.length} sản phẩm hợp lệ
                  </span>
                </p>
              </div>
              <div className="overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-gray-50 text-left font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Tên</th>
                      <th className="px-3 py-2">Thương hiệu</th>
                      <th className="px-3 py-2">Giá</th>
                      <th className="px-3 py-2">Ảnh</th>
                      <th className="px-3 py-2">Badge</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-gray-800 max-w-[160px] truncate">
                          {r.name}
                        </td>
                        <td className="px-3 py-2 text-gray-500">{r.brand}</td>
                        <td className="px-3 py-2 text-purple-600 font-semibold">
                          {Number(r.price).toLocaleString('vi-VN')}₫
                        </td>
                        <td className="px-3 py-2 max-w-[120px] truncate text-gray-400">
                          {r.image}
                        </td>
                        <td className="px-3 py-2">
                          {r.badge ? (
                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-orange-500 font-medium">
                              {r.badge}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 10 && (
                  <p className="px-3 py-2 text-xs text-gray-400 bg-gray-50 text-center">
                    ... và {rows.length - 10} sản phẩm khác
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Kết quả import */}
          {importResult && (
            <div
              className={`flex items-center gap-3 rounded-xl p-4 ${
                importResult.success > 0
                  ? 'bg-green-50 border border-green-200'
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {importResult.success > 0 ? (
                <CheckCircle className="h-6 w-6 shrink-0 text-green-500" />
              ) : (
                <AlertCircle className="h-6 w-6 shrink-0 text-red-500" />
              )}
              <p
                className={`text-sm font-semibold ${
                  importResult.success > 0 ? 'text-green-700' : 'text-red-600'
                }`}
              >
                {importResult.message}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 cursor-pointer rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
          >
            {importResult?.success ? 'Đóng' : 'Hủy'}
          </button>
          {!importResult && (
            <button
              type="button"
              onClick={handleImport}
              disabled={rows.length === 0 || importing}
              className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-green-200 hover:shadow-lg disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {importing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Đang import...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Import {rows.length > 0 ? `${rows.length} sản phẩm` : ''}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
