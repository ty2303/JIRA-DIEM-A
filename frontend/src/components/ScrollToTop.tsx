import { useEffect } from 'react';
import { useLocation } from 'react-router';

/**
 * Resets scroll position to top on every route change.
 * Place inside the router layout (App component).
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
