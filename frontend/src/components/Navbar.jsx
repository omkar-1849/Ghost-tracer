import { Bell, Search, User } from "lucide-react";

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
        <h1 className="text-lg font-semibold tracking-tight text-[var(--color-text-primary)]">
          Dashboard
        </h1>
        <p className="text-[var(--color-text-muted)] text-xs mt-0.5">
          Welcome back, Admin
          <span className="text-[var(--color-text-disabled)]"> · {today}</span>
        </p>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative hidden md:block">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
          />
          <input
            type="text"
            placeholder="Search…"
            className="w-52 bg-[var(--color-surface-2)] border border-[var(--color-border-default)] rounded-md pl-9 pr-3 py-1.5 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-disabled)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-colors duration-150"
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
        <div className="w-8 h-8 rounded-md bg-[var(--color-accent)] flex items-center justify-center">
          <User size={16} className="text-white" />
        </div>
      </div>
    </div>
  );
}

export default Navbar;
