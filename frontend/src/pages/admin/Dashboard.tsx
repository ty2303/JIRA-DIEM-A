import { useEffect, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Users,
  Package,
  Tag,
  ShoppingBag,
  LogOut,
  Pencil,
  Trash2,
  X,
  Plus,
  TrendingUp,
  ShieldCheck,
  ChevronRight,
  LayoutDashboard,
  Menu,
  FileSpreadsheet,
  Upload,
} from 'lucide-react';
import ExcelImportModal from '@/components/admin/ExcelImportModal';
import { useNavigate } from 'react-router';
import apiClient from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse, PaginatedResponse } from '@/api/types';
import type {
  Category,
  CreateCategoryPayload,
  CreateProductPayload,
  Product,
} from '@/types/product';
import type { Order, OrderStatus } from '@/types/order';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '@/types/order';
import { useAuthStore } from '@/store/useAuthStore';
import { useToastStore } from '@/store/useToastStore';

interface UserItem {
  id: string;
  username: string;
  email: string;
  role: 'USER' | 'ADMIN';
  createdAt: string;
}

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

interface DashboardMetrics {
  totals: {
    users: number;
    userUsers: number;
    products: number;
    categories: number;
    orders: number;
    pendingOrders: number;
    revenue: number;
  };
  rates: {
    cancellationRate: number;
  };
  charts: {
    revenueByDay: Array<{ label: string; revenue: number }>;
    revenueByMonth: Array<{ label: string; revenue: number }>;
    orderStatus: Array<{ name: string; value: number; color: string }>;
    topSellingProducts: Array<{
      name: string;
      shortName: string;
      sold: number;
      revenue: number;
    }>;
  };
  recentOrders: Array<{
    id: string;
    customerName: string;
    total: number;
    status: OrderStatus;
  }>;
}

const EMPTY_DASHBOARD_METRICS: DashboardMetrics = {
  totals: {
    users: 0,
    userUsers: 0,
    products: 0,
    categories: 0,
    orders: 0,
    pendingOrders: 0,
    revenue: 0,
  },
  rates: {
    cancellationRate: 0,
  },
  charts: {
    revenueByDay: [],
    revenueByMonth: [],
    orderStatus: [],
    topSellingProducts: [],
  },
  recentOrders: [],
};

const emptyProductForm: CreateProductPayload = {
  name: '',
  brand: '',
  categoryId: '',
  price: 0,
  originalPrice: undefined,
  image: '',
  rating: 0,
  badge: '',
  specs: '',
  stock: 0,
};

type ProductFormField =
  | 'name'
  | 'brand'
  | 'categoryId'
  | 'price'
  | 'originalPrice'
  | 'image'
  | 'rating'
  | 'badge'
  | 'specs'
  | 'stock';

type ProductFormErrors = Partial<Record<ProductFormField, string>>;

const PRODUCT_FIELD_LABELS: Record<ProductFormField, string> = {
  name: 'Tên sản phẩm',
  brand: 'Thương hiệu',
  categoryId: 'Danh mục',
  price: 'Giá bán',
  originalPrice: 'Giá gốc',
  image: 'Ảnh sản phẩm',
  rating: 'Đánh giá',
  badge: 'Badge',
  specs: 'Thông số kỹ thuật',
  stock: 'Tồn kho',
};

const validateProductForm = (form: CreateProductPayload): ProductFormErrors => {
  const errors: ProductFormErrors = {};

  if (!form.name.trim()) {
    errors.name = 'Vui lòng nhập tên sản phẩm.';
  }

  if (!form.brand.trim()) {
    errors.brand = 'Vui lòng nhập thương hiệu.';
  }

  if (!form.categoryId?.trim()) {
    errors.categoryId = 'Vui lòng chọn danh mục cho sản phẩm.';
  }

  if (!form.image.trim()) {
    errors.image = 'Vui lòng nhập hoặc tải lên ảnh sản phẩm.';
  }

  if (!Number.isFinite(form.price) || form.price <= 0) {
    errors.price = 'Giá bán phải lớn hơn 0.';
  }

  if (
    form.originalPrice !== undefined &&
    (!Number.isFinite(form.originalPrice) || form.originalPrice < form.price)
  ) {
    errors.originalPrice = 'Giá gốc phải lớn hơn hoặc bằng giá bán.';
  }

  if (
    form.rating !== undefined &&
    (!Number.isFinite(form.rating) || form.rating < 0 || form.rating > 5)
  ) {
    errors.rating = 'Rating phải nằm trong khoảng 0 đến 5.';
  }

  if (
    form.stock !== undefined &&
    (!Number.isInteger(form.stock) || form.stock < 0)
  ) {
    errors.stock = 'Tồn kho phải là số nguyên không âm.';
  }

  return errors;
};

const normalizeProductForm = (
  form: CreateProductPayload,
): CreateProductPayload => ({
  ...form,
  name: form.name.trim(),
  brand: form.brand.trim(),
  categoryId: form.categoryId?.trim() || '',
  image: form.image.trim(),
  badge: form.badge?.trim() || '',
  specs: form.specs?.trim() || '',
  originalPrice: form.originalPrice ?? undefined,
  rating: form.rating ?? 0,
  stock: form.stock ?? 0,
});

/** Valid order status transitions (mirrors backend logic). */
const VALID_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['SHIPPING', 'CANCELLED'],
  SHIPPING: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

const emptyCategoryForm: CreateCategoryPayload = {
  name: '',
  description: '',
  icon: '',
};

type Tab = 'overview' | 'users' | 'products' | 'categories' | 'orders';

const NAV_ITEMS: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Tổng quan', icon: LayoutDashboard },
  { key: 'users', label: 'Người dùng', icon: Users },
  { key: 'products', label: 'Sản phẩm', icon: Package },
  { key: 'categories', label: 'Danh mục', icon: Tag },
  { key: 'orders', label: 'Đơn hàng', icon: ShoppingBag },
];

export function Component() {
  const [tab, setTab] = useState<Tab>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Users
  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalUsers, setTotalUsers] = useState(0);
  const [loadingUsers, setLoadingUsers] = useState(true);

  // Products
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] =
    useState<CreateProductPayload>(emptyProductForm);
  const [productFormErrors, setProductFormErrors] = useState<ProductFormErrors>(
    {},
  );
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showExcelImport, setShowExcelImport] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [categoryForm, setCategoryForm] =
    useState<CreateCategoryPayload>(emptyCategoryForm);
  const [savingCategory, setSavingCategory] = useState(false);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const addToast = useToastStore((s) => s.addToast);

  useEffect(() => {
    apiClient
      .get<ApiResponse<PaginatedResponse<UserItem>>>('/users')
      .then((res) => {
        setUsers(res.data.data.content);
        setTotalUsers(res.data.data.totalElements);
      })
      .finally(() => setLoadingUsers(false));
  }, []);

  const fetchDashboardMetrics = () => {
    setLoadingMetrics(true);
    apiClient
      .get<ApiResponse<DashboardMetrics>>(ENDPOINTS.ADMIN.DASHBOARD_METRICS)
      .then((res) => setMetrics(res.data.data))
      .catch((err: unknown) => {
        const axiosErr = err as ApiError;
        addToast(
          'error',
          axiosErr.response?.data?.message ||
            'Không thể tải số liệu tổng quan admin.',
        );
      })
      .finally(() => setLoadingMetrics(false));
  };

  const fetchProducts = () => {
    setLoadingProducts(true);
    apiClient
      .get<ApiResponse<PaginatedResponse<Product>>>(ENDPOINTS.PRODUCTS.BASE, {
        params: { size: 100 },
      })
      .then((res) => setProducts(res.data.data.content))
      .finally(() => setLoadingProducts(false));
  };

  const fetchCategories = () => {
    setLoadingCategories(true);
    apiClient
      .get<ApiResponse<Category[]>>(ENDPOINTS.CATEGORIES.BASE)
      .then((res) => setCategories(res.data.data))
      .finally(() => setLoadingCategories(false));
  };

  const fetchOrders = () => {
    setLoadingOrders(true);
    apiClient
      .get<ApiResponse<PaginatedResponse<Order>>>(ENDPOINTS.ORDERS.BASE, {
        params: { size: 100 },
      })
      .then((res) => setOrders(res.data.data.content))
      .finally(() => setLoadingOrders(false));
  };

  useEffect(() => {
    fetchDashboardMetrics();
    fetchProducts();
    fetchCategories();
    fetchOrders();
    // Initial admin data is loaded once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Product handlers
  const closeProductForm = () => {
    setProductFormErrors({});
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setShowProductForm(false);
  };

  const openCreateProduct = () => {
    setEditingProduct(null);
    setProductForm(emptyProductForm);
    setProductFormErrors({});
    setShowProductForm(true);
  };

  const openEditProduct = (p: Product) => {
    setEditingProduct(p);
    setProductForm({
      name: p.name,
      brand: p.brand,
      categoryId: p.categoryId ?? '',
      price: p.price,
      originalPrice: p.originalPrice,
      image: p.image,
      rating: p.rating,
      badge: p.badge ?? '',
      specs: p.specs ?? '',
      stock: p.stock ?? 0,
    });
    setProductFormErrors({});
    setShowProductForm(true);
  };

  const handleProductFieldChange = <K extends ProductFormField>(
    field: K,
    value: CreateProductPayload[K],
  ) => {
    setProductForm((prev) => ({
      ...prev,
      [field]: value,
    }));
    setProductFormErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const handleNumericProductFieldChange = (
    field: 'price' | 'originalPrice' | 'rating' | 'stock',
    rawValue: string,
  ) => {
    if (rawValue === '') {
      handleProductFieldChange(
        field,
        (field === 'originalPrice'
          ? undefined
          : 0) as CreateProductPayload[typeof field],
      );
      return;
    }

    const parsed = Number(rawValue);
    handleProductFieldChange(
      field,
      Number.isFinite(parsed)
        ? (parsed as CreateProductPayload[typeof field])
        : ((field === 'originalPrice'
            ? undefined
            : 0) as CreateProductPayload[typeof field]),
    );
  };

  const handleSaveProduct = async () => {
    const trimmedForm = normalizeProductForm(productForm);
    const errors = validateProductForm(trimmedForm);

    if (Object.keys(errors).length > 0) {
      setProductForm(trimmedForm);
      setProductFormErrors(errors);
      const firstField = Object.keys(errors)[0] as ProductFormField;
      addToast(
        'error',
        errors[firstField] ||
          `Vui lòng kiểm tra lại trường ${PRODUCT_FIELD_LABELS[firstField]}.`,
      );
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        ...trimmedForm,
        originalPrice: trimmedForm.originalPrice ?? undefined,
        badge: trimmedForm.badge || undefined,
        specs: trimmedForm.specs || undefined,
        rating: trimmedForm.rating ?? 0,
        stock: trimmedForm.stock ?? 0,
      };
      if (editingProduct) {
        await apiClient.put(
          ENDPOINTS.PRODUCTS.BY_ID(editingProduct.id),
          payload,
        );
      } else {
        await apiClient.post(ENDPOINTS.PRODUCTS.BASE, payload);
      }
      setProductFormErrors({});
      closeProductForm();
      fetchDashboardMetrics();
      fetchCategories();
      fetchProducts();
      addToast(
        'success',
        editingProduct ? 'Đã cập nhật sản phẩm' : 'Đã thêm sản phẩm',
      );
    } catch (err: unknown) {
      const axiosErr = err as ApiError;
      addToast(
        'error',
        axiosErr.response?.data?.message || 'Lưu sản phẩm thất bại.',
      );
    } finally {
      setSavingProduct(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'products');
      const res = await apiClient.post<ApiResponse<string>>(
        ENDPOINTS.UPLOAD.IMAGE,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const url = res.data.data;
      handleProductFieldChange('image', url);
      addToast('success', 'Upload ảnh thành công');
    } catch (err: unknown) {
      const axiosErr = err as ApiError;
      const msg = axiosErr.response?.data?.message || 'Upload ảnh thất bại';
      addToast('error', msg);
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Xác nhận xóa sản phẩm này?')) return;
    try {
      await apiClient.delete(ENDPOINTS.PRODUCTS.BY_ID(id));
      fetchDashboardMetrics();
      fetchCategories();
      fetchProducts();
      addToast('success', 'Đã xóa sản phẩm');
    } catch (err: unknown) {
      const axiosErr = err as ApiError;
      const msg = axiosErr.response?.data?.message || 'Không thể xóa sản phẩm.';
      addToast('error', msg);
    }
  };

  // Category handlers
  const openCreateCategory = () => {
    setEditingCategory(null);
    setCategoryForm(emptyCategoryForm);
    setShowCategoryForm(true);
  };

  const openEditCategory = (c: Category) => {
    setEditingCategory(c);
    setCategoryForm({
      name: c.name,
      description: c.description ?? '',
      icon: c.icon ?? '',
    });
    setShowCategoryForm(true);
  };

  const handleSaveCategory = async () => {
    setSavingCategory(true);
    try {
      if (editingCategory) {
        await apiClient.put(
          ENDPOINTS.CATEGORIES.BY_ID(editingCategory.id),
          categoryForm,
        );
      } else {
        await apiClient.post(ENDPOINTS.CATEGORIES.BASE, categoryForm);
      }
      setShowCategoryForm(false);
      fetchDashboardMetrics();
      fetchCategories();
      fetchProducts();
      addToast(
        'success',
        editingCategory ? 'Đã cập nhật danh mục' : 'Đã thêm danh mục',
      );
    } catch (err: unknown) {
      const axiosErr = err as ApiError;
      addToast(
        'error',
        axiosErr.response?.data?.message || 'Không thể lưu danh mục.',
      );
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: string, force = false) => {
    const category = categories.find((c) => c.id === id);
    if (!category) return;

    if (!force) {
      if (category.productCount > 0) {
        // Category has products — ask admin what to do
        const action = window.confirm(
          `Danh mục "${category.name}" đang có ${category.productCount} sản phẩm.\n\n` +
            'Bấm OK để xóa danh mục và gỡ liên kết khỏi các sản phẩm.\n' +
            'Bấm Cancel để hủy.',
        );
        if (!action) return;
        // Admin chose force delete
        return handleDeleteCategory(id, true);
      }
      if (!window.confirm(`Xác nhận xóa danh mục "${category.name}"?`)) return;
    }

    try {
      await apiClient.delete(ENDPOINTS.CATEGORIES.BY_ID(id), {
        params: force ? { force: true } : {},
      });
      fetchDashboardMetrics();
      fetchCategories();
      fetchProducts();
      addToast('success', `Đã xóa danh mục "${category.name}"`);
    } catch (err: unknown) {
      const axiosErr = err as ApiError;
      const msg = axiosErr.response?.data?.message || 'Không thể xóa danh mục.';
      addToast('error', msg);
    }
  };

  const handleUpdateOrderStatus = async (id: string, status: OrderStatus) => {
    try {
      await apiClient.patch(
        ENDPOINTS.ORDERS.STATUS(id),
        {},
        {
          params: { status },
        },
      );
      fetchDashboardMetrics();
      fetchOrders();
      addToast(
        'success',
        `Đã cập nhật trạng thái đơn hàng thành "${ORDER_STATUS_LABEL[status]}"`,
      );
    } catch (err: unknown) {
      const axiosErr = err as ApiError;
      const msg =
        axiosErr.response?.data?.message ||
        'Không thể cập nhật trạng thái đơn hàng.';
      addToast('error', msg);
    }
  };

  const userCount = (metrics ?? EMPTY_DASHBOARD_METRICS).totals.userUsers;

  const handleUpdateRole = async (
    userId: string,
    currentRole: 'USER' | 'ADMIN',
  ) => {
    const newRole = currentRole === 'USER' ? 'ADMIN' : 'USER';
    const label = newRole === 'ADMIN' ? 'ADMIN' : 'USER';
    if (!window.confirm(`Chuyển quyền tài khoản này thành ${label}?`)) return;
    try {
      await apiClient.patch(
        `/users/${userId}/role`,
        {},
        {
          params: { role: newRole },
        },
      );
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      fetchDashboardMetrics();
    } catch (err: unknown) {
      const axiosErr = err as ApiError;
      const msg =
        axiosErr.response?.data?.message ||
        'Không thể cập nhật quyền. Vui lòng thử lại.';
      addToast('error', msg);
    }
  };
  const overviewMetrics = metrics ?? EMPTY_DASHBOARD_METRICS;
  const totalUsersValue = overviewMetrics.totals.users;
  const totalProductsValue = overviewMetrics.totals.products;
  const totalCategoriesValue = overviewMetrics.totals.categories;
  const totalOrdersValue = overviewMetrics.totals.orders;
  const pendingOrders = overviewMetrics.totals.pendingOrders;
  const totalRevenue = overviewMetrics.totals.revenue;
  const cancellationRate = overviewMetrics.rates.cancellationRate;
  const revenueByDay = overviewMetrics.charts.revenueByDay;
  const revenueByMonth = overviewMetrics.charts.revenueByMonth;
  const topSellingProducts = overviewMetrics.charts.topSellingProducts;
  const orderStatusData = overviewMetrics.charts.orderStatus;
  const recentOrders = overviewMetrics.recentOrders;
  const normalizedProductForm = normalizeProductForm(productForm);
  const productFormPreviewErrors = validateProductForm(normalizedProductForm);
  const isProductFormValid = Object.keys(productFormPreviewErrors).length === 0;
  const selectedCategory =
    categories.find((category) => category.id === productForm.categoryId) ??
    null;
  const stats = [
    {
      label: 'Tổng người dùng',
      value: totalUsersValue,
      icon: Users,
      gradient: 'from-purple-500 to-purple-700',
      bg: 'bg-purple-50',
      text: 'text-purple-600',
      change: `${userCount} user`,
    },
    {
      label: 'Sản phẩm',
      value: totalProductsValue,
      icon: Package,
      gradient: 'from-blue-400 to-blue-600',
      bg: 'bg-blue-50',
      text: 'text-blue-600',
      change: `${totalCategoriesValue} danh mục`,
    },
    {
      label: 'Đơn hàng',
      value: totalOrdersValue,
      icon: ShoppingBag,
      gradient: 'from-green-400 to-green-600',
      bg: 'bg-green-50',
      text: 'text-green-600',
      change: `${pendingOrders} chờ xác nhận`,
    },
    {
      label: 'Doanh thu',
      value: totalRevenue.toLocaleString('vi-VN') + '₫',
      icon: TrendingUp,
      gradient: 'from-orange-400 to-orange-600',
      bg: 'bg-orange-50',
      text: 'text-orange-600',
      change: 'Tổng đơn hàng',
    },
  ];

  return (
    <div className="flex min-h-screen bg-[#F4F7FE]">
      {/* ── Sidebar ── */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 flex flex-col bg-white shadow-xl transition-all duration-300 ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        {/* Logo */}
        <div className="flex h-20 items-center gap-3 border-b border-gray-100 px-5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg">
            <ShieldCheck className="h-5 w-5 text-white" />
          </div>
          {sidebarOpen && (
            <div>
              <p className="text-sm font-bold text-gray-800">NEBULA</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider">
                Admin Panel
              </p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-6 px-3">
          {sidebarOpen && (
            <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-widest text-gray-400">
              Menu chính
            </p>
          )}
          <ul className="space-y-1">
            {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
              <li key={key}>
                <button
                  type="button"
                  onClick={() => setTab(key)}
                  className={`flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all ${
                    tab === key
                      ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-200'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {sidebarOpen && <span>{label}</span>}
                  {sidebarOpen && tab === key && (
                    <ChevronRight className="ml-auto h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        {/* User info */}
        <div className="border-t border-gray-100 p-4">
          {sidebarOpen ? (
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 text-sm font-bold text-white">
                {user?.username?.[0]?.toUpperCase() ?? 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-800">
                  {user?.username}
                </p>
                <p className="text-xs text-purple-500 font-medium">Admin</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                title="Đăng xuất"
                className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleLogout}
              title="Đăng xuất"
              className="mx-auto flex cursor-pointer items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
            >
              <LogOut className="h-5 w-5" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <div
        className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-20'}`}
      >
        {/* Topbar */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-gray-100 bg-white/80 px-6 backdrop-blur">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="cursor-pointer rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-bold text-gray-800">
                {NAV_ITEMS.find((n) => n.key === tab)?.label ?? 'Dashboard'}
              </h1>
              <p className="text-xs text-gray-400">
                Trang chủ / {NAV_ITEMS.find((n) => n.key === tab)?.label}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-purple-50 px-3 py-1.5">
            <div className="h-2 w-2 rounded-full bg-green-400" />
            <span className="text-xs font-medium text-purple-600">
              {user?.username}
            </span>
          </div>
        </header>

        <main className="p-6">
          {/* ── Overview ── */}
          {tab === 'overview' && (
            <div className="space-y-6">
              {loadingMetrics ? (
                <div className="flex items-center justify-center rounded-2xl bg-white py-24 shadow-sm ring-1 ring-gray-100">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                </div>
              ) : (
                <>
                  {/* Banner */}
                  <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 p-6 text-white shadow-lg">
                    <div className="relative z-10">
                      <p className="text-sm font-medium text-purple-100">
                        Xin chào, {user?.username} 👋
                      </p>
                      <h2 className="mt-1 text-2xl font-bold">
                        Chào mừng trở lại!
                      </h2>
                      <p className="mt-1 text-sm text-purple-100">
                        Hệ thống đang hoạt động bình thường
                      </p>
                    </div>
                    <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10" />
                    <div className="absolute -right-4 bottom-0 h-24 w-24 rounded-full bg-white/10" />
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                    {stats.map((s) => (
                      <div
                        key={s.label}
                        className="rounded-2xl bg-white p-5 shadow-sm shadow-gray-100 ring-1 ring-gray-100"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                              {s.label}
                            </p>
                            <p className="mt-1 text-2xl font-bold text-gray-800">
                              {s.value}
                            </p>
                            <p className={`mt-1 text-xs font-medium ${s.text}`}>
                              {s.change}
                            </p>
                          </div>
                          <div
                            className={`flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${s.gradient} shadow-md`}
                          >
                            <s.icon className="h-6 w-6 text-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.5fr_1fr]">
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                      <div className="mb-5 flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-bold text-gray-800">
                            Doanh thu 7 ngày gần nhất
                          </h3>
                          <p className="mt-1 text-xs text-gray-400">
                            Theo ngày tạo đơn hàng
                          </p>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-3 py-2 text-right">
                          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600">
                            Tỷ lệ hủy
                          </p>
                          <p className="text-lg font-bold text-emerald-700">
                            {cancellationRate}%
                          </p>
                        </div>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={revenueByDay}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#eef2ff"
                            />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) =>
                                `${Math.round(value / 1000)}k`
                              }
                            />
                            <Tooltip
                              formatter={(value) =>
                                `${Number(value ?? 0).toLocaleString('vi-VN')}₫`
                              }
                              labelFormatter={(label) => `Ngày ${label}`}
                            />
                            <Line
                              type="monotone"
                              dataKey="revenue"
                              stroke="#6366f1"
                              strokeWidth={3}
                              dot={{ r: 4, fill: '#6366f1' }}
                              activeDot={{ r: 6 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                      <div className="mb-5">
                        <h3 className="font-bold text-gray-800">
                          Tỷ trọng trạng thái đơn
                        </h3>
                        <p className="mt-1 text-xs text-gray-400">
                          Theo toàn bộ đơn hiện có
                        </p>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={orderStatusData}
                              dataKey="value"
                              nameKey="name"
                              innerRadius={56}
                              outerRadius={86}
                              paddingAngle={3}
                            >
                              {orderStatusData.map((entry) => (
                                <Cell key={entry.name} fill={entry.color} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(value) => `${Number(value ?? 0)} đơn`}
                            />
                            <Legend verticalAlign="bottom" height={32} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.3fr_1fr]">
                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                      <div className="mb-5">
                        <h3 className="font-bold text-gray-800">
                          Doanh thu theo tháng
                        </h3>
                        <p className="mt-1 text-xs text-gray-400">
                          6 tháng gần nhất
                        </p>
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={revenueByMonth} barSize={28}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              vertical={false}
                              stroke="#f3f4f6"
                            />
                            <XAxis
                              dataKey="label"
                              tickLine={false}
                              axisLine={false}
                            />
                            <YAxis
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(value) =>
                                `${Math.round(value / 1000)}k`
                              }
                            />
                            <Tooltip
                              formatter={(value) =>
                                `${Number(value ?? 0).toLocaleString('vi-VN')}₫`
                              }
                              labelFormatter={(label) => `Tháng ${label}`}
                            />
                            <Bar
                              dataKey="revenue"
                              radius={[10, 10, 0, 0]}
                              fill="#8b5cf6"
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                      <div className="mb-5">
                        <h3 className="font-bold text-gray-800">
                          Top sản phẩm bán chạy
                        </h3>
                        <p className="mt-1 text-xs text-gray-400">
                          Theo số lượng đã bán
                        </p>
                      </div>
                      <div className="space-y-3">
                        {topSellingProducts.length > 0 ? (
                          topSellingProducts.map((item, index) => (
                            <div
                              key={`${item.name}-${index}`}
                              className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-800">
                                    {item.shortName}
                                  </p>
                                  <p className="mt-1 text-xs text-gray-400">
                                    {item.revenue.toLocaleString('vi-VN')}₫
                                  </p>
                                </div>
                                <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
                                  {item.sold} sp
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-xl border border-dashed border-gray-200 px-4 py-10 text-center text-sm text-gray-400">
                            Chưa có dữ liệu bán hàng
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Recent orders */}
                  <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
                    <div className="mb-4 flex items-center justify-between">
                      <h3 className="font-bold text-gray-800">
                        Đơn hàng gần đây
                      </h3>
                      <button
                        type="button"
                        onClick={() => setTab('orders')}
                        className="cursor-pointer text-xs font-medium text-purple-600 hover:underline"
                      >
                        Xem tất cả →
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-gray-100 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                            <th className="pb-3 pr-4">Mã đơn</th>
                            <th className="pb-3 pr-4">Khách hàng</th>
                            <th className="pb-3 pr-4">Tổng tiền</th>
                            <th className="pb-3">Trạng thái</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {recentOrders.map((o) => (
                            <tr key={o.id}>
                              <td className="py-3 pr-4 font-mono text-xs text-gray-400">
                                #{o.id.slice(-6).toUpperCase()}
                              </td>
                              <td className="py-3 pr-4 font-medium text-gray-700">
                                {o.customerName}
                              </td>
                              <td className="py-3 pr-4 font-semibold text-purple-600">
                                {o.total.toLocaleString('vi-VN')}₫
                              </td>
                              <td className="py-3">
                                <span
                                  className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ORDER_STATUS_COLOR[o.status]}`}
                                >
                                  {ORDER_STATUS_LABEL[o.status]}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {recentOrders.length === 0 && (
                        <p className="py-8 text-center text-sm text-gray-400">
                          Chưa có đơn hàng nào
                        </p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Users ── */}
          {tab === 'users' && (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-5">
                <h2 className="font-bold text-gray-800">
                  Danh sách người dùng
                </h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  Tổng {totalUsers} tài khoản
                </p>
              </div>
              {loadingUsers ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <th className="px-6 py-4">Người dùng</th>
                        <th className="px-6 py-4">Email</th>
                        <th className="px-6 py-4">Vai trò</th>
                        <th className="px-6 py-4">Ngày tạo</th>
                        <th className="px-6 py-4">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {users.map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 text-xs font-bold text-white">
                                {u.username[0].toUpperCase()}
                              </div>
                              <span className="font-medium text-gray-800">
                                {u.username}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-500">{u.email}</td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-100 text-purple-700'
                                  : 'bg-green-100 text-green-700'
                              }`}
                            >
                              <span
                                className={`h-1.5 w-1.5 rounded-full ${
                                  u.role === 'ADMIN'
                                    ? 'bg-purple-500'
                                    : 'bg-green-500'
                                }`}
                              />
                              {u.role}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-xs">
                            {u.createdAt
                              ? new Date(u.createdAt).toLocaleDateString(
                                  'vi-VN',
                                )
                              : '—'}
                          </td>
                          <td className="px-6 py-4">
                            <button
                              type="button"
                              onClick={() => handleUpdateRole(u.id, u.role)}
                              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                u.role === 'USER'
                                  ? 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                              }`}
                            >
                              {u.role === 'USER'
                                ? '↑ Nâng lên Admin'
                                : '↓ Hạ xuống User'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Products ── */}
          {tab === 'products' && (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                <div>
                  <h2 className="font-bold text-gray-800">Quản lý sản phẩm</h2>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {products.length} sản phẩm
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowExcelImport(true)}
                    className="flex cursor-pointer items-center gap-2 rounded-xl border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition-colors"
                  >
                    <FileSpreadsheet className="h-4 w-4" /> Import Excel
                  </button>
                  <button
                    type="button"
                    onClick={openCreateProduct}
                    className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-200 hover:shadow-lg transition-shadow"
                  >
                    <Plus className="h-4 w-4" /> Thêm sản phẩm
                  </button>
                </div>
              </div>
              {loadingProducts ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <th className="px-5 py-4">Sản phẩm</th>
                        <th className="px-5 py-4">Thương hiệu</th>
                        <th className="px-5 py-4">Danh mục</th>
                        <th className="px-5 py-4">Giá</th>
                        <th className="px-5 py-4">Tồn kho</th>
                        <th className="px-5 py-4">Rating</th>
                        <th className="px-5 py-4">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {products.map((p) => (
                        <tr key={p.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.image}
                                alt={p.name}
                                className="h-11 w-11 rounded-xl object-contain bg-gray-50 p-1 border border-gray-100"
                              />
                              <div>
                                <p className="font-semibold text-gray-800 max-w-[180px] truncate">
                                  {p.name}
                                </p>
                                {p.badge && (
                                  <span className="text-[10px] font-bold text-purple-500 uppercase">
                                    {p.badge}
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-500">{p.brand}</td>
                          <td className="px-5 py-4">
                            {p.categoryName ? (
                              <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600">
                                {p.categoryName}
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-600">
                                Chưa phân loại
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-4 font-semibold text-gray-800">
                            {p.price.toLocaleString('vi-VN')}₫
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                                p.stock > 10
                                  ? 'bg-green-50 text-green-700'
                                  : p.stock > 0
                                    ? 'bg-yellow-50 text-yellow-700'
                                    : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {p.stock > 0 ? p.stock : 'Hết hàng'}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-1">
                              <span className="text-amber-400">★</span>
                              <span className="text-gray-600">{p.rating}</span>
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEditProduct(p)}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                <Pencil className="h-3 w-3" /> Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteProduct(p.id)}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" /> Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Categories ── */}
          {tab === 'categories' && (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
                <div>
                  <h2 className="font-bold text-gray-800">Quản lý danh mục</h2>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {categories.length} danh mục
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openCreateCategory}
                  className="flex cursor-pointer items-center gap-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-purple-200 hover:shadow-lg transition-shadow"
                >
                  <Plus className="h-4 w-4" /> Thêm danh mục
                </button>
              </div>
              {loadingCategories ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <th className="px-6 py-4">Tên danh mục</th>
                        <th className="px-6 py-4">Slug</th>
                        <th className="px-6 py-4">Sản phẩm</th>
                        <th className="px-6 py-4">Mô tả</th>
                        <th className="px-6 py-4">Icon</th>
                        <th className="px-6 py-4">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {categories.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50/50">
                          <td className="px-6 py-4 font-semibold text-gray-800">
                            {c.name}
                          </td>
                          <td className="px-6 py-4 font-mono text-xs text-gray-400">
                            {c.slug}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                                c.productCount > 0
                                  ? 'bg-blue-50 text-blue-700'
                                  : 'bg-gray-50 text-gray-400'
                              }`}
                            >
                              {c.productCount} sản phẩm
                            </span>
                          </td>
                          <td className="px-6 py-4 text-gray-500 max-w-[200px] truncate">
                            {c.description || (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-gray-400 text-xs">
                            {c.icon || <span className="text-gray-300">—</span>}
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => openEditCategory(c)}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-colors"
                              >
                                <Pencil className="h-3 w-3" /> Sửa
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(c.id)}
                                className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-100 transition-colors"
                              >
                                <Trash2 className="h-3 w-3" /> Xóa
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ── Orders ── */}
          {tab === 'orders' && (
            <div className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
              <div className="border-b border-gray-100 px-6 py-5">
                <h2 className="font-bold text-gray-800">Quản lý đơn hàng</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  {orders.length} đơn hàng
                </p>
              </div>
              {loadingOrders ? (
                <div className="flex items-center justify-center py-20">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-200 border-t-purple-600" />
                </div>
              ) : orders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                  <ShoppingBag className="h-12 w-12 text-gray-200" />
                  <p className="mt-3 text-sm">Chưa có đơn hàng nào</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wider text-gray-400">
                        <th className="px-5 py-4">Mã đơn</th>
                        <th className="px-5 py-4">Khách hàng</th>
                        <th className="px-5 py-4">Sản phẩm</th>
                        <th className="px-5 py-4">Tổng tiền</th>
                        <th className="px-5 py-4">Thanh toán</th>
                        <th className="px-5 py-4">Trạng thái</th>
                        <th className="px-5 py-4">Ghi chú</th>
                        <th className="px-5 py-4">Cập nhật</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {orders.map((o) => (
                        <tr key={o.id} className="hover:bg-gray-50/50">
                          <td className="px-5 py-4 font-mono text-xs font-bold text-gray-400">
                            #{o.id.slice(-6).toUpperCase()}
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 text-xs font-bold text-white">
                                {o.customerName[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {o.customerName}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {o.phone}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-4 text-gray-500">
                            {o.items.length} sản phẩm
                          </td>
                          <td className="px-5 py-4 font-bold text-purple-600">
                            {o.total.toLocaleString('vi-VN')}₫
                          </td>
                          <td className="px-5 py-4">
                            <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-600">
                              {o.paymentMethod}
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${ORDER_STATUS_COLOR[o.status]}`}
                            >
                              {ORDER_STATUS_LABEL[o.status]}
                            </span>
                          </td>
                          <td className="px-5 py-4 max-w-[180px]">
                            {o.status === 'CANCELLED' && o.cancelReason ? (
                              <div>
                                <p
                                  className="truncate text-xs text-red-500"
                                  title={o.cancelReason}
                                >
                                  {o.cancelReason}
                                </p>
                                <p className="text-[10px] text-gray-400">
                                  {o.cancelledBy === 'ADMIN'
                                    ? 'Bởi admin'
                                    : 'Bởi khách'}
                                </p>
                              </div>
                            ) : (
                              <span className="text-gray-300">—</span>
                            )}
                          </td>
                          <td className="px-5 py-4">
                            {VALID_TRANSITIONS[o.status].length > 0 ? (
                              <select
                                value=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handleUpdateOrderStatus(
                                      o.id,
                                      e.target.value as OrderStatus,
                                    );
                                  }
                                }}
                                className="cursor-pointer rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-600 shadow-sm outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-200"
                              >
                                <option value="">Chuyển trạng thái...</option>
                                {VALID_TRANSITIONS[o.status].map((s) => (
                                  <option key={s} value={s}>
                                    {ORDER_STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ── Excel Import Modal ── */}
      {showExcelImport && (
        <ExcelImportModal
          onClose={() => setShowExcelImport(false)}
          onSuccess={() => {
            fetchDashboardMetrics();
            fetchProducts();
            setShowExcelImport(false);
          }}
        />
      )}

      {/* ── Product Modal ── */}
      {showProductForm && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 p-4 backdrop-blur-sm">
          <div className="flex min-h-full items-center justify-center">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void handleSaveProduct();
              }}
              className="flex max-h-[calc(100vh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
                <div>
                  <h3 className="font-bold text-gray-800">
                    {editingProduct ? 'Cập nhật sản phẩm' : 'Thêm sản phẩm mới'}
                  </h3>
                  <p className="text-xs text-gray-400">
                    {editingProduct
                      ? 'Chỉnh lại thông tin hiển thị, giá bán và tồn kho sản phẩm.'
                      : 'Điền đầy đủ thông tin để tạo sản phẩm mới.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeProductForm}
                  className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid gap-0 overflow-y-auto lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-4 px-6 py-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        ['name', 'Tên sản phẩm *', 'VD: iPhone 15 Pro Max'],
                        ['brand', 'Thương hiệu *', 'VD: Apple'],
                        ['badge', 'Badge', 'VD: Mới, Giảm giá, Bán chạy'],
                      ] as const
                    ).map(([field, label, placeholder]) => (
                      <div
                        key={field}
                        className={
                          field === 'badge' ? 'sm:col-span-2' : undefined
                        }
                      >
                        <label className="mb-1 block text-xs font-semibold text-gray-500">
                          {label}
                        </label>
                        <input
                          type="text"
                          placeholder={placeholder}
                          value={
                            ((
                              productForm as unknown as Record<string, unknown>
                            )[field] as string) ?? ''
                          }
                          onChange={(e) =>
                            handleProductFieldChange(field, e.target.value)
                          }
                          className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 ${
                            productFormErrors[field]
                              ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100'
                              : 'border-gray-200 bg-gray-50 focus:border-purple-400 focus:ring-purple-100'
                          }`}
                        />
                        {productFormErrors[field] && (
                          <p className="mt-1 text-xs text-red-500">
                            {productFormErrors[field]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      Thông số kỹ thuật
                    </label>
                    <textarea
                      rows={4}
                      placeholder="Mô tả ngắn cấu hình, màn hình, camera, bộ nhớ..."
                      value={productForm.specs ?? ''}
                      onChange={(e) =>
                        handleProductFieldChange('specs', e.target.value)
                      }
                      className={`w-full resize-none rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 ${
                        productFormErrors.specs
                          ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100'
                          : 'border-gray-200 bg-gray-50 focus:border-purple-400 focus:ring-purple-100'
                      }`}
                    />
                    {productFormErrors.specs && (
                      <p className="mt-1 text-xs text-red-500">
                        {productFormErrors.specs}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      Ảnh sản phẩm *
                    </label>
                    <div className="flex flex-col gap-3 sm:flex-row">
                      <div className="flex-1">
                        <input
                          type="text"
                          placeholder="Dán URL ảnh hoặc dùng nút upload"
                          value={productForm.image}
                          onChange={(e) =>
                            handleProductFieldChange('image', e.target.value)
                          }
                          className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition focus:bg-white focus:ring-2 ${
                            productFormErrors.image
                              ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100'
                              : 'border-gray-200 bg-gray-50 focus:border-purple-400 focus:ring-purple-100'
                          }`}
                        />
                      </div>
                      <label
                        className={`flex cursor-pointer items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                          uploadingImage
                            ? 'cursor-wait bg-gray-100 text-gray-400'
                            : 'bg-purple-50 text-purple-600 hover:bg-purple-100'
                        }`}
                      >
                        {uploadingImage ? (
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-200 border-t-purple-600" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        {uploadingImage ? 'Đang tải...' : 'Upload ảnh'}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="hidden"
                          disabled={uploadingImage}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void handleImageUpload(file);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-gray-400">
                      Ưu tiên ảnh vuông hoặc tỉ lệ gần vuông để hiển thị đẹp
                      trong danh sách.
                    </p>
                    {productFormErrors.image && (
                      <p className="mt-1 text-xs text-red-500">
                        {productFormErrors.image}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-500">
                      Danh mục *
                    </label>
                    <select
                      value={productForm.categoryId ?? ''}
                      onChange={(e) =>
                        handleProductFieldChange('categoryId', e.target.value)
                      }
                      className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 ${
                        productFormErrors.categoryId
                          ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100'
                          : 'border-gray-200 bg-gray-50 focus:border-purple-400 focus:ring-purple-100'
                      }`}
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {productFormErrors.categoryId && (
                      <p className="mt-1 text-xs text-red-500">
                        {productFormErrors.categoryId}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {(
                      [
                        ['price', 'Giá bán (₫)'],
                        ['originalPrice', 'Giá gốc (₫)'],
                        ['rating', 'Rating'],
                        ['stock', 'Tồn kho'],
                      ] as const
                    ).map(([field, label]) => (
                      <div key={field}>
                        <label className="mb-1 block text-xs font-semibold text-gray-500">
                          {label}
                        </label>
                        <input
                          type="number"
                          step={field === 'rating' ? '0.1' : '1'}
                          min="0"
                          max={
                            field === 'rating'
                              ? '5'
                              : field === 'stock'
                                ? '99999'
                                : undefined
                          }
                          value={
                            field === 'originalPrice'
                              ? (productForm.originalPrice ?? '')
                              : ((
                                  productForm as unknown as Record<
                                    string,
                                    number
                                  >
                                )[field] ?? 0)
                          }
                          onChange={(e) =>
                            handleNumericProductFieldChange(
                              field,
                              e.target.value,
                            )
                          }
                          className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:bg-white focus:ring-2 ${
                            productFormErrors[field]
                              ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-400 focus:ring-red-100'
                              : 'border-gray-200 bg-gray-50 focus:border-purple-400 focus:ring-purple-100'
                          }`}
                        />
                        {productFormErrors[field] && (
                          <p className="mt-1 text-xs text-red-500">
                            {productFormErrors[field]}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="border-t border-gray-100 bg-gray-50/70 px-6 py-5 lg:border-l lg:border-t-0">
                  <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">
                      Xem nhanh
                    </p>
                    <div className="mt-4 flex items-start gap-3">
                      <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50">
                        {productForm.image ? (
                          <img
                            src={productForm.image}
                            alt={productForm.name || 'Preview'}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="px-3 text-center text-xs text-gray-400">
                            Chưa có ảnh
                          </span>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm font-semibold text-gray-800">
                          {productForm.name.trim() ||
                            'Tên sản phẩm sẽ hiển thị ở đây'}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {productForm.brand.trim() || 'Chưa có thương hiệu'}
                        </p>
                        <p className="mt-2 text-sm font-bold text-purple-600">
                          {Number(productForm.price || 0).toLocaleString(
                            'vi-VN',
                          )}
                          ₫
                        </p>
                        {productForm.originalPrice ? (
                          <p className="text-xs text-gray-400 line-through">
                            {productForm.originalPrice.toLocaleString('vi-VN')}₫
                          </p>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 text-sm">
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                        <span className="text-gray-500">Danh mục</span>
                        <span className="font-medium text-gray-700">
                          {selectedCategory?.name || 'Chưa chọn'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                        <span className="text-gray-500">Rating</span>
                        <span className="font-medium text-gray-700">
                          {(productForm.rating ?? 0).toFixed(1)} / 5
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 rounded-xl bg-gray-50 px-3 py-2">
                        <span className="text-gray-500">Tồn kho</span>
                        <span className="font-medium text-gray-700">
                          {productForm.stock ?? 0} sản phẩm
                        </span>
                      </div>
                      {editingProduct && (
                        <div className="rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
                          <p>Mã sản phẩm: {editingProduct.id}</p>
                          {editingProduct.updatedAt ? (
                            <p className="mt-1">
                              Cập nhật gần nhất:{' '}
                              {new Date(
                                editingProduct.updatedAt,
                              ).toLocaleString('vi-VN')}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-dashed border-purple-200 bg-purple-50/50 px-4 py-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-purple-500">
                      Trạng thái form
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {isProductFormValid
                        ? 'Form đã đủ điều kiện để lưu.'
                        : 'Cần điền đủ tên, thương hiệu, ảnh, danh mục và giá bán hợp lệ trước khi lưu.'}
                    </p>
                  </div>
                </aside>
              </div>
              <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
                <button
                  type="button"
                  onClick={closeProductForm}
                  className="flex-1 cursor-pointer rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={
                    savingProduct || uploadingImage || !isProductFormValid
                  }
                  className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-200 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingProduct
                    ? 'Đang lưu...'
                    : editingProduct
                      ? 'Cập nhật sản phẩm'
                      : 'Tạo sản phẩm'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Category Modal ── */}
      {showCategoryForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="font-bold text-gray-800">
                  {editingCategory ? 'Cập nhật danh mục' : 'Thêm danh mục mới'}
                </h3>
                <p className="text-xs text-gray-400">Điền thông tin bên dưới</p>
              </div>
              <button
                type="button"
                onClick={() => setShowCategoryForm(false)}
                className="cursor-pointer rounded-lg p-1.5 text-gray-400 hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-6 py-5">
              {(
                [
                  ['name', 'Tên danh mục *', 'VD: Flagship, Tầm trung...'],
                  ['description', 'Mô tả', 'Mô tả ngắn về danh mục...'],
                  ['icon', 'Icon (Lucide name)', 'VD: crown, smartphone...'],
                ] as const
              ).map(([field, label, placeholder]) => (
                <div key={field}>
                  <label className="mb-1 block text-xs font-semibold text-gray-500">
                    {label}
                  </label>
                  <input
                    type="text"
                    value={(categoryForm[field] as string) ?? ''}
                    onChange={(e) =>
                      setCategoryForm({
                        ...categoryForm,
                        [field]: e.target.value,
                      })
                    }
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm outline-none focus:border-purple-400 focus:bg-white focus:ring-2 focus:ring-purple-100"
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-3 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowCategoryForm(false)}
                className="flex-1 cursor-pointer rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-500 hover:bg-gray-50"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSaveCategory}
                disabled={savingCategory || !categoryForm.name.trim()}
                className="flex-1 cursor-pointer rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-purple-200 hover:shadow-lg disabled:opacity-60"
              >
                {savingCategory
                  ? 'Đang lưu...'
                  : editingCategory
                    ? 'Cập nhật'
                    : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
