import { Star } from "lucide-react";
import { useState } from "react";

interface ReviewStarRatingProps {
	value: number;
	onChange?: (rating: number) => void;
	/** Read-only display (no hover/click) */
	readOnly?: boolean;
	/** Icon size class, e.g. 'h-7 w-7' */
	size?: string;
	/** Show numeric label next to stars */
	showLabel?: boolean;
	/** Validation error message */
	error?: string;
}

export default function ReviewStarRating({
	value,
	onChange,
	readOnly = false,
	size = "h-7 w-7",
	showLabel = false,
	error,
}: ReviewStarRatingProps) {
	const [hover, setHover] = useState(0);

	const activeStar = readOnly ? value : hover || value;

	return (
		<div>
			<div className="flex items-center gap-1">
				{[1, 2, 3, 4, 5].map((star) => {
					const isFilled = star <= activeStar;

					if (readOnly) {
						return (
							<Star
								key={star}
								className={`${size} ${
									isFilled
										? "fill-amber-400 text-amber-400"
										: "fill-transparent text-text-muted"
								}`}
							/>
						);
					}

					return (
						<button
							key={star}
							type="button"
							onClick={() => onChange?.(star)}
							onMouseEnter={() => setHover(star)}
							onMouseLeave={() => setHover(0)}
							className="cursor-pointer p-0.5 transition-transform hover:scale-110"
							aria-label={`${star} sao`}
						>
							<Star
								className={`${size} ${
									isFilled
										? "fill-amber-400 text-amber-400"
										: "fill-transparent text-text-muted"
								}`}
							/>
						</button>
					);
				})}
				{showLabel && (
					<span className="ml-2 text-sm text-text-secondary">{value}/5</span>
				)}
			</div>
			{error && <p className="mt-1 text-xs text-red-600">{error}</p>}
		</div>
	);
}
