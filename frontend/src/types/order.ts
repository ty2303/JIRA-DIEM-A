export type OrderStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'SHIPPING'
  | 'DELIVERED'
  | 'CANCELLED';

export type PaymentMethod = 'COD' | 'MOMO';

/** UNPAID   — COD chưa thanh toán (mặc định COD)
 *  PENDING  — MoMo đã khởi tạo, chờ xác nhận từ cổng thanh toán
 *  PAID     — Đã thanh toán thành công
 *  FAILED   — Thanh toán thất bại hoặc hết hạn
 *  REFUNDED — Đã hoàn tiền
 */
export type PaymentStatus =
  | 'UNPAID'
  | 'PENDING'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export interface OrderItem {
  productId: string;
  productName: string;
  productImage: string;
  brand: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  userId: string;
  email: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  ward: string;
  note?: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discount: number;
  total: number;
  createdAt: string;
  paidAt?: string | null;
  paymentStatus: PaymentStatus;
  momoTransactionId?: string | null;
  momoRequestId?: string | null;
  cancelReason?: string;
  cancelledBy?: 'USER' | 'ADMIN';
}

export interface CreateOrderPayload {
  email: string;
  customerName: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  ward: string;
  note?: string;
  paymentMethod: PaymentMethod;
  items: OrderItem[];
  discount?: number;
}

export interface MomoPayment {
  partnerCode: string;
  requestId: string;
  orderId: string;
  amount: string;
  resultCode: number;
  message: string;
  payUrl: string | null;
  paymentUrl: string | null;
  deeplink?: string | null;
  qrCodeUrl?: string | null;
  deeplinkMiniApp?: string | null;
  responseTime?: string | number | null;
  signature?: string | null;
}

export interface CreateMomoOrderResponse {
  order: Order;
  payment: MomoPayment;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  SHIPPING: 'Đang giao',
  DELIVERED: 'Đã giao',
  CANCELLED: 'Đã hủy',
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  UNPAID: 'Chưa thanh toán',
  PENDING: 'Đang xử lý',
  PAID: 'Đã thanh toán',
  FAILED: 'Thanh toán thất bại',
  REFUNDED: 'Đã hoàn tiền',
};

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  COD: 'Thanh toán khi nhận hàng',
  MOMO: 'Ví MoMo',
};

/** Predefined cancel reasons (similar to Shopee). */
export const CANCEL_REASONS = [
  'Tôi muốn thay đổi địa chỉ giao hàng',
  'Tôi muốn thay đổi sản phẩm (size, màu, số lượng)',
  'Tôi không có nhu cầu mua nữa',
  'Tôi tìm được giá rẻ hơn ở chỗ khác',
  'Tôi đặt nhầm sản phẩm',
  'Thời gian giao hàng quá lâu',
  'Khác',
] as const;

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  PENDING: 'bg-yellow-50 text-yellow-700',
  CONFIRMED: 'bg-blue-50 text-blue-700',
  SHIPPING: 'bg-purple-50 text-purple-700',
  DELIVERED: 'bg-green-50 text-green-700',
  CANCELLED: 'bg-red-50 text-red-700',
};

export const PAYMENT_STATUS_COLOR: Record<PaymentStatus, string> = {
  UNPAID: 'bg-gray-50 text-gray-600',
  PENDING: 'bg-yellow-50 text-yellow-700',
  PAID: 'bg-green-50 text-green-700',
  FAILED: 'bg-red-50 text-red-600',
  REFUNDED: 'bg-blue-50 text-blue-700',
};
