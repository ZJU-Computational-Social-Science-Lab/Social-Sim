import * as Select from "@radix-ui/react-select";
import { ChevronDown, Check } from "lucide-react";

type Option = { value: string; label: string };

export function AppSelect({
  options,
  value,
  placeholder,
  onChange,
  size = "normal",
}: {
  options: Option[];
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
  size?: "normal" | "small";
}) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger
        className={`input fancy-select-trigger ${size === "small" ? "small" : ""}`.trim()}
        aria-label={placeholder || "select"}
      >
        <Select.Value placeholder={placeholder || options[0]?.label || ""} />
        <Select.Icon asChild>
          <ChevronDown className="h-4 w-4 text-[var(--sim-text-soft)]" />
        </Select.Icon>
      </Select.Trigger>

      <Select.Portal>
        <Select.Content
          className={`card select-dropdown ${size === "small" ? "small" : ""}`.trim()}
          position="popper"
          sideOffset={8}
          style={{ width: "var(--radix-select-trigger-width)", zIndex: 80 }}
        >
          <Select.Viewport className="grid gap-1">
            {options.map((option) => (
              <Select.Item
                key={option.value}
                value={option.value}
                className="select-option flex items-center justify-between gap-3"
              >
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator>
                  <Check className="h-4 w-4 text-[var(--sim-primary)]" />
                </Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
