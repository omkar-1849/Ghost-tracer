import { useEffect, useState } from "react";
import { Bell, Search, User } from "lucide-react";

/* Live console clock — a real, ticking operational reference (IST). */
function ConsoleClock() {
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return (
        <div className="hidden lg:flex flex-col items-end leading-none">
            <span className="mono-value text-[12.5px] font-semibold text-[var(--color-text-secondary)]">
                {now.toLocaleTimeString("en-GB", { hour12: false })}
            </span>
            <span className="text-[9px] font-semibold tracking-[0.1em] text-[var(--color-text-disabled)] uppercase mt-1">
                {Intl.DateTimeFormat().resolvedOptions().timeZone.split("/").pop().replace("_", " ")} · Local
            </span>
        </div>
    );
}

function Navbar() {
    const today = new Date().toLocaleDateString(undefined, {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
    });

    return (
        <div className="flex items-center justify-between gap-4 mb-6">
        {/* Left: Title + context */}
        <div>
          <h1 className="page-title">
            Dashboard
          </h1>
          <p className="text-xs text-[var(--color-text-muted)] mt-1">
            Welcome back, Admin
            <span className="text-[var(--color-text-disabled)]"> · {today}</span>
          </p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-3">
          <ConsoleClock />

          <div className="hidden h-7 w-px bg-[var(--color-border-subtle)] lg:block" />

          {/* Search */}
          <div className="relative hidden md:block">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
            />
            <input
              type="text"
              placeholder="Search assets, scans, incidents…"
              className="w-60 bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-md pl-9 pr-3 py-1.5 text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-signal)] focus:ring-1 focus:ring-[var(--color-signal-strong)] transition-colors duration-150"
            />
          </div>

          {/* Notifications */}
          <button
            type="button"
            className="relative p-2 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] transition-colors duration-150"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[var(--color-critical)]" />
          </button>

          {/* User */}
          <div className="flex items-center gap-2.5 pl-1">
            <div className="w-8 h-8 rounded-md bg-[var(--color-surface-3)] border border-[var(--color-border-default)] flex items-center justify-center">
              <User size={15} className="text-[var(--color-signal)]" />
            </div>
            <div className="hidden xl:block leading-none">
              <p className="text-[12px] font-semibold text-[var(--color-text-primary)]">Admin</p>
              <p className="text-[10px] text-[var(--color-text-muted)] mt-1">SOC Analyst</p>
            </div>
          </div>
        </div>
      </div>
    );
}

export default Navbar;
