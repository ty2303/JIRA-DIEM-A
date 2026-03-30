// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Order } from '@/types/order';

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const baseOrder: Order = {
  id: 'order-12345678',
  userId: 'user-1',
  email: 'demo@example.com',
  customerName: 'Nguyen Van A',
  phone: '0900000000',
  address: '123 Nguyen Hue',
  city: 'TP. Ho Chi Minh',
  district: 'Quan 1',
  ward: 'Ben Nghe',
  paymentMethod: 'COD',
  status: 'PENDING',
  items: [
    {
      productId: 'phone-1',
      productName: 'iPhone 15 Pro',
      productImage: 'https://example.com/iphone-15-pro.png',
      brand: 'Apple',
      price: 25000000,
      quantity: 1,
    },
  ],
  subtotal: 25000000,
  shippingFee: 0,
  discount: 0,
  total: 25000000,
  createdAt: '2026-03-10T10:00:00.000Z',
  paymentStatus: 'UNPAID',
};

function createStorageMock(): StorageMock {
  const store = new Map<string, string>();

  return {
    getItem: (key) => store.get(key) ?? null,
    setItem: (key, value) => {
      store.set(key, value);
    },
    removeItem: (key) => {
      store.delete(key);
    },
    clear: () => {
      store.clear();
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal('localStorage', createStorageMock());
  vi.stubGlobal('sessionStorage', createStorageMock());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

async function renderCheckoutSuccess(options?: {
  order?: Order | null;
  entry?: string;
  fetchOrderById?: (orderId: string) => Promise<Order | null>;
  cartItems?: Array<{
    product: {
      id: string;
      name: string;
      brand: string;
      categoryId: string;
      categoryName: string;
      price: number;
      originalPrice: number;
      image: string;
      rating: number;
      badge: string;
      specs: string;
      stock: number;
    };
    quantity: number;
  }>;
}) {
  const [{ Component: CheckoutSuccess }, { useOrderStore }, { useCartStore }] =
    await Promise.all([
      import('@/pages/CheckoutSuccess'),
      import('@/store/useOrderStore'),
      import('@/store/useCartStore'),
    ]);

  useOrderStore.setState({
    orders: options?.order ? [options.order] : [],
    currentOrder: options?.order ?? null,
    isLoading: false,
    fetchOrderById:
      options?.fetchOrderById ?? vi.fn().mockResolvedValue(options?.order ?? null),
  });

  useCartStore.setState({
    items: options?.cartItems ?? [],
    isLoading: false,
    clear: vi.fn().mockResolvedValue(undefined),
  });

  await act(async () => {
    render(
      <MemoryRouter initialEntries={[options?.entry ?? '/checkout/success']}>
        <Routes>
          <Route path="/checkout/success" element={<CheckoutSuccess />} />
          <Route path="/products" element={<div>Products page</div>} />
        </Routes>
      </MemoryRouter>,
    );
  });

  return { useOrderStore, useCartStore };
}

describe('CheckoutSuccess page', () => {
  test('renders COD success details without retry payment action', async () => {
    await renderCheckoutSuccess({
      order: baseOrder,
      entry: `/checkout/success?orderId=${baseOrder.id}`,
    });

    expect(
      await screen.findByRole('heading', { name: 'Đặt hàng thành công!' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Thanh toán khi nhận hàng').length).toBeGreaterThan(0);
    expect(screen.getAllByText('25.000.000₫').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('link', { name: 'Thử lại thanh toán' }),
    ).not.toBeInTheDocument();
  });

  test('renders pending MoMo state while waiting for confirmation', async () => {
    const pendingOrder: Order = {
      ...baseOrder,
      id: 'order-pending-1',
      paymentMethod: 'MOMO',
      paymentStatus: 'PENDING',
    };

    await renderCheckoutSuccess({
      order: pendingOrder,
      entry: `/checkout/success?orderId=${pendingOrder.id}&paymentMethod=MOMO&resultCode=0`,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Đang chờ xác nhận thanh toán',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Đang xử lý').length).toBeGreaterThan(0);
    expect(
      screen.queryByRole('link', { name: 'Thử lại thanh toán' }),
    ).not.toBeInTheDocument();
  });

  test('renders cancelled state with gateway message and retry action', async () => {
    const cancelledOrder: Order = {
      ...baseOrder,
      id: 'order-cancelled-1',
      paymentMethod: 'MOMO',
      paymentStatus: 'FAILED',
    };

    await renderCheckoutSuccess({
      order: cancelledOrder,
      entry:
        `/checkout/success?orderId=${cancelledOrder.id}` +
        '&paymentMethod=MOMO&resultCode=1006&message=Giao%20dich%20da%20huy',
    });

    expect(
      await screen.findByRole('heading', { name: 'Giao dịch đã bị hủy' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Giao dich da huy')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Thử lại thanh toán' }),
    ).toHaveAttribute('href', '/cart');
  });

  test('shows friendly fallback when order details cannot be loaded', async () => {
    const fetchOrderById = vi.fn().mockResolvedValue(null);

    await renderCheckoutSuccess({
      order: null,
      entry: '/checkout/success?orderId=missing-order',
      fetchOrderById,
    });

    expect(fetchOrderById).toHaveBeenCalledWith('missing-order');
    expect(
      await screen.findByText('Chưa tải được chi tiết đơn hàng'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tải lại chi tiết đơn hàng' }),
    ).toBeInTheDocument();
  });

  test('redirects to products page when no order context is available', async () => {
    await renderCheckoutSuccess();

    await waitFor(() => {
      expect(screen.getByText('Products page')).toBeInTheDocument();
    });
  });
});
