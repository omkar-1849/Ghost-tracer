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
          className="block text-xs font-medium text-[#d6cfc7] mb-1.5"
        >
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8b837b] pointer-events-none"
          />
        )}
        <input
          id={inputId}
          className={`
            w-full bg-[rgba(20,18,16,0.45)] backdrop-blur-[16px] border border-[rgba(211,160,106,0.18)]
            rounded-xl text-sm text-[#f5f1ec]
            placeholder:text-[#8b837b]
            px-3.5 py-2
            hover:border-[rgba(211,160,106,0.32)]
            focus:outline-none focus:border-[#d3a06a] focus:ring-1 focus:ring-[#d3a06a]
            transition-all duration-150
            shadow-[inset_0_1px_2px_rgba(0,0,0,0.30)]
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
