import { Search } from "lucide-react";

/* ============================================================
   Input — Text input primitive
   ============================================================ */

export default function Input({
  label,
  id,
  icon: Icon,
  className = "",
  ...props
}) {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={className}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-medium text-[var(--color-text-secondary)] mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none"
          />
        )}
        <input
          id={inputId}
          className={`
            w-full bg-[var(--color-surface-2)] border border-[var(--color-border-default)]
            rounded-md text-sm text-[var(--color-text-primary)]
            placeholder:text-[var(--color-text-disabled)]
            px-3 py-2
            hover:border-[var(--color-border-strong)]
            focus:outline-none focus:border-[var(--color-signal)] focus:ring-1 focus:ring-[var(--color-signal-strong)]
            transition-colors duration-150
            ${Icon ? "pl-9" : ""}
          `.trim()}
          {...props}
        />
      </div>
    </div>
  );
}

/** Search variant with built-in icon */
Input.Search = function SearchInput(props) {
  return <Input icon={Search} placeholder="Search…" {...props} />;
};
