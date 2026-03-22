import { Link, Outlet, useLocation } from "react-router-dom";
import { BookOpen, Settings, Home } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function Layout() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/read");

  if (isReader) return <Outlet />;

  return (
    <div className="min-h-screen bg-[#fdfcfb] text-[#2c2c2c] font-sans">
      <nav className="border-b border-black/5 bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <BookOpen size={24} />
            </div>
            <span className="text-xl font-bold tracking-tight">LeseStoff</span>
          </Link>
          
          <div className="flex items-center gap-6">
            <Link 
              to="/" 
              className={cn(
                "text-sm font-medium transition-colors hover:text-emerald-600 flex items-center gap-1.5",
                location.pathname === "/" ? "text-emerald-600" : "text-gray-500"
              )}
            >
              <Home size={18} />
              Home
            </Link>
            <Link 
              to="/admin" 
              className={cn(
                "text-sm font-medium transition-colors hover:text-emerald-600 flex items-center gap-1.5",
                location.pathname === "/admin" ? "text-emerald-600" : "text-gray-500"
              )}
            >
              <Settings size={18} />
              Admin
            </Link>
          </div>
        </div>
      </nav>
      
      <main className="max-w-5xl mx-auto px-6 py-12">
        <Outlet />
      </main>
    </div>
  );
}
