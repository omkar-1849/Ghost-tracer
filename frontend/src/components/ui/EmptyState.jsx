/* ============================================================
   EmptyState — Professional empty data placeholder
   ============================================================ */

export default function EmptyState({
  icon: Icon,
  title = "No data",
  description,
  action,
  className = "",
}) {
  return (
    <div
      className={`
        flex flex-col items-center justify-center gap-3 py-12 px-6
        rounded-[20px] border border-dashed border-[rgba(211,160,106,0.18)]
        bg-[rgba(18,16,14,0.30)] backdrop-blur-[16px]
        ${className}
      `.trim()}
    >
      {Icon && (
        <span className="w-12 h-12 rounded-xl bg-[rgba(211,160,106,0.08)] border border-[rgba(211,160,106,0.18)] flex items-center justify-center">
          <Icon size={20} className="text-[#d3a06a]" />
        </span>
      )}
      <p className="text-sm font-semibold text-[#f5f1ec]">
        {title}
      </p>
      {description && (
        <p className="text-xs text-[#a9a199] text-center max-w-xs leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
