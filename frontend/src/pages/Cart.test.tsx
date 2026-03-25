// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import type { Product } from '@/types/product';

type StorageMock = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear: () => void;
};

const product: Product = {
  id: 'prod-iphone-15',
  name: 'iPhone 15 Pro',
  brand: 'Apple',
  categoryId: 'cat-iphone',
  categoryName: 'iPhone',
  price: 27990000,
  originalPrice: 30990000,
  image: 'https://example.com/iphone.jpg',
  rating: 4.9,
  badge: 'Ban chay',
  specs: 'A17 Pro, 256GB, Titanium',
  stock: 2,
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
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('Cart quantity controls', () => {
  test('disables the increase button after incrementing to stock limit', async () => {
    const [
      { Component: CartPage },
      { useAuthStore },
      { useCartStore },
      { useToastStore },
    ] = await Promise.all([
      import('@/pages/Cart'),
      import('@/store/useAuthStore'),
      import('@/store/useCartStore'),
      import('@/store/useToastStore'),
    ]);

    useCartStore.setState({
      items: [{ product, quantity: product.stock - 1 }],
      isLoading: false,
    });
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });
    useToastStore.setState({ toasts: [] });

    render(
      <MemoryRouter>
        <CartPage />
      </MemoryRouter>,
    );

    const incrementButton = screen.getByRole('button', {
      name: 'Tăng số lượng',
    });

    fireEvent.click(incrementButton);

    expect(screen.getByText(String(product.stock))).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Tăng số lượng' }),
    ).toBeDisabled();
  });

  test('shows a success toast after removing an item from the cart', async () => {
    const [
      { Component: CartPage },
      { default: ToastContainer },
      { useAuthStore },
      { useCartStore },
      { useToastStore },
    ] = await Promise.all([
      import('@/pages/Cart'),
      import('@/components/ui/ToastContainer'),
      import('@/store/useAuthStore'),
      import('@/store/useCartStore'),
      import('@/store/useToastStore'),
    ]);

    useCartStore.setState({
      items: [{ product, quantity: 1 }],
      isLoading: false,
    });
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });
    useToastStore.setState({ toasts: [] });

    render(
      <MemoryRouter>
        <CartPage />
        <ToastContainer />
      </MemoryRouter>,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: `Xóa ${product.name} khỏi giỏ hàng`,
      }),
    );

    expect(
      screen.getByText(`Đã xóa ${product.name} khỏi giỏ hàng`),
    ).toBeInTheDocument();
  });
});
