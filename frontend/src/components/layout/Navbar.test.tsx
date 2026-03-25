// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
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
  stock: 5,
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

describe('Navbar cart action', () => {
  test('shows the formatted subtotal beside the cart action when items exist', async () => {
    const [
      { default: Navbar },
      { useAuthStore },
      { useCartStore },
      { useWishlistStore },
    ] = await Promise.all([
      import('@/components/layout/Navbar'),
      import('@/store/useAuthStore'),
      import('@/store/useCartStore'),
      import('@/store/useWishlistStore'),
    ]);

    useCartStore.setState({
      items: [{ product, quantity: 2 }],
      isLoading: false,
    });
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });
    useWishlistStore.setState({ items: [] });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.getByText('55.980.000₫')).toBeInTheDocument();
    expect(screen.getByText('55.980.000₫')).toHaveClass('hidden', 'lg:inline');
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Giỏ hàng, 2 sản phẩm' }),
    ).toHaveAttribute('href', '/cart');
  });

  test('keeps the cart action compact when the cart is empty', async () => {
    const [
      { default: Navbar },
      { useAuthStore },
      { useCartStore },
      { useWishlistStore },
    ] = await Promise.all([
      import('@/components/layout/Navbar'),
      import('@/store/useAuthStore'),
      import('@/store/useCartStore'),
      import('@/store/useWishlistStore'),
    ]);

    useCartStore.setState({ items: [], isLoading: false });
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });
    useWishlistStore.setState({ items: [] });

    render(
      <MemoryRouter>
        <Navbar />
      </MemoryRouter>,
    );

    expect(screen.queryByText('0₫')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Giỏ hàng' })).toHaveAttribute(
      'href',
      '/cart',
    );
  });
});
