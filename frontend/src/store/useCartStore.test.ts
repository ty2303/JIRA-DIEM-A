import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { Product } from '@/types/product';

const apiClientMock = {
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
};

vi.mock('@/api/client', () => ({
  default: apiClientMock,
}));

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

const loadStores = async () => {
  const { useAuthStore } = await import('@/store/useAuthStore');
  const { useCartStore } = await import('@/store/useCartStore');
  const { useToastStore } = await import('@/store/useToastStore');

  return { useAuthStore, useCartStore, useToastStore };
};

const resetAuthState = async () => {
  const { useAuthStore } = await import('@/store/useAuthStore');

  useAuthStore.setState({
    token: null,
    user: null,
    isLoggedIn: false,
    isAdmin: false,
  });
};

describe('useCartStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    const { useCartStore, useToastStore } = await loadStores();

    await resetAuthState();
    useCartStore.getState().reset();
    useToastStore.setState({
      toasts: [],
      addToast: vi.fn(),
      removeToast: vi.fn(),
    });
  });

  test('hydrates malformed persisted cart state into a safe empty array', async () => {
    vi.resetModules();
    localStorage.setItem(
      'nebula-cart',
      JSON.stringify({
        state: {
          itemsByOwner: {
            guest: null,
            broken: { quantity: 1 },
          },
          currentOwnerKey: 'guest',
        },
        version: 3,
      }),
    );

    await resetAuthState();

    const { useCartStore } = await loadStores();

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().items.length).toBe(0);
  });

  test('syncs guest cart into the signed-in user and clears the guest bucket', async () => {
    const { useAuthStore, useCartStore } = await loadStores();

    useCartStore.setState({
      items: [{ product, quantity: 2 }],
      itemsByOwner: {
        guest: [{ product, quantity: 2 }],
      },
      currentOwnerKey: 'guest',
      isLoading: false,
      error: null,
    });

    apiClientMock.post.mockResolvedValue({
      data: {
        data: {
          items: [{ productId: product.id, quantity: 2, product }],
          total: product.price * 2,
        },
      },
    });
    apiClientMock.get.mockResolvedValueOnce({
      data: {
        data: {
          items: [{ productId: product.id, quantity: 2, product }],
          total: product.price * 2,
        },
      },
    });

    useAuthStore.setState({
      token: 'demo-token',
      user: {
        id: 'user-1',
        username: 'demo',
        email: 'demo@example.com',
        role: 'USER',
        authProvider: 'local',
        hasPassword: true,
        avatar: null,
      },
      isLoggedIn: true,
      isAdmin: false,
    });

    await useCartStore.getState().syncSession();

    expect(apiClientMock.post).toHaveBeenCalledWith(
      '/cart/items',
      {
        productId: product.id,
        quantity: 2,
      },
      {
        skipAuthRedirect: undefined,
      },
    );
    expect(useCartStore.getState().items).toEqual([{ product, quantity: 2 }]);
    expect(useCartStore.getState().itemsByOwner.guest).toBeUndefined();
    expect(useCartStore.getState().itemsByOwner['user-1']).toEqual([
      { product, quantity: 2 },
    ]);
  });

  test('reset keeps the guest cart bucket while dropping authenticated state', async () => {
    const { useCartStore } = await loadStores();

    useCartStore.setState({
      items: [{ product, quantity: 1 }],
      itemsByOwner: {
        guest: [{ product, quantity: 1 }],
        'user-1': [{ product, quantity: 2 }],
      },
      currentOwnerKey: 'user-1',
      isLoading: true,
      error: 'oops',
    });

    useCartStore.getState().reset({ preserveGuest: true });

    expect(useCartStore.getState().currentOwnerKey).toBe('guest');
    expect(useCartStore.getState().items).toEqual([{ product, quantity: 1 }]);
    expect(useCartStore.getState().itemsByOwner).toEqual({
      guest: [{ product, quantity: 1 }],
    });
    expect(useCartStore.getState().error).toBeNull();
    expect(useCartStore.getState().isLoading).toBe(false);
  });

  test('clears successfully merged guest items when the final cart refresh fails', async () => {
    const { useAuthStore, useCartStore } = await loadStores();

    useCartStore.setState({
      items: [{ product, quantity: 1 }],
      itemsByOwner: {
        guest: [{ product, quantity: 1 }],
      },
      currentOwnerKey: 'guest',
      isLoading: false,
      error: null,
    });

    apiClientMock.post.mockResolvedValueOnce({
      data: {
        data: {
          items: [{ productId: product.id, quantity: 1, product }],
          total: product.price,
        },
      },
    });
    apiClientMock.get.mockRejectedValueOnce(new Error('Refresh failed'));

    useAuthStore.setState({
      token: 'demo-token',
      user: {
        id: 'user-1',
        username: 'demo',
        email: 'demo@example.com',
        role: 'USER',
        authProvider: 'local',
        hasPassword: true,
        avatar: null,
      },
      isLoggedIn: true,
      isAdmin: false,
    });

    await useCartStore.getState().syncSession();

    expect(useCartStore.getState().currentOwnerKey).toBe('user-1');
    expect(useCartStore.getState().itemsByOwner.guest).toBeUndefined();
    expect(useCartStore.getState().error).toMatch(/đồng bộ một phần/i);
  });

  test('keeps guest cart quantities within available stock', async () => {
    const { useCartStore, useToastStore } = await loadStores();

    useCartStore.setState({
      items: [{ product, quantity: product.stock }],
      itemsByOwner: {
        guest: [{ product, quantity: product.stock }],
      },
      currentOwnerKey: 'guest',
      isLoading: false,
      error: null,
    });

    const added = await useCartStore.getState().addItem(product);

    expect(added).toBe(false);
    expect(useCartStore.getState().items).toEqual([
      { product, quantity: product.stock },
    ]);
    expect(apiClientMock.post).not.toHaveBeenCalled();
    expect(useToastStore.getState().addToast).toHaveBeenCalledWith(
      'error',
      `Chỉ còn ${product.stock} sản phẩm`,
    );
  });
});
