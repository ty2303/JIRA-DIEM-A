import { beforeEach, describe, expect, test, vi } from 'vitest';

import type { Product } from '@/types/product';

const apiClientMock = {
  delete: vi.fn(),
  get: vi.fn(),
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

describe('useWishlistStore', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    localStorage.clear();

    const { useAuthStore } = await import('@/store/useAuthStore');
    const { useWishlistStore } = await import('@/store/useWishlistStore');

    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });
    useWishlistStore.getState().reset();
  });

  test('keeps wishlist local for guests without calling the API', async () => {
    const { useWishlistStore } = await import('@/store/useWishlistStore');

    await useWishlistStore.getState().toggle(product);

    expect(useWishlistStore.getState().items).toEqual([product]);
    expect(apiClientMock.post).not.toHaveBeenCalled();
  });

  test('reverts optimistic updates when toggle fails for logged-in users', async () => {
    const { useAuthStore } = await import('@/store/useAuthStore');
    const { useWishlistStore } = await import('@/store/useWishlistStore');

    useAuthStore.setState({
      token: 'demo-token',
      user: {
        id: 'user-1',
        username: 'demo',
        email: 'demo@example.com',
        role: 'USER',
      },
      isLoggedIn: true,
      isAdmin: false,
    });
    apiClientMock.post.mockRejectedValueOnce(new Error('Request failed'));

    await useWishlistStore.getState().toggle(product);

    expect(useWishlistStore.getState().items).toEqual([]);
    expect(useWishlistStore.getState().error).toBe(
      'Khong the cap nhat wishlist luc nay.',
    );
  });

  test('syncs guest wishlist into the signed-in user and clears the guest bucket', async () => {
    const { useAuthStore } = await import('@/store/useAuthStore');
    const { useWishlistStore } = await import('@/store/useWishlistStore');

    await useWishlistStore.getState().toggle(product);

    apiClientMock.post.mockResolvedValueOnce({
      data: {
        data: [product],
      },
    });

    useAuthStore.setState({
      token: 'demo-token',
      user: {
        id: 'user-1',
        username: 'demo',
        email: 'demo@example.com',
        role: 'USER',
      },
      isLoggedIn: true,
      isAdmin: false,
    });

    await useWishlistStore.getState().syncSession();

    expect(apiClientMock.post).toHaveBeenCalledWith('/wishlist/sync', {
      productIds: [product.id],
    });
    expect(useWishlistStore.getState().items).toEqual([product]);
    expect(useWishlistStore.getState().itemsByOwner.guest).toBeUndefined();
    expect(useWishlistStore.getState().itemsByOwner['user-1']).toEqual([
      product,
    ]);
  });

  test('switches between guest and user-specific wishlist buckets', async () => {
    const { useAuthStore } = await import('@/store/useAuthStore');
    const { useWishlistStore } = await import('@/store/useWishlistStore');

    useWishlistStore.setState({
      items: [],
      itemsByOwner: {
        guest: [product],
        'user-1': [],
      },
      currentOwnerKey: 'guest',
      isLoading: false,
      error: null,
    });

    apiClientMock.get.mockResolvedValueOnce({
      data: {
        data: [],
      },
    });

    useAuthStore.setState({
      token: 'demo-token',
      user: {
        id: 'user-1',
        username: 'demo',
        email: 'demo@example.com',
        role: 'USER',
      },
      isLoggedIn: true,
      isAdmin: false,
    });

    await useWishlistStore.getState().syncSession();
    useAuthStore.setState({
      token: null,
      user: null,
      isLoggedIn: false,
      isAdmin: false,
    });

    await useWishlistStore.getState().syncSession();

    expect(useWishlistStore.getState().currentOwnerKey).toBe('guest');
    expect(useWishlistStore.getState().items).toEqual([product]);
  });

  test('restores items when clear fails for logged-in users', async () => {
    const { useAuthStore } = await import('@/store/useAuthStore');
    const { useWishlistStore } = await import('@/store/useWishlistStore');

    useAuthStore.setState({
      token: 'demo-token',
      user: {
        id: 'user-1',
        username: 'demo',
        email: 'demo@example.com',
        role: 'USER',
      },
      isLoggedIn: true,
      isAdmin: false,
    });
    useWishlistStore.setState({
      items: [product],
      isLoading: false,
      error: null,
    });
    apiClientMock.delete.mockRejectedValueOnce(new Error('Delete failed'));

    await useWishlistStore.getState().clear();

    expect(useWishlistStore.getState().items).toEqual([product]);
    expect(useWishlistStore.getState().error).toBe(
      'Khong the xoa wishlist luc nay.',
    );
  });
});
