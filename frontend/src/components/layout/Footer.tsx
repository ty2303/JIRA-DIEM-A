import {
  ArrowRight,
  CreditCard,
  Facebook,
  Github,
  Mail,
  MapPin,
  Phone,
  Smartphone,
  Twitter,
} from 'lucide-react';
import { Link } from 'react-router';

const socialLinks = [
  { Icon: Github, label: 'GitHub' },
  { Icon: Facebook, label: 'Facebook' },
  { Icon: Twitter, label: 'Twitter' },
] as const;

const footerLinks = {
  products: [
    { label: 'iPhone 16 Pro Max', href: '/products/iphone-16-pro-max' },
    {
      label: 'Samsung Galaxy S25 Ultra',
      href: '/products/samsung-galaxy-s25-ultra',
    },
    { label: 'Google Pixel 9 Pro', href: '/products/google-pixel-9-pro' },
    { label: 'Tất cả sản phẩm', href: '/products' },
  ],
  company: [
    { label: 'Về chúng tôi', href: '/about' },
    { label: 'Liên hệ', href: '/' },
    { label: 'Tuyển dụng', href: '/' },
    { label: 'Blog', href: '/' },
  ],
  support: [
    { label: 'Trung tâm hỗ trợ', href: '/' },
    { label: 'Chính sách bảo hành', href: '/' },
    { label: 'Đổi trả', href: '/' },
    { label: 'FAQ', href: '/' },
  ],
};

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-border-strong bg-surface pt-16 pb-8">
      <div className="mx-auto max-w-7xl px-6">
        {/* Newsletter Section */}
        <div className="mb-16 grid gap-8 border-b border-border pb-12 lg:grid-cols-2 lg:items-center">
          <div>
            <h3 className="font-display text-2xl font-bold text-text-primary">
              Đăng ký nhận tin tức mới nhất
            </h3>
            <p className="mt-2 text-text-secondary">
              Nhận thông báo về sản phẩm mới và ưu đãi độc quyền từ Nebula.
            </p>
          </div>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Email của bạn..."
              className="w-full flex-1 rounded-full border border-border bg-surface-alt px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-brand focus:outline-hidden focus:ring-1 focus:ring-brand"
            />
            <button
              type="submit"
              className="flex shrink-0 items-center gap-2 rounded-full bg-brand px-6 py-3 text-sm font-semibold text-white transition-transform hover:scale-105 active:scale-95"
            >
              Đăng ký <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-12">
          {/* Brand Column */}
          <div className="lg:col-span-3">
            <Link
              to="/"
              className="mb-6 flex items-center gap-2.5 no-underline"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand shadow-lg shadow-brand/20">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <span className="font-display text-2xl font-bold tracking-tight text-text-primary">
                NEBULA
              </span>
            </Link>
            <p className="mb-8 max-w-sm text-sm leading-relaxed text-text-secondary">
              Khám phá thế giới công nghệ đỉnh cao. Chúng tôi mang đến những
              chiếc điện thoại hàng đầu với trải nghiệm mua sắm tuyệt vời nhất.
            </p>
            <div className="flex gap-3">
              {socialLinks.map(({ Icon, label }) => (
                <a
                  key={label}
                  href="#!"
                  aria-label={label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface-alt text-text-muted transition-all hover:border-brand hover:bg-surface hover:text-brand hover:shadow-md"
                >
                  <Icon className="h-5 w-5" />
                </a>
              ))}
            </div>
          </div>

          {/* Products Column */}
          <div className="lg:col-span-2 lg:col-start-5">
            <h4 className="mb-6 font-display text-xs font-bold uppercase tracking-widest text-text-primary">
              Sản phẩm
            </h4>
            <ul className="space-y-4">
              {footerLinks.products.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-text-secondary no-underline transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company Column */}
          <div className="lg:col-span-2">
            <h4 className="mb-6 font-display text-xs font-bold uppercase tracking-widest text-text-primary">
              Công ty
            </h4>
            <ul className="space-y-4">
              {footerLinks.company.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-text-secondary no-underline transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Support Column */}
          <div className="lg:col-span-2">
            <h4 className="mb-6 font-display text-xs font-bold uppercase tracking-widest text-text-primary">
              Hỗ trợ
            </h4>
            <ul className="space-y-4">
              {footerLinks.support.map((link) => (
                <li key={link.label}>
                  <Link
                    to={link.href}
                    className="text-sm text-text-secondary no-underline transition-colors hover:text-brand"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Column */}
          <div className="lg:col-span-3">
            <h4 className="mb-6 font-display text-xs font-bold uppercase tracking-widest text-text-primary">
              Liên hệ
            </h4>
            <ul className="space-y-4 text-sm text-text-secondary">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
                <span>123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh, Việt Nam</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone className="h-5 w-5 shrink-0 text-brand" />
                <span className="font-medium text-text-primary">1900 1234</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-5 w-5 shrink-0 text-brand" />
                <span>contact@nebula.vn</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="mt-16 flex flex-col items-center justify-between gap-6 border-t border-border pt-8 text-sm text-text-muted md:flex-row">
          <div className="flex flex-col gap-1 md:flex-row md:gap-4">
            <p>&copy; {new Date().getFullYear()} Nebula Tech.</p>
            <span className="hidden text-border-strong md:inline">|</span>
            <p>Nhóm 12 - Đồ án Java</p>
          </div>

          <div className="flex gap-4 opacity-70 grayscale transition-all hover:opacity-100 hover:grayscale-0">
            <div className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs font-bold">VISA</span>
            </div>
            <div className="flex items-center gap-2 rounded border border-border bg-surface px-2 py-1">
              <CreditCard className="h-4 w-4" />
              <span className="text-xs font-bold">Mastercard</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
