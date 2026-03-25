import { Outlet } from 'react-router';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import ScrollToTop from '@/components/ScrollToTop';

/**
 * Root layout component.
 * Wraps all routes with shared layout (Navbar + Footer).
 */
export default function App() {
  return (
    <>
      <ScrollToTop />
      <Navbar />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </>
  );
}
