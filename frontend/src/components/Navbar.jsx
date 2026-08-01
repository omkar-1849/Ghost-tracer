import { useEffect, useRef, useState } from "react";
import { Bell, Search, User } from "lucide-react";

const sweepKeyframes = `
@keyframes navbar-sweep {
  0% {
    transform: translateX(-140%) skewX(-12deg);
  }
  100% {
    transform: translateX(440%) skewX(-12deg);
  }
}
`;

function Navbar() {
  const navbarRef = useRef(null);
  const [scrolled, setScrolled] = useState(false);

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  useEffect(() => {
    const element = navbarRef.current;

    if (!element) {
      return undefined;
    }

    /* Find the nearest scrollable ancestor (the <main> content area). */
    let scrollParent = element.parentElement;

    while (
      scrollParent &&
      scrollParent !== document.documentElement &&
      !/(auto|scroll|overlay)/.test(
        window.getComputedStyle(scrollParent).overflowY
      )
    ) {
      scrollParent = scrollParent.parentElement;
    }

    const target = scrollParent || window;

    function handleScroll() {
      const top = target === window ? window.scrollY : target.scrollTop;
      setScrolled(top > 8);
    }

    target.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => target.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      ref={navbarRef}
      className={`sticky top-4 z-40 mx-auto w-[min(86%,72rem)] flex items-center justify-between gap-4 mt-6 mb-12 p-4 border border-white/10 rounded-[2.25rem] overflow-hidden transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
        scrolled
          ? "bg-slate-900/35 backdrop-blur-3xl backdrop-saturate-150 shadow-[0_25px_60px_-18px_rgba(0,0,0,0.6)]"
          : "bg-slate-900/20 backdrop-blur-2xl backdrop-saturate-150 shadow-[0_20px_50px_-18px_rgba(0,0,0,0.4)]"
      }`}
    >

      <style>{sweepKeyframes}</style>

      {/* Frosted-glass sheen: gives the shell a visible top light so it reads as glass
          even when sitting over the flat dark page background. */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.08] via-white/[0.02] to-transparent" />

      <div
        className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-blue-500/[0.07] to-transparent"
        style={{ animation: "navbar-sweep 9s linear infinite" }}
      />

      <div className="relative z-10">

        <h1 className="text-3xl font-bold tracking-tight">
          Dashboard
        </h1>

        <p className="text-slate-400 mt-1 text-sm">
          Welcome back, Admin.
          <span className="text-slate-500"> · {today}</span>
        </p>

      </div>

      <div className="relative z-10 flex items-center gap-4">

        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/30">
          <span className="relative flex w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>

          <span className="text-xs font-bold tracking-widest text-green-400">
            LIVE
          </span>
        </div>

        <div className="relative group">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 transition-colors duration-200 group-focus-within:text-blue-400"
          />

          <input
            type="text"
            placeholder="Search..."
            className="w-64 bg-slate-800/50 border border-slate-800 rounded-full pl-11 pr-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none hover:border-slate-700 transition-all duration-300 focus:ring-2 focus:ring-blue-500/30 focus:shadow-[0_0_0_1px_rgba(96,165,250,0.5),0_0_18px_rgba(34,211,238,0.2)]"
          />
        </div>

        <button className="relative bg-slate-800/50 border border-slate-800 rounded-xl p-3 hover:bg-slate-800 hover:border-slate-700 hover:shadow-[0_0_16px_rgba(59,130,246,0.3)] hover:scale-105 transition-all duration-200">
          <Bell size={20} />

          <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.9)]" />
        </button>

        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-600/30 hover:scale-105 transition-transform duration-200">
          <User size={20} className="text-white" />
        </div>

      </div>

    </div>
  );
}

export default Navbar;
