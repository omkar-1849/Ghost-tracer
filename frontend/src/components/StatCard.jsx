const themes = {
  cyan: {
    border: "border-t-cyan-400",
    iconBg: "bg-gradient-to-br from-cyan-500/25 to-blue-600/10",
    iconText: "text-cyan-300",
    glow: "shadow-[0_0_24px_rgba(34,211,238,0.35)]",
    glowHover: "group-hover:shadow-[0_0_32px_rgba(34,211,238,0.6)]",
    live: "bg-cyan-400",
    liveGlow: "group-hover:shadow-[0_0_10px_rgba(34,211,238,0.9)]",
    overlay: "from-cyan-500/10",
  },
  amber: {
    border: "border-t-amber-400",
    iconBg: "bg-gradient-to-br from-amber-500/25 to-yellow-600/10",
    iconText: "text-amber-300",
    glow: "shadow-[0_0_24px_rgba(251,191,36,0.35)]",
    glowHover: "group-hover:shadow-[0_0_32px_rgba(251,191,36,0.6)]",
    live: "bg-amber-400",
    liveGlow: "group-hover:shadow-[0_0_10px_rgba(251,191,36,0.9)]",
    overlay: "from-amber-500/10",
  },
  red: {
    border: "border-t-red-500",
    iconBg: "bg-gradient-to-br from-red-500/25 to-rose-600/10",
    iconText: "text-red-400",
    glow: "shadow-[0_0_24px_rgba(239,68,68,0.35)]",
    glowHover: "group-hover:shadow-[0_0_32px_rgba(239,68,68,0.6)]",
    live: "bg-red-500",
    liveGlow: "group-hover:shadow-[0_0_10px_rgba(239,68,68,0.9)]",
    overlay: "from-red-500/10",
  },
  orange: {
    border: "border-t-orange-400",
    iconBg: "bg-gradient-to-br from-orange-500/25 to-amber-600/10",
    iconText: "text-orange-300",
    glow: "shadow-[0_0_24px_rgba(251,146,60,0.35)]",
    glowHover: "group-hover:shadow-[0_0_32px_rgba(251,146,60,0.6)]",
    live: "bg-orange-400",
    liveGlow: "group-hover:shadow-[0_0_10px_rgba(251,146,60,0.9)]",
    overlay: "from-orange-500/10",
  },
  blue: {
    border: "border-t-blue-500",
    iconBg: "bg-gradient-to-br from-blue-500/25 to-indigo-600/10",
    iconText: "text-blue-300",
    glow: "shadow-[0_0_24px_rgba(59,130,246,0.35)]",
    glowHover: "group-hover:shadow-[0_0_32px_rgba(59,130,246,0.6)]",
    live: "bg-blue-400",
    liveGlow: "group-hover:shadow-[0_0_10px_rgba(59,130,246,0.9)]",
    overlay: "from-blue-500/10",
  },
};

function themeForTitle(title, color) {
  const normalized = (title || "").toLowerCase();

  if (normalized.includes("log")) {
    return "cyan";
  }

  if (normalized.includes("alert")) {
    return "amber";
  }

  if (normalized.includes("critical")) {
    return "red";
  }

  if (normalized.includes("high")) {
    return "orange";
  }

  if (color === "text-yellow-400") {
    return "amber";
  }

  if (color === "text-red-500") {
    return "red";
  }

  if (color === "text-orange-400") {
    return "orange";
  }

  return "blue";
}

function StatCard({ title, value, icon: Icon, color }) {
  const theme = themes[themeForTitle(title, color)];

  return (
    <div
      className={`group relative bg-slate-900/60 backdrop-blur-xl border border-slate-800/60 border-t-2 rounded-2xl p-6 shadow-lg shadow-black/40 overflow-hidden transition-all duration-[250ms] hover:-translate-y-2 hover:rotate-[0.5deg] hover:shadow-[0_24px_48px_-16px_rgba(0,0,0,0.6),inset_0_0_0_1px_rgba(148,163,184,0.12)] ${theme.border}`}
    >

      <div className={`absolute inset-0 bg-gradient-to-br ${theme.overlay} via-transparent to-transparent pointer-events-none transition-transform duration-[250ms] group-hover:translate-x-2 group-hover:-translate-y-1 group-hover:scale-[1.03]`} />

      <div className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:translate-x-[450%] transition-transform duration-[250ms] ease-out z-0" />

      <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
        <span className={`w-1.5 h-1.5 rounded-full ${theme.live} transition-shadow duration-[250ms] ${theme.liveGlow}`} />
        <span className="text-[9px] font-bold tracking-widest text-slate-500">
          LIVE
        </span>
      </div>

      <div className="relative z-10 transition-transform duration-[250ms] group-hover:translate-x-1">

        <div className={`w-12 h-12 rounded-xl flex items-center justify-center bg-gradient-to-br ${theme.iconBg} ${theme.glow} transition-all duration-[250ms] group-hover:scale-110 ${theme.glowHover}`}>
          <Icon size={24} className={theme.iconText} />
        </div>

        <p className="text-sm font-medium text-slate-400 mt-5">
          {title}
        </p>

        <h1 className="text-4xl font-bold text-white mt-1">
          {value}
        </h1>

      </div>

    </div>
  );
}

export default StatCard;
