import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Tag,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';

import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse, PaginatedResponse } from '@/api/types';
import ProductCard from '@/components/ui/ProductCard';
import type { Category, Product } from '@/types/product';

const ALL_BRANDS = 'Tất cả';
const PRODUCTS_PER_PAGE = 8;
const SEARCH_SUGGESTION_LIMIT = 8;

type SortOption =
  | 'featured'
  | 'price-asc'
  | 'price-desc'
  | 'rating'
  | 'name-asc'
  | 'newest';
type AvailabilityFilter = 'all' | 'in-stock' | 'discount';

const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'featured', label: 'Nổi bật' },
  { value: 'price-asc', label: 'Giá: thấp đến cao' },
  { value: 'price-desc', label: 'Giá: cao đến thấp' },
  { value: 'rating', label: 'Đánh giá cao nhất' },
  { value: 'name-asc', label: 'Tên A-Z' },
  { value: 'newest', label: 'Mới cập nhật' },
];

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-text-muted">
        {label}
      </p>
      <p className="mt-3 font-display text-3xl font-bold text-brand">{value}</p>
      <p className="mt-2 text-sm text-text-secondary">{hint}</p>
    </div>
  );
}

function ProductCardSkeleton({ index }: { index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 4) * 0.05 }}
      className="overflow-hidden rounded-2xl border border-border bg-surface"
    >
      <div className="h-64 animate-pulse bg-surface-alt" />
      <div className="space-y-3 p-5">
        <div className="h-3 w-20 animate-pulse rounded-full bg-surface-alt" />
        <div className="h-5 w-4/5 animate-pulse rounded-full bg-surface-alt" />
        <div className="h-4 w-3/5 animate-pulse rounded-full bg-surface-alt" />
        <div className="h-6 w-2/5 animate-pulse rounded-full bg-surface-alt" />
      </div>
    </motion.div>
  );
}

export function Component() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const searchFromUrl = searchParams.get('q')?.trim() ?? '';
  const [search, setSearch] = useState(searchFromUrl);
  const [selectedBrand, setSelectedBrand] = useState(ALL_BRANDS);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('featured');
  const [availability, setAvailability] = useState<AvailabilityFilter>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const fetchCatalog = async () => {
      setLoading(true);
      setError('');

      try {
        const [productsRes, categoriesRes] = await Promise.all([
          apiClient.get<ApiResponse<PaginatedResponse<Product>>>(
            ENDPOINTS.PRODUCTS.BASE,
            {
              params: { size: 100 },
            },
          ),
          apiClient.get<ApiResponse<Category[]>>(ENDPOINTS.CATEGORIES.BASE),
        ]);

        setProducts(productsRes.data.data.content);
        setCategories(categoriesRes.data.data);
      } catch {
        setError(
          'Không thể tải danh sách sản phẩm lúc này. Vui lòng thử lại sau.',
        );
      } finally {
        setLoading(false);
      }
    };

    void fetchCatalog();
  }, [reloadKey]);

  useEffect(() => {
    if (searchFromUrl !== search) {
      setSearch(searchFromUrl);
    }
  }, [search, searchFromUrl]);

  useEffect(() => {
    const normalizedSearch = search.trim();

    if (normalizedSearch === searchFromUrl) {
      return;
    }

    const nextParams = new URLSearchParams(searchParams);

    if (normalizedSearch) {
      nextParams.set('q', normalizedSearch);
    } else {
      nextParams.delete('q');
    }

    setSearchParams(nextParams, { replace: true });
  }, [search, searchFromUrl, searchParams, setSearchParams]);

  const brands = useMemo(
    () =>
      [
        ALL_BRANDS,
        ...Array.from(
          new Set(products.map((product) => product.brand).filter(Boolean)),
        ).sort((first, second) => first.localeCompare(second, 'vi')),
      ] as string[],
    [products],
  );

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === selectedCategory),
    [categories, selectedCategory],
  );

  const searchTerm = search.trim();

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchTerm.toLowerCase();

    let result = [...products];

    if (selectedCategory) {
      result = result.filter(
        (product) => product.categoryId === selectedCategory,
      );
    }

    if (selectedBrand !== ALL_BRANDS) {
      result = result.filter((product) => product.brand === selectedBrand);
    }

    if (availability === 'in-stock') {
      result = result.filter((product) => product.stock > 0);
    }

    if (availability === 'discount') {
      result = result.filter(
        (product) =>
          typeof product.originalPrice === 'number' &&
          product.originalPrice > product.price,
      );
    }

    if (normalizedSearch) {
      result = result.filter((product) =>
        [
          product.name,
          product.brand,
          product.specs,
          product.categoryName,
          product.badge,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(normalizedSearch),
          ),
      );
    }

    switch (sortBy) {
      case 'price-asc':
        result.sort((first, second) => first.price - second.price);
        break;
      case 'price-desc':
        result.sort((first, second) => second.price - first.price);
        break;
      case 'rating':
        result.sort((first, second) => second.rating - first.rating);
        break;
      case 'name-asc':
        result.sort((first, second) =>
          first.name.localeCompare(second.name, 'vi'),
        );
        break;
      case 'newest':
        result.sort((first, second) => {
          const firstTime = new Date(first.updatedAt ?? first.createdAt ?? 0);
          const secondTime = new Date(
            second.updatedAt ?? second.createdAt ?? 0,
          );
          return secondTime.getTime() - firstTime.getTime();
        });
        break;
      case 'featured':
      default:
        result.sort((first, second) => {
          const secondDiscount = second.originalPrice
            ? second.originalPrice - second.price
            : 0;
          const firstDiscount = first.originalPrice
            ? first.originalPrice - first.price
            : 0;

          return (
            second.rating - first.rating ||
            second.stock - first.stock ||
            secondDiscount - firstDiscount
          );
        });
        break;
    }

    return result;
  }, [
    availability,
    products,
    searchTerm,
    selectedBrand,
    selectedCategory,
    sortBy,
  ]);

  const searchSuggestions = useMemo(() => {
    const candidateTerms = [
      ...categories.map((category) => category.name),
      ...brands.filter((brand) => brand !== ALL_BRANDS),
      ...products
        .map((product) => product.badge?.trim())
        .filter((badge): badge is string => Boolean(badge)),
    ];

    return Array.from(new Set(candidateTerms))
      .filter(
        (term) =>
          term.trim() &&
          term.toLocaleLowerCase('vi') !== searchTerm.toLocaleLowerCase('vi'),
      )
      .slice(0, SEARCH_SUGGESTION_LIMIT);
  }, [brands, categories, products, searchTerm]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE),
  );

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
  }, [currentPage, filteredProducts]);

  const inStockCount = useMemo(
    () => products.filter((product) => product.stock > 0).length,
    [products],
  );
  const discountCount = useMemo(
    () =>
      products.filter(
        (product) =>
          typeof product.originalPrice === 'number' &&
          product.originalPrice > product.price,
      ).length,
    [products],
  );
  const totalStock = useMemo(
    () => products.reduce((sum, product) => sum + product.stock, 0),
    [products],
  );

  const activeFilterCount = [
    Boolean(search.trim()),
    Boolean(selectedCategory),
    selectedBrand !== ALL_BRANDS,
    availability !== 'all',
    sortBy !== 'featured',
  ].filter(Boolean).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [availability, search, selectedBrand, selectedCategory, sortBy]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const resetFilters = () => {
    setSearch('');
    setSelectedBrand(ALL_BRANDS);
    setSelectedCategory('');
    setSortBy('featured');
    setAvailability('all');
  };

  const startItem =
    filteredProducts.length === 0
      ? 0
      : (currentPage - 1) * PRODUCTS_PER_PAGE + 1;
  const endItem = Math.min(
    currentPage * PRODUCTS_PER_PAGE,
    filteredProducts.length,
  );

  const searchResultLabel = searchTerm
    ? `Kết quả cho "${searchTerm}"`
    : 'Tìm nhanh theo tên, thương hiệu hoặc cấu hình';

  return (
    <div className="min-h-screen overflow-hidden bg-surface pt-24 pb-16">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-6">
        <motion.section
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative overflow-hidden rounded-[2rem] border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(15,23,42,0.07)] md:p-8"
        >
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_top_right,rgba(121,90,242,0.12),transparent_55%)] lg:block" />
          <div className="absolute -top-24 right-12 h-48 w-48 rounded-full bg-brand-accent/10 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.9fr)]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-brand-accent">
                <Sparkles className="h-3.5 w-3.5" />
                Bộ sưu tập điện thoại
              </span>
              <h1 className="mt-5 max-w-3xl font-display text-4xl font-bold tracking-tight text-brand md:text-5xl">
                Danh sách sản phẩm được sắp xếp để bạn chọn nhanh hơn.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-text-secondary">
                Lọc theo thương hiệu, danh mục, tình trạng còn hàng và mức giá.
                Toàn bộ sản phẩm đều hiển thị rõ ưu đãi, tồn kho và điểm đánh
                giá ngay trên một trang.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-border bg-surface-alt px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Danh mục nổi bật
                  </p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">
                    {categories
                      .slice(0, 3)
                      .map((category) => category.name)
                      .join(' • ') || 'Đang cập nhật'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface-alt px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Thương hiệu
                  </p>
                  <p className="mt-2 text-sm font-semibold text-text-primary">
                    {Math.max(brands.length - 1, 0)} thương hiệu đang mở bán
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-2">
              <StatCard
                label="Sản phẩm"
                value={String(products.length)}
                hint="Tổng số mẫu đang có trong catalog."
              />
              <StatCard
                label="Còn hàng"
                value={String(inStockCount)}
                hint={`${totalStock} sản phẩm sẵn sàng giao nhanh.`}
              />
              <StatCard
                label="Ưu đãi"
                value={String(discountCount)}
                hint="Các mẫu đang có giá tốt hoặc quà tặng."
              />
              <StatCard
                label="Danh mục"
                value={String(categories.length)}
                hint="Nhóm sản phẩm được quản lý riêng."
              />
            </div>
          </div>
        </motion.section>

        {categories.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="flex flex-wrap gap-3"
          >
            <button
              type="button"
              onClick={() => setSelectedCategory('')}
              className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
                selectedCategory === ''
                  ? 'border-brand bg-brand text-white shadow-lg shadow-brand/15'
                  : 'border-border bg-surface text-text-secondary hover:border-brand hover:text-brand'
              }`}
            >
              Tất cả danh mục
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setSelectedCategory(category.id)}
                className={`cursor-pointer rounded-full border px-4 py-2.5 text-sm font-medium transition-all ${
                  selectedCategory === category.id
                    ? 'border-brand bg-brand text-white shadow-lg shadow-brand/15'
                    : 'border-border bg-surface text-text-secondary hover:border-brand hover:text-brand'
                }`}
              >
                {category.name}
                <span
                  className={`ml-2 rounded-full px-2 py-0.5 text-xs ${
                    selectedCategory === category.id
                      ? 'bg-white/16 text-white'
                      : 'bg-surface-alt text-text-muted'
                  }`}
                >
                  {category.productCount}
                </span>
              </button>
            ))}
          </motion.section>
        )}

        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.1 }}
          className="rounded-[1.75rem] border border-border bg-surface p-5 shadow-[0_18px_48px_rgba(15,23,42,0.05)]"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-surface-alt/70 p-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                  Tìm kiếm sản phẩm
                </p>
                <h2 className="mt-2 font-display text-2xl font-bold text-brand">
                  {searchResultLabel}
                </h2>
                <p className="mt-2 text-sm leading-6 text-text-secondary">
                  Gõ từ khóa rồi kết hợp bộ lọc để thu hẹp nhanh danh sách hiển
                  thị từ backend.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Kết quả phù hợp
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">
                    {filteredProducts.length} sản phẩm
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-text-muted">
                    Từ khóa hiện tại
                  </p>
                  <p className="mt-2 text-lg font-semibold text-text-primary">
                    {searchTerm || 'Chưa nhập'}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-text-muted" />
                <input
                  type="text"
                  placeholder="Tìm kiếm theo tên, thương hiệu hoặc cấu hình..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full rounded-2xl border border-border bg-surface-alt py-3 pr-12 pl-11 text-sm text-text-primary outline-none transition-colors placeholder:text-text-muted focus:border-brand-accent focus:ring-2 focus:ring-brand-accent/15"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer rounded-full p-1 text-text-muted transition-colors hover:bg-surface hover:text-brand"
                    aria-label="Xóa từ khóa"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:flex">
                <select
                  value={selectedBrand}
                  onChange={(event) => setSelectedBrand(event.target.value)}
                  className="cursor-pointer rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary outline-none transition-colors focus:border-brand-accent"
                >
                  {brands.map((brand) => (
                    <option key={brand} value={brand}>
                      {brand === ALL_BRANDS ? 'Tất cả thương hiệu' : brand}
                    </option>
                  ))}
                </select>

                <select
                  value={sortBy}
                  onChange={(event) =>
                    setSortBy(event.target.value as SortOption)
                  }
                  className="cursor-pointer rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text-secondary outline-none transition-colors focus:border-brand-accent"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      Sắp xếp: {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => setShowFilters((visible) => !visible)}
                  className={`inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-medium transition-colors ${
                    showFilters
                      ? 'border-brand-accent bg-brand-subtle text-brand-accent'
                      : 'border-border bg-surface text-text-secondary hover:border-brand hover:text-brand'
                  }`}
                >
                  <SlidersHorizontal className="h-4 w-4" />
                  Bộ lọc nâng cao
                </button>
              </div>
            </div>

            <AnimatePresence initial={false}>
              {showFilters && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="grid gap-5 rounded-2xl border border-border bg-surface-alt p-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                        Tình trạng hiển thị
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {[
                          {
                            value: 'all',
                            label: 'Tất cả',
                          },
                          {
                            value: 'in-stock',
                            label: 'Còn hàng',
                          },
                          {
                            value: 'discount',
                            label: 'Đang giảm giá',
                          },
                        ].map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() =>
                              setAvailability(
                                option.value as AvailabilityFilter,
                              )
                            }
                            className={`cursor-pointer rounded-full px-4 py-2 text-sm font-medium transition-all ${
                              availability === option.value
                                ? 'bg-brand text-white shadow-md'
                                : 'bg-surface text-text-secondary hover:text-brand'
                            }`}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-surface p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                        Gợi ý nhanh
                      </p>
                      <div className="mt-3 space-y-3 text-sm text-text-secondary">
                        <div className="flex items-center justify-between gap-3">
                          <span>Mẫu có ưu đãi</span>
                          <span className="font-semibold text-text-primary">
                            {discountCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Đang còn hàng</span>
                          <span className="font-semibold text-text-primary">
                            {inStockCount}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Thương hiệu</span>
                          <span className="font-semibold text-text-primary">
                            {Math.max(brands.length - 1, 0)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="rounded-2xl border border-border bg-surface-alt/80 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-text-muted">
                    Gợi ý tìm nhanh
                  </p>
                  <p className="mt-2 text-sm text-text-secondary">
                    Chạm vào một từ khóa để áp dụng ngay trên danh sách sản
                    phẩm.
                  </p>
                </div>

                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="inline-flex cursor-pointer items-center gap-2 self-start rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:border-brand hover:text-brand lg:self-auto"
                  >
                    <X className="h-4 w-4" />
                    Xóa từ khóa
                  </button>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {searchSuggestions.length > 0 ? (
                  searchSuggestions.map((term) => (
                    <button
                      key={term}
                      type="button"
                      onClick={() => setSearch(term)}
                      className="cursor-pointer rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-secondary transition-all hover:border-brand hover:text-brand"
                    >
                      {term}
                    </button>
                  ))
                ) : (
                  <span className="text-sm text-text-muted">
                    Gợi ý sẽ xuất hiện khi hệ thống tải xong danh mục và thương
                    hiệu.
                  </span>
                )}
              </div>
            </div>
          </div>
        </motion.section>

        <section className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-surface-alt/60 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">
              {loading
                ? 'Đang chuẩn bị dữ liệu sản phẩm...'
                : `Hiển thị ${startItem}-${endItem} trên ${filteredProducts.length} sản phẩm`}
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              {activeCategory
                ? `Danh mục hiện tại: ${activeCategory.name}`
                : 'Đang xem toàn bộ danh mục'}
              {selectedBrand !== ALL_BRANDS
                ? ` • Thương hiệu: ${selectedBrand}`
                : ''}
              {searchTerm ? ` • Từ khóa: ${searchTerm}` : ''}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {search.trim() && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm text-text-secondary">
                <Search className="h-3.5 w-3.5" />
                {searchTerm}
              </span>
            )}
            {selectedBrand !== ALL_BRANDS && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm text-text-secondary">
                <Tag className="h-3.5 w-3.5" />
                {selectedBrand}
              </span>
            )}
            {availability !== 'all' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface px-3 py-1.5 text-sm text-text-secondary">
                {availability === 'in-stock' ? 'Còn hàng' : 'Đang giảm giá'}
              </span>
            )}
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-text-secondary transition-colors hover:border-brand hover:text-brand"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Xóa bộ lọc
              </button>
            )}
          </div>
        </section>

        {error ? (
          <section className="rounded-[1.75rem] border border-red-200 bg-red-50/80 p-8 text-center">
            <div className="mx-auto flex max-w-lg flex-col items-center">
              <AlertCircle className="h-11 w-11 text-red-500" />
              <h2 className="mt-4 font-display text-2xl font-bold text-brand">
                Không thể tải danh sách sản phẩm
              </h2>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                {error}
              </p>
              <button
                type="button"
                onClick={() => setReloadKey((value) => value + 1)}
                className="btn-primary mt-6 inline-flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Tải lại trang
              </button>
            </div>
          </section>
        ) : loading ? (
          <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: PRODUCTS_PER_PAGE }).map((_, index) => (
              <ProductCardSkeleton
                key={`product-skeleton-${index}`}
                index={index}
              />
            ))}
          </section>
        ) : filteredProducts.length > 0 ? (
          <>
            <section className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {paginatedProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} />
              ))}
            </section>

            <section className="flex flex-col gap-4 rounded-[1.5rem] border border-border bg-surface p-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-medium text-text-primary">
                  Trang {currentPage}/{totalPages}
                </p>
                <p className="mt-1 text-sm text-text-secondary">
                  Kéo tiếp để xem thêm, hoặc chuyển trang để duyệt nhanh hơn.
                </p>
              </div>

              <div className="flex items-center gap-2 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.max(page - 1, 1))
                  }
                  disabled={currentPage === 1}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="Trang trước"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>

                {Array.from({ length: totalPages }).map((_, index) => {
                  const pageNumber = index + 1;

                  return (
                    <button
                      key={pageNumber}
                      type="button"
                      onClick={() => setCurrentPage(pageNumber)}
                      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-full px-4 text-sm font-semibold transition-all ${
                        currentPage === pageNumber
                          ? 'bg-brand text-white shadow-lg shadow-brand/15'
                          : 'border border-border text-text-secondary hover:border-brand hover:text-brand'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}

                <button
                  type="button"
                  onClick={() =>
                    setCurrentPage((page) => Math.min(page + 1, totalPages))
                  }
                  disabled={currentPage === totalPages}
                  className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-text-secondary transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-45"
                  aria-label="Trang sau"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </section>
          </>
        ) : (
          <section className="rounded-[2rem] border border-dashed border-border-strong bg-surface p-10 text-center">
            <div className="mx-auto flex max-w-xl flex-col items-center">
              <PackageSearch className="h-14 w-14 text-text-muted" />
              <h2 className="mt-5 font-display text-2xl font-bold text-brand">
                Không tìm thấy sản phẩm phù hợp
              </h2>
              <p className="mt-3 text-sm leading-6 text-text-secondary">
                {searchTerm
                  ? `Không có sản phẩm nào khớp với từ khóa "${searchTerm}". Hãy thử đổi cách gõ hoặc bỏ bớt bộ lọc đang áp dụng.`
                  : 'Thử đổi từ khóa, bỏ bớt bộ lọc hoặc quay về toàn bộ danh mục để xem thêm sản phẩm khác.'}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="btn-outline mt-6 inline-flex items-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Đặt lại bộ lọc
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
