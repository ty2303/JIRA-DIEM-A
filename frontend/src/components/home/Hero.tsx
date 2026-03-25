import { ArrowRight, Star } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';

export default function Hero() {
  return (
    <section className="relative flex min-h-[90vh] items-center overflow-hidden bg-surface pt-20">
      {/* Subtle background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 right-0 h-[600px] w-[600px] translate-x-1/4 rounded-full bg-brand-subtle/60 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 h-[400px] w-[400px] rounded-full bg-surface-alt blur-3xl" />
      </div>

      <div className="relative z-10 mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 lg:grid-cols-2 lg:items-center">
        {/* Text Content */}
        <div className="flex flex-col items-start pt-10 lg:pt-0">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium uppercase tracking-wider text-text-secondary shadow-sm"
          >
            <Star className="h-3 w-3 fill-brand-accent text-brand-accent" />
            Bộ sưu tập 2025
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="font-display text-5xl font-bold leading-[1.05] tracking-tight text-brand md:text-6xl lg:text-7xl"
          >
            Công nghệ
            <br />
            <span className="text-brand-accent">Vượt tầm</span>
            <br />
            Tương lai
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 max-w-lg text-lg leading-relaxed text-text-secondary"
          >
            Khám phá bộ sưu tập điện thoại cao cấp mới nhất. Từ thiết kế đỉnh
            cao đến hiệu năng vượt trội — tất cả đều có tại Nebula.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap gap-4"
          >
            <Link
              to="/products"
              className="btn-primary inline-flex items-center gap-2 no-underline"
            >
              Khám phá ngay
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/products"
              className="btn-outline inline-flex items-center no-underline"
            >
              Xem tất cả
            </Link>
          </motion.div>

          {/* Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="mt-16 flex items-center gap-8 border-t border-border pt-8"
          >
            {[
              { value: '50+', label: 'Sản phẩm' },
              { value: '10K+', label: 'Khách hàng' },
              { value: '99%', label: 'Hài lòng' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl font-bold text-brand">
                  {stat.value}
                </p>
                <p className="text-sm text-text-muted">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>

        {/* Visual — Clean phone mockup */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.2, type: 'spring' }}
          className="relative flex items-center justify-center lg:min-h-[700px]"
        >
          {/* Phone frame */}
          <div className="relative aspect-[9/16] w-full max-w-xs overflow-hidden rounded-[3rem] bg-white shadow-2xl shadow-black/8 ring-1 ring-black/5">
            {/* Screen content */}
            <div className="absolute inset-0 flex flex-col">
              {/* Top half — brand area */}
              <div className="flex h-1/2 w-full flex-col justify-end bg-brand p-8">
                <div className="mb-6 h-14 w-14 rounded-2xl bg-white/15 backdrop-blur-md" />
                <h3 className="font-display text-3xl font-bold text-white">
                  Nebula
                </h3>
                <p className="mt-1 text-sm text-white/60">
                  Premium Phone Store
                </p>
              </div>
              {/* Bottom half — content grid */}
              <div className="grid h-1/2 w-full grid-cols-2 gap-3 p-5">
                <div className="rounded-2xl bg-surface-alt shadow-sm" />
                <div className="rounded-2xl bg-surface-alt shadow-sm" />
                <div className="col-span-2 rounded-2xl bg-surface-alt shadow-sm" />
              </div>
            </div>

            {/* Gloss overlay */}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent" />
          </div>

          {/* Floating card — security indicator */}
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute -right-2 top-1/4 card max-w-[160px] p-4 shadow-lg"
          >
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs font-bold text-brand">Bảo mật</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-alt">
              <div className="h-full w-4/5 rounded-full bg-brand" />
            </div>
          </motion.div>

          {/* Floating card — rating */}
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{
              duration: 5,
              repeat: Infinity,
              ease: 'easeInOut',
              delay: 1,
            }}
            className="absolute -left-4 bottom-1/3 card max-w-[140px] p-3 shadow-lg"
          >
            <div className="flex items-center gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-3 w-3 fill-amber-400 text-amber-400"
                />
              ))}
            </div>
            <p className="mt-1 text-xs font-semibold text-brand">4.9 / 5.0</p>
            <p className="text-[10px] text-text-muted">10K+ đánh giá</p>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
