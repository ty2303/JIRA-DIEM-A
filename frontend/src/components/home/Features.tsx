import {
  Battery,
  Camera,
  Cpu,
  CreditCard,
  Headphones,
  Shield,
  Truck,
  Wifi,
} from 'lucide-react';
import { motion } from 'motion/react';

const features = [
  {
    icon: Cpu,
    title: 'Hiệu năng đỉnh cao',
    description: 'Chip xử lý thế hệ mới nhất, mạnh mẽ và tiết kiệm năng lượng.',
    color: 'bg-violet-100 text-violet-600',
  },
  {
    icon: Camera,
    title: 'Camera chuyên nghiệp',
    description: 'Hệ thống camera AI tiên tiến, chụp đẹp trong mọi điều kiện.',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    icon: Battery,
    title: 'Pin trâu cả ngày',
    description:
      'Dung lượng pin lớn, sạc nhanh, sử dụng cả ngày không lo hết pin.',
    color: 'bg-emerald-100 text-emerald-600',
  },
  {
    icon: Wifi,
    title: '5G siêu tốc',
    description: 'Kết nối 5G tốc độ cao, trải nghiệm internet mượt mà.',
    color: 'bg-amber-100 text-amber-600',
  },
];

const services = [
  {
    icon: Shield,
    title: 'Bảo hành chính hãng',
    description: '12 tháng bảo hành, 1 đổi 1 trong 30 ngày',
  },
  {
    icon: Truck,
    title: 'Giao hàng miễn phí',
    description: 'Miễn phí ship cho đơn từ 500K toàn quốc',
  },
  {
    icon: CreditCard,
    title: 'Trả góp 0%',
    description: 'Hỗ trợ trả góp 0% lãi suất qua mọi ngân hàng',
  },
  {
    icon: Headphones,
    title: 'Hỗ trợ 24/7',
    description: 'Đội ngũ tư vấn luôn sẵn sàng hỗ trợ bạn',
  },
];

export default function Features() {
  return (
    <section className="relative bg-surface-alt py-24">
      <div className="mx-auto max-w-7xl px-6">
        {/* Tech features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16 text-center"
        >
          <p className="mb-2 text-sm font-medium uppercase tracking-widest text-brand-accent">
            Công nghệ
          </p>
          <h2 className="font-display text-3xl font-bold tracking-tight text-brand md:text-4xl">
            Tính năng vượt trội
          </h2>
        </motion.div>

        <div className="mb-24 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-30px' }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="card card-hover p-6"
            >
              {/* Icon */}
              <div
                className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl ${feature.color}`}
              >
                <feature.icon className="h-6 w-6" />
              </div>

              <h3 className="mb-2 font-display text-base font-semibold text-brand">
                {feature.title}
              </h3>
              <p className="text-sm leading-relaxed text-text-secondary">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Services */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12 text-center"
        >
          <h2 className="font-display text-3xl font-bold tracking-tight text-brand md:text-4xl">
            Tại sao chọn Nebula?
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {services.map((service, index) => (
            <motion.div
              key={service.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="card card-hover p-6 text-center"
            >
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-brand-subtle">
                <service.icon className="h-6 w-6 text-brand-accent" />
              </div>
              <h3 className="mb-2 font-display text-sm font-semibold text-brand">
                {service.title}
              </h3>
              <p className="text-xs leading-relaxed text-text-secondary">
                {service.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
