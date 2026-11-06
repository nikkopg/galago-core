// Shared control for an instrument-fed field (list or device -> deck -> nest
// cascade). It renders what buildFieldView decides and nothing else: no effect
// hooks, no copy of the field value, and no code that selects an option for
// the operator (not even a single one). The value always lives in the host
// form; onSelect hands the operator's choice back, and the host writes it
// through applyChange. Loading or refreshing a list never calls onSelect.
import { useId } from "react";
import {
  Button,
  HStack,
  Input,
  Select,
  Text,
  VStack,
  useColorModeValue,
  useToken,
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { useToolOptions } from "@/hooks/useToolOptions";
import {
  buildFieldView,
  formatStatusLine,
  REFRESH_LABEL,
  REFRESHING_LABEL,
  SOURCE_LABELS,
} from "@/components/tools/fieldOptions";
import type { ChangeKind, FieldBinding, SelectOption } from "@/components/tools/fieldOptions";

export interface OptionsSelectProps {
  toolId: string | undefined;
  binding: FieldBinding;
  value: unknown;
  values: Record<string, unknown>;
  enabled: boolean;
  allowVariables: boolean;
  showRefresh: boolean;
  // kind tells the host whether this was a list choice ("select", cascade
  // clears apply) or a typed-fallback edit ("typed", own field only).
  onSelect: (value: string, kind: ChangeKind) => void;
}

export function OptionsSelect({
  toolId,
  binding,
  value,
  values,
  enabled,
  allowVariables,
  showRefresh,
  onSelect,
}: OptionsSelectProps) {
  const mutedToken = useColorModeValue("gray.600", "whiteAlpha.700");
  const warningToken = useColorModeValue("orange.600", "orange.300");
  // Native <option> elements take CSS values, not theme tokens.
  const [mutedCss, warningCss] = useToken("colors", [mutedToken, warningToken]);
  const hintId = useId();
  const statusId = useId();

  const { mode, data, refresh, isRefreshing } = useToolOptions(toolId, binding.source, enabled);
  const view = buildFieldView({ binding, value, values, mode, data, allowVariables });

  const hintText = view.hint ?? view.note;
  const statusText = view.mode === "ok" && data !== undefined ? formatStatusLine(data) : "";
  const showRefreshRow = showRefresh && enabled && view.mode !== "loading";
  const showStatus = showRefreshRow && statusText !== "";

  const describedBy = [
    hintText !== undefined ? hintId : undefined,
    showStatus ? statusId : undefined,
  ]
    .filter((id): id is string => id !== undefined)
    .join(" ");
  const ariaDescribedBy = describedBy === "" ? undefined : describedBy;

  function optionColor(option: SelectOption): string | undefined {
    if (option.flag === "ambiguous") return warningCss;
    if (option.flag === "not-reported") return mutedCss;
    return undefined;
  }

  const typed = view.mode === "unavailable" || view.mode === "child-of-variable";

  return (
    <VStack align="stretch" spacing={1} flex={1}>
      {typed ? (
        <Input
          type="text"
          value={view.value}
          onChange={(e) => onSelect(e.target.value, "typed")}
          aria-label={binding.field}
          aria-describedby={ariaDescribedBy}
        />
      ) : (
        <Select
          value={view.value}
          isDisabled={view.disabled}
          aria-busy={view.mode === "loading" ? true : undefined}
          aria-label={binding.field}
          aria-describedby={ariaDescribedBy}
          onChange={(e) => onSelect(e.target.value, "select")}>
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
      )}
      {showRefreshRow && (
        <HStack spacing={2} mt={1} flexWrap="wrap">
          <Button
            size="sm"
            variant="ghost"
            colorScheme="teal"
            leftIcon={<RepeatIcon />}
            isLoading={isRefreshing}
            loadingText={REFRESHING_LABEL}
            aria-label={"Refresh " + SOURCE_LABELS[binding.source] + " list"}
            onClick={() => {
              void refresh();
            }}>
            {REFRESH_LABEL}
          </Button>
          {showStatus && (
            <Text id={statusId} fontSize="xs" color={mutedToken} aria-live="polite">
              {statusText}
            </Text>
          )}
        </HStack>
      )}
      {hintText !== undefined && (
        <Text id={hintId} fontSize="sm" color={mutedToken}>
          {hintText}
        </Text>
      )}
    </VStack>
  );
}
