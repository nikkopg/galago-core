// Renders the "Reuse tips" checkbox from checkboxView. It never writes on
// render: an unrecognised saved value shows as an indeterminate box with a
// flag and stays untouched. A click hands checkboxNextValue to onSelect and the
// host writes it through applyLocalChange. No local state, no effect, no
// initial-checked prop and no instrument read.
import { useId } from "react";
import { Box, Checkbox, Text, useColorModeValue } from "@chakra-ui/react";
import {
  REUSE_TIPS_LABEL,
  TIP_REUSE_HELPER,
  checkboxNextValue,
  checkboxView,
} from "@/components/tools/fieldOptions";
import type { CheckboxBinding } from "@/components/tools/fieldOptions";

export interface TipReuseCheckboxProps {
  binding: CheckboxBinding;
  value: unknown;
  allowVariables: boolean;
  onSelect: (value: string) => void;
}

export function TipReuseCheckbox({
  binding,
  value,
  allowVariables,
  onSelect,
}: TipReuseCheckboxProps) {
  const mutedToken = useColorModeValue("gray.600", "whiteAlpha.700");
  const warningToken = useColorModeValue("orange.600", "orange.300");
  const helperId = useId();
  const flagId = useId();

  const view = checkboxView({ binding, value, allowVariables });
  const detail = view.flag ?? view.variable;
  const describedBy = detail !== undefined ? helperId + " " + flagId : helperId;

  return (
    <Box>
      <Checkbox
        isChecked={view.state === "checked"}
        isIndeterminate={view.state === "indeterminate"}
        isDisabled={view.disabled}
        colorScheme="teal"
        aria-describedby={describedBy}
        onChange={() => onSelect(checkboxNextValue(binding, view.state))}>
        {REUSE_TIPS_LABEL}
      </Checkbox>
      <Text id={helperId} fontSize="xs" color={mutedToken}>
        {TIP_REUSE_HELPER}
      </Text>
      {detail !== undefined && (
        <Text id={flagId} fontSize="sm" color={view.flag !== undefined ? warningToken : mutedToken}>
          {detail}
        </Text>
      )}
    </Box>
  );
}
