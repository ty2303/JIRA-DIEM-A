import { LogIn, Star } from "lucide-react";
import { Link } from "react-router";

interface ReviewLoginCTAProps {
	/** Optional redirect path after login */
	redirectTo?: string;
}

export default function ReviewLoginCTA({ redirectTo }: ReviewLoginCTAProps) {
	const loginPath = redirectTo
		? `/login?redirect=${encodeURIComponent(redirectTo)}`
		: "/login";

	return (
		<div className="mb-8 rounded-[1.75rem] border border-border bg-surface-alt px-6 py-6 text-center">
			<Star className="mx-auto h-8 w-8 text-text-muted" />
			<p className="mt-3 text-sm text-text-secondary">
				Bạn cần đăng nhập để gửi đánh giá sản phẩm.
			</p>
			<Link
				to={loginPath}
				className="btn-primary mt-4 inline-flex items-center gap-2 no-underline"
			>
				<LogIn className="h-4 w-4" />
				Đăng nhập ngay
			</Link>
			<p className="mt-3 text-xs text-text-muted">
				Sau khi đăng nhập, bạn có thể đánh giá và chia sẻ ảnh trải nghiệm thực
				tế.
			</p>
		</div>
	);
}
