// Renders a read-free static option list (the F.A.S.T. deck slots) from
// buildStaticView and nothing else. The value lives in the host form; onSelect
// hands the operator's choice back and the host writes it through
// applyLocalChange. The control is born on the explicit empty option, picks no
// value for the operator (not even when there is a single option), and never
// writes on render.
import { Select, useColorModeValue, useToken } from "@chakra-ui/react";
import { buildStaticView } from "@/components/tools/fieldOptions";
import type { SelectOption, StaticBinding } from "@/components/tools/fieldOptions";

export interface StaticSelectProps {
  binding: StaticBinding;
  value: unknown;
  allowVariables: boolean;
  onSelect: (value: string) => void;
}

export function StaticSelect({ binding, value, allowVariables, onSelect }: StaticSelectProps) {
  const mutedToken = useColorModeValue("gray.600", "whiteAlpha.700");
  // Native <option> elements take CSS values, not theme tokens.
  const [mutedCss] = useToken("colors", [mutedToken]);
  const view = buildStaticView({ binding, value, allowVariables });

  function optionColor(option: SelectOption): string | undefined {
    return option.flag === "not-reported" ? mutedCss : undefined;
  }

  return (
    <Select
      value={view.value}
      isDisabled={view.disabled}
      aria-label={binding.field}
      onChange={(e) => onSelect(e.target.value)}>
      {view.options.map((option) => {
        const color = optionColor(option);
        return (
          <option
            key={option.key}
            value={option.value}
            style={color !== undefined ? { color } : undefined}>
            {option.label}
          </option>
        );
      })}
    </Select>
  );
}
