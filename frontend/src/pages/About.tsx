import { ArrowRight, Rocket, Shield, Users } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router';

export function Component() {
  return (
    <div className="min-h-screen bg-surface pt-24 pb-16">
      <div className="mx-auto max-w-7xl px-6">
        {/* Hero Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-20 max-w-3xl text-center"
        >
          <h1 className="font-display text-4xl font-bold text-brand md:text-5xl">
            Kiến tạo tương lai công nghệ
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-text-secondary">
            Chúng tôi không chỉ bán điện thoại. Chúng tôi mang đến những trải
            nghiệm công nghệ tinh hoa nhất, giúp bạn kết nối với thế giới theo
            cách riêng của mình.
          </p>
        </motion.div>

        {/* Mission Grid */}
        <div className="mb-24 grid grid-cols-1 gap-8 md:grid-cols-3">
          {[
            {
              icon: Shield,
              title: 'Chất lượng hàng đầu',
              desc: 'Cam kết 100% sản phẩm chính hãng với quy trình kiểm định nghiêm ngặt.',
            },
            {
              icon: Users,
              title: 'Khách hàng là trọng tâm',
              desc: 'Dịch vụ hỗ trợ 24/7, luôn lắng nghe và thấu hiểu nhu cầu của bạn.',
            },
            {
              icon: Rocket,
              title: 'Tiên phong đổi mới',
              desc: 'Luôn cập nhật những xu hướng công nghệ mới nhất thị trường.',
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="rounded-2xl bg-surface-alt p-8 transition-shadow hover:shadow-lg"
            >
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10">
                <item.icon className="h-6 w-6 text-brand" />
              </div>
              <h3 className="mb-3 font-display text-xl font-bold text-text-primary">
                {item.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                {item.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Story Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl bg-brand p-8 text-white md:p-16"
        >
          <div className="relative z-10 max-w-2xl">
            <h2 className="mb-6 font-display text-3xl font-bold">
              Câu chuyện của chúng tôi
            </h2>
            <p className="mb-8 leading-relaxed text-white/80">
              Thành lập từ năm 2024, Nebula bắt đầu với một sứ mệnh đơn giản:
              làm cho công nghệ cao cấp trở nên dễ tiếp cận hơn. Từ một cửa hàng
              nhỏ, chúng tôi đã phát triển thành hệ thống bán lẻ uy tín, được
              hàng ngàn khách hàng tin dùng.
            </p>
            <Link
              to="/products"
              className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-medium text-brand no-underline transition-colors hover:bg-gray-100"
            >
              Khám phá sản phẩm <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* Decorative Circle */}
          <div className="absolute -right-20 -bottom-40 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        </motion.div>
      </div>
    </div>
  );
}
