import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Settings, House } from "lucide-react";
import { cn } from "@/src/lib/utils";

export default function Layout() {
  const location = useLocation();
  const isReader = location.pathname.startsWith("/read");

  useEffect(() => {
    document.body.classList.add("woozel-theme");
    return () => document.body.classList.remove("woozel-theme");
  }, []);

  if (isReader) return <Outlet />;

  return (
    <div className="min-h-screen bg-[var(--woozel-bg)] text-slate-900 font-[var(--font-woozel)]">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="woozel-orb woozel-orb-left" />
        <div className="woozel-orb woozel-orb-right" />
      </div>

      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-white/35 shadow-[0_0_0_1px_rgba(186,230,253,0.65),0_28px_100px_rgba(40,119,196,0.18)] backdrop-blur-sm sm:my-6 sm:min-h-[calc(100vh-3rem)] sm:rounded-[2rem] sm:border sm:border-white/70">
        <nav className="sticky top-0 z-50 border-b border-sky-200/60 bg-white/82 backdrop-blur-xl sm:rounded-t-[2rem]">
          <div className="flex flex-col gap-3 px-4 py-3">
            <Link to="/" className="flex items-center gap-3 group self-start">
              <img
                src="/woozel-logo.svg"
                alt="WortWoozel 3001 Logo"
                className="h-12 w-12 rounded-2xl border border-sky-200/80 bg-white shadow-lg shadow-sky-200/70 transition-transform duration-300 group-hover:scale-105"
              />
              <div className="leading-none">
                <div className="text-[0.62rem] font-black uppercase tracking-[0.28em] text-sky-500">WortWoozel 3001</div>
                <span className="text-base font-black tracking-tight text-slate-900">Leseabenteuer</span>
              </div>
            </Link>

            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/"
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-all",
                  location.pathname === "/"
                    ? "bg-sky-500 text-white shadow-lg shadow-sky-200"
                    : "bg-white/70 text-slate-600 hover:bg-white hover:text-sky-600"
                )}
              >
                <House size={18} />
                Home
              </Link>

              <Link
                to="/admin"
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-bold transition-all",
                  location.pathname === "/admin"
                    ? "bg-amber-400 text-slate-900 shadow-lg shadow-amber-100"
                    : "bg-white/70 text-slate-600 hover:bg-white hover:text-amber-600"
                )}
              >
                <Settings size={18} />
                Admin
              </Link>
            </div>
          </div>
        </nav>

        <main className="relative flex-1 px-4 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
