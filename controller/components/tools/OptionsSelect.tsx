// Shared control for an instrument-fed list field (loading / ok / unavailable).
// It renders what buildSelectView decides and nothing else: no effect hooks, no
// state of its own, and no code that selects an option for the operator. The
// value always lives in the host form; onSelect hands a choice back to it.
import { Box, Input, Select, Text, useColorModeValue } from "@chakra-ui/react";
import { useToolOptions } from "@/hooks/useToolOptions";
import { buildSelectView, listOptions } from "@/components/tools/fieldOptions";
import type { FieldBinding } from "@/components/tools/fieldOptions";

export interface OptionsSelectProps {
  toolId: string | undefined;
  binding: FieldBinding;
  value: unknown;
  enabled: boolean;
  onSelect: (value: string) => void;
}

export function OptionsSelect({ toolId, binding, value, enabled, onSelect }: OptionsSelectProps) {
  const hintColor = useColorModeValue("gray.600", "whiteAlpha.700");
  const { mode, data } = useToolOptions(toolId, binding.source, enabled);
  const view = buildSelectView({ mode, value, offered: listOptions(data) });

  if (view.mode === "unavailable") {
    return (
      <Box>
        <Input
          type="text"
          value={view.value}
          onChange={(e) => onSelect(e.target.value)}
          aria-label={binding.field}
        />
        {view.hint !== undefined && (
          <Text fontSize="sm" color={hintColor} mt={1}>
            {view.hint}
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Select
      value={view.value}
      isDisabled={view.disabled}
      aria-busy={view.mode === "loading" ? true : undefined}
      aria-label={binding.field}
      onChange={(e) => onSelect(e.target.value)}>
      {view.options.map((option) => (
        <option key={option.key} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
