import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { MemoryRouter } from 'react-router';

import type { Order } from '@/types/order';

vi.mock('@/api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
  },
}));

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const order: Order = {
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
      quantity: 2,
    },
    {
      productId: 'phone-2',
      productName: 'AirPods Pro',
      productImage: 'https://example.com/airpods-pro.png',
      brand: 'Apple',
      price: 6000000,
      quantity: 3,
    },
  ],
  subtotal: 68000000,
  shippingFee: 0,
  discount: 0,
  total: 68000000,
  createdAt: '2026-03-10T10:00:00.000Z',
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
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', createStorageMock());
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Profile order history summary', () => {
  test('shows the summed item quantity in the collapsed order row', async () => {
    const [
      { Component: Profile },
      { default: apiClient },
      { useAuthStore },
      { useOrderStore },
    ] = await Promise.all([
      import('@/pages/Profile'),
      import('@/api/client'),
      import('@/store/useAuthStore'),
      import('@/store/useOrderStore'),
    ]);

    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        data: {
          id: 'user-1',
          username: 'demo',
          email: 'demo@example.com',
          role: 'USER',
          hasPassword: true,
          authProvider: 'LOCAL',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      },
    });

    useAuthStore.setState({
      token: 'token',
      user: {
        id: 'user-1',
        username: 'demo',
        email: 'demo@example.com',
        role: 'USER',
      },
      isLoggedIn: true,
      isAdmin: false,
    });

    useOrderStore.setState({
      orders: [order],
      isLoading: false,
      fetchOrders: vi.fn().mockResolvedValue(undefined),
      cancelOrder: vi.fn().mockResolvedValue(undefined),
    });

    render(
      <MemoryRouter>
        <Profile />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Đơn hàng' }));

    expect(
      await screen.findByRole('button', { name: /5 sản phẩm/ }),
    ).toBeInTheDocument();
    expect(screen.getByText('5 sản phẩm')).toHaveClass(
      'text-sm',
      'text-text-secondary',
    );
  });
});
