import { Smartphone } from 'lucide-react';
import { Link } from 'react-router';

interface SimpleFooterProps {
  className?: string;
}

export default function SimpleFooter({ className = '' }: SimpleFooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className={`border-t border-border bg-surface-alt py-6 ${className}`}
    >
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
        {/* Brand */}
        <Link
          to="/"
          className="flex items-center gap-2 text-text-primary no-underline transition-opacity hover:opacity-80"
        >
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-brand/10">
            <Smartphone className="h-3.5 w-3.5 text-brand" />
          </div>
          <span className="font-display text-sm font-bold tracking-tight">
            NEBULA
          </span>
        </Link>

        {/* Legal / Copyright */}
        <div className="flex flex-col items-center gap-4 md:flex-row md:gap-6">
          <div className="flex gap-4 text-xs font-medium text-text-secondary">
            <Link
              to="/privacy"
              className="no-underline hover:text-brand hover:underline"
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className="no-underline hover:text-brand hover:underline"
            >
              Terms
            </Link>
          </div>
          <p className="text-xs text-text-muted">
            &copy; {currentYear} Nebula Tech.
          </p>
        </div>
      </div>
    </footer>
  );
}
