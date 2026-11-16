import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Divider,
  Drawer,
  DrawerOverlay,
  DrawerContent,
  DrawerHeader,
  DrawerBody,
  DrawerCloseButton,
  Select,
  Input,
  Badge,
  Switch,
  FormControl,
  FormLabel,
  FormHelperText,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon,
  useColorModeValue,
} from "@chakra-ui/react";
import { InfoIcon, WarningTwoIcon } from "@chakra-ui/icons";
import { useState, useEffect } from "react";
import { trpc } from "@/utils/trpc";
import { capitalizeFirst } from "@/utils/parser";
import { successToast } from "../ui/Toast";
import { AdvancedParameters, ToolCommandInfo } from "@/types";
import {
  isToolStep,
  setLane,
  setBarrier,
  suggestLanes,
  laneHelperText,
  laneFlag,
  LANE_BARRIER_HELP,
  LANE_INERT_NOTE,
} from "./laneFields";
import {
  applyChange,
  applyLocalChange,
  firstFieldForSource,
  isCheckboxBinding,
  isStaticBinding,
  isWellGroupAnchor,
  isWellsBinding,
  lookupFieldBinding,
  lookupLocalBinding,
} from "../tools/fieldOptions";
import type { ChangeKind, FieldBinding, LocalBinding } from "../tools/fieldOptions";
import { OptionsSelect } from "../tools/OptionsSelect";
import { StaticSelect } from "../tools/StaticSelect";
import { TipReuseCheckbox } from "../tools/TipReuseCheckbox";
import { FastTransferWellPicker } from "../tools/WellPicker";
import { wellFieldPatch, wellFieldText } from "../tools/wellGeometry";
import type { WellField } from "../tools/wellGeometry";

interface CommandDetailsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCommand: any;
  onSave: (updatedCommand: any) => void;
  isEditing: boolean;
  // The protocol's own steps, for lane suggestions and author-time flags (D-18).
  // The run-page drawer passes nothing: it is read-only and shows no flags.
  protocolCommands?: ReadonlyArray<{ queueId?: number; commandInfo: ToolCommandInfo }>;
}

export const CommandDetailsDrawer: React.FC<CommandDetailsDrawerProps> = (props) => {
  const { isOpen, onClose, selectedCommand, onSave, isEditing, protocolCommands } = props;
  const mutedColor = useColorModeValue("gray.600", "whiteAlpha.700");
  const warnColor = useColorModeValue("orange.600", "orange.300");
  const [editedParams, setEditedParams] = useState<Record<string, any>>({});
  const [editedAdvancedParams, setEditedAdvancedParams] = useState<AdvancedParameters | null>(null);
  const { data: availableVariables } = trpc.variable.getAll.useQuery();
  const { data: labwareData } = trpc.labware.getAll.useQuery();
  const { data: toolsData } = trpc.tool.getAll.useQuery();
  const { data: forms } = trpc.form.getAll.useQuery();

  // Get the numeric tool ID from the tool name when a PF400 command is selected
  const toolId =
    selectedCommand?.commandInfo?.toolType === "pf400"
      ? toolsData?.find(
          (t) => t.name?.toLowerCase() === selectedCommand?.commandInfo?.toolId?.toLowerCase(),
        )?.id || 0
      : 0;

  // Query for PF400 locations and sequences when needed
  const waypointsQuery = trpc.robotArm.waypoints.getAll.useQuery(
    { toolId },
    {
      enabled: !!toolId && selectedCommand?.commandInfo?.toolType === "pf400",
    },
  );

  // Reset editedParams when a command is selected
  useEffect(() => {
    if (selectedCommand) {
      setEditedParams({});
      setEditedAdvancedParams(null);

      // If we have labware data and there's a labware parameter using "default"
      if (labwareData && selectedCommand?.commandInfo?.params?.labware === "default") {
        // Check if a labware with the name "default" (case insensitive) exists in the database
        if (labwareData.some((labware) => labware.name.toLowerCase() === "default")) {
          // Find the exact case of the default labware in the database
          const defaultLabware = labwareData.find(
            (labware) => labware.name.toLowerCase() === "default",
          );
          if (defaultLabware && defaultLabware.name !== "default") {
            // Update the labware parameter to match the case in the database
            setEditedParams({
              labware: defaultLabware.name,
            });
          }
        }
      }
    }
  }, [selectedCommand, labwareData]);

  const handleVariableSelect = (fieldName: string, variableName: string) => {
    if (variableName === "") {
      const valueWithoutVariable = editedParams[fieldName];
      if (
        typeof valueWithoutVariable === "string" &&
        valueWithoutVariable.startsWith("{{") &&
        valueWithoutVariable.endsWith("}}")
      ) {
        // If it was a variable reference, clear it completely
        const newParams = { ...editedParams };
        delete newParams[fieldName];
        setEditedParams(newParams);
      }
    } else {
      // Set the parameter value to the variable reference format
      setEditedParams({
        ...editedParams,
        [fieldName]: `{{${variableName}}}`,
      });
    }
  };

  const isVariableReference = (value: any): boolean => {
    return typeof value === "string" && value.startsWith("{{") && value.endsWith("}}");
  };

  const getVariableNameFromReference = (value: string): string => {
    if (isVariableReference(value)) {
      return value.slice(2, -2); // Remove {{ and }}
    }
    return "";
  };

  const getAdvancedParameters = (): AdvancedParameters => {
    if (editedAdvancedParams !== null) {
      return editedAdvancedParams;
    }

    if (selectedCommand?.commandInfo?.advancedParameters) {
      return selectedCommand.commandInfo.advancedParameters;
    }

    return {
      skipExecutionVariable: { variable: null, value: "" },
      runAsynchronously: false,
    };
  };

  const handleSkipVariableSelect = (variableName: string) => {
    const currentAdvParams = getAdvancedParameters();

    setEditedAdvancedParams({
      ...currentAdvParams,
      skipExecutionVariable: {
        ...currentAdvParams.skipExecutionVariable,
        variable: variableName === "" ? null : variableName,
      },
    });
  };

  const handleSkipValueChange = (value: string) => {
    const currentAdvParams = getAdvancedParameters();

    setEditedAdvancedParams({
      ...currentAdvParams,
      skipExecutionVariable: {
        ...currentAdvParams.skipExecutionVariable,
        value,
      },
    });
  };

  const handleRunAsyncChange = (isChecked: boolean) => {
    const currentAdvParams = getAdvancedParameters();

    setEditedAdvancedParams({
      ...currentAdvParams,
      runAsynchronously: isChecked,
    });
  };

  // Lane edits go only through setLane / setBarrier so a blank or "primary" lane
  // deletes the key and an off barrier deletes the key (D-01, Pitfall 24b).
  const handleLaneChange = (value: string) => {
    setEditedAdvancedParams(setLane(getAdvancedParameters(), value));
  };

  const handleBarrierChange = (on: boolean) => {
    setEditedAdvancedParams(setBarrier(getAdvancedParameters(), on));
  };

  const handleSaveInputs = () => {
    if (isEditing && selectedCommand) {
      // Create updated params by merging original params with edited ones
      const updatedParams = {
        ...selectedCommand.commandInfo.params,
        ...editedParams,
      };

      // Get the advanced parameters
      const advancedParams = getAdvancedParameters();

      // Create updated command object
      const updatedCommand = {
        ...selectedCommand,
        commandInfo: {
          ...selectedCommand.commandInfo,
          params: updatedParams,
          advancedParameters: advancedParams,
        },
      };

      // Call the onSave function with the updated command
      onSave(updatedCommand);

      // Show success toast
      successToast("Success", "Command parameters have been updated");

      // Clear edited params
      setEditedParams({});
      setEditedAdvancedParams(null);

      // Close the drawer
      onClose();
    }
  };

  const advancedParams = getAdvancedParameters();

  // Lane suggestions and the author-time flag come from the protocol's own steps:
  // pure derivations, no effect and no query (UI-SPEC S1).
  const protocolInfos = (protocolCommands ?? []).map((c) => c.commandInfo);
  const selectedByIdentity = protocolCommands
    ? protocolCommands.findIndex((c) => c === selectedCommand)
    : -1;
  const selectedIndex =
    selectedByIdentity >= 0
      ? selectedByIdentity
      : protocolCommands && selectedCommand?.queueId !== undefined
        ? protocolCommands.findIndex((c) => c.queueId === selectedCommand.queueId)
        : -1;
  const laneSuggestions = suggestLanes(protocolInfos);
  const laneFlagText =
    isEditing && selectedIndex >= 0 ? laneFlag(protocolInfos, selectedIndex, advancedParams) : null;

  // The only writer of an instrument-fed param (D-09, DRP-05): the operator's
  // choice and its cascade clears land in ONE state update. A cleared child is
  // written as "" and never deleted, because a deleted key would fall back to
  // the saved value in handleSaveInputs' merge.
  const handleOptionSelect = (binding: FieldBinding, value: string, kind: ChangeKind) => {
    setEditedParams((prevParams) => ({ ...prevParams, ...applyChange(binding, value, kind) }));
  };

  // The only writer of a local-binding param (D-16): the operator's choice
  // lands in ONE functional update. A blank is written as "" and never deleted,
  // because a deleted key would fall back to the saved value in handleSaveInputs'
  // merge.
  const handleLocalSelect = (binding: LocalBinding, value: string) => {
    setEditedParams((prevParams) => ({ ...prevParams, ...applyLocalChange(binding, value) }));
  };

  // The only writer of the six well fields from a drag, a click, a typed edit or
  // Clear: ONE functional merge into editedParams. A plate change, a list load
  // or opening the drawer never reaches it. handleSaveInputs still spreads the
  // saved params first, so a blank written here wins over the saved value.
  const handleWellPatch = (patch: Record<string, string | number>) => {
    setEditedParams((prev) => ({ ...prev, ...patch }));
  };

  // One well field in the picker's "Edit as fields" section (edit mode only):
  // the typed input born as saved (wellFieldText) with the per-field variable
  // picker beside it. The "No Variable" choice writes "" rather than deleting
  // the key, so the save merge cannot fall back to the saved value.
  const renderWellField = (name: WellField) => {
    const saved = selectedCommand.commandInfo.params[name];
    const value = editedParams[name] !== undefined ? editedParams[name] : saved;
    const variableName = isVariableReference(value) ? getVariableNameFromReference(value) : "";
    return (
      <HStack width="100%" spacing={2} alignItems="flex-start">
        <Input
          flex={1}
          value={wellFieldText(value)}
          aria-label={name}
          inputMode={name.endsWith("_start_row") ? undefined : "numeric"}
          isDisabled={isVariableReference(value)}
          onChange={(e) => handleWellPatch(wellFieldPatch(name, e.target.value))}
        />
        <Select
          width="180px"
          value={variableName}
          onChange={(e) => {
            if (e.target.value === "") {
              handleWellPatch(wellFieldPatch(name, ""));
            } else {
              handleVariableSelect(name, e.target.value);
            }
          }}>
          <option value="">No Variable</option>
          {availableVariables?.map((variable) => (
            <option key={variable.id} value={variable.name}>
              {variable.name}
            </option>
          ))}
        </Select>
      </HStack>
    );
  };

  // Render the appropriate input field based on parameter type and name
  const renderParameterInput = (key: string, value: any) => {
    // Get current value (from editedParams if available, otherwise from command)
    const currentValue = editedParams[key] !== undefined ? editedParams[key] : value;

    // Check if it's a variable reference
    const isVariable = isVariableReference(currentValue);
    const variableName = isVariable ? getVariableNameFromReference(currentValue as string) : "";

    // Local F.A.S.T. param (deck select, Reuse tips checkbox), edit mode only
    // (D-16, DRP-08): looked up from the saved step's tool type, command and
    // param key. The read-only drawer (run page) keeps its plain rendering.
    const localBinding = isEditing
      ? lookupLocalBinding(
          selectedCommand.commandInfo.toolType,
          selectedCommand.commandInfo.command,
          key,
        )
      : undefined;
    if (localBinding !== undefined) {
      return (
        <HStack width="100%" spacing={2} alignItems="flex-start">
          {isStaticBinding(localBinding) && (
            <StaticSelect
              binding={localBinding}
              value={currentValue}
              allowVariables={true}
              onSelect={(v) => handleLocalSelect(localBinding, v)}
            />
          )}
          {isCheckboxBinding(localBinding) && (
            <TipReuseCheckbox
              binding={localBinding}
              value={currentValue}
              allowVariables={true}
              onSelect={(v) => handleLocalSelect(localBinding, v)}
            />
          )}
          <Select
            width="180px"
            value={variableName}
            onChange={(e) => {
              if (!isEditing) return;
              if (e.target.value === "") {
                handleLocalSelect(localBinding, "");
              } else {
                handleVariableSelect(key, e.target.value);
              }
            }}
            isDisabled={!isEditing}>
            <option value="">No Variable</option>
            {availableVariables?.map((variable) => (
              <option key={variable.id} value={variable.name}>
                {variable.name}
              </option>
            ))}
          </Select>
        </HStack>
      );
    }

    // Instrument-fed param, edit mode only (D-14, DRP-08): looked up from the
    // saved step's tool type, command and param key. The read-only drawer (run
    // page) never mounts OptionsSelect and so issues no list read.
    const binding = isEditing
      ? lookupFieldBinding(
          selectedCommand.commandInfo.toolType,
          selectedCommand.commandInfo.command,
          key,
        )
      : undefined;
    if (binding !== undefined) {
      const savedParams: Record<string, unknown> = selectedCommand.commandInfo.params;
      const showRefresh =
        firstFieldForSource(
          Object.keys(savedParams),
          selectedCommand.commandInfo.toolType,
          selectedCommand.commandInfo.command,
          binding.source,
        ) === key;
      return (
        <HStack width="100%" spacing={2} alignItems="flex-start">
          <OptionsSelect
            toolId={selectedCommand.commandInfo.toolId}
            binding={binding}
            value={currentValue}
            values={{ ...savedParams, ...editedParams }}
            enabled={isEditing}
            allowVariables={true}
            showRefresh={showRefresh}
            onSelect={(v, kind) => handleOptionSelect(binding, v, kind)}
          />
          <Select
            width="180px"
            value={variableName}
            onChange={(e) => {
              if (!isEditing) return;
              if (e.target.value === "") {
                // Unbinding an instrument-fed field writes a blank and clears
                // its cascade children (WR-02). Deleting the key would fall
                // back to the saved value and could leave a mismatched
                // device/deck/nest triple, and could not unbind a saved
                // {{variable}} at all.
                handleOptionSelect(binding, "", "select");
              } else {
                handleVariableSelect(key, e.target.value);
              }
            }}
            isDisabled={!isEditing}>
            <option value="">No Variable</option>
            {availableVariables?.map((variable) => (
              <option key={variable.id} value={variable.name}>
                {variable.name}
              </option>
            ))}
          </Select>
        </HStack>
      );
    }

    // For labware parameters, render a dropdown
    if (key === "labware") {
      return (
        <HStack width="100%" spacing={2}>
          <Select
            flex={1}
            value={isVariable ? "" : (currentValue as string) || "default"}
            onChange={(e) => {
              if (!isVariable && isEditing) {
                setEditedParams({
                  ...editedParams,
                  [key]: e.target.value,
                });
              }
            }}
            isDisabled={isVariable || !isEditing}>
            {labwareData?.map((labware) => (
              <option key={labware.id} value={labware.name}>
                {labware.name}
              </option>
            ))}
            {!labwareData?.some((labware) => labware.name.toLowerCase() === "default") && (
              <option value="default">default</option>
            )}
          </Select>
          <Select
            width="180px"
            value={variableName}
            onChange={(e) => {
              if (isEditing) {
                handleVariableSelect(key, e.target.value);
              }
            }}
            isDisabled={!isEditing}>
            <option value="">No Variable</option>
            {availableVariables?.map((variable) => (
              <option key={variable.id} value={variable.name}>
                {variable.name}
              </option>
            ))}
          </Select>
        </HStack>
      );
    }

    if (
      key === "name" &&
      selectedCommand?.commandInfo?.command === "user_form" &&
      selectedCommand?.commandInfo?.toolType === "toolbox"
    ) {
      return (
        <HStack width="100%" spacing={2}>
          <Select
            flex={1}
            value={isVariable ? "" : (currentValue as string) || ""}
            onChange={(e) => {
              if (!isVariable && isEditing) {
                setEditedParams({
                  ...editedParams,
                  [key]: e.target.value,
                });
              }
            }}
            isDisabled={isVariable || !isEditing}
            placeholder="Select a form">
            {forms && forms.length > 0 ? (
              forms.map((form) => (
                <option key={form.id} value={form.name}>
                  {form.name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                No forms available
              </option>
            )}
          </Select>
          <Select
            width="180px"
            value={variableName}
            onChange={(e) => {
              if (isEditing) {
                handleVariableSelect(key, e.target.value);
              }
            }}
            isDisabled={!isEditing}>
            <option value="">No Variable</option>
            {availableVariables?.map((variable) => (
              <option key={variable.id} value={variable.name}>
                {variable.name}
              </option>
            ))}
          </Select>
        </HStack>
      );
    }

    // For sequence_name in run_sequence command, render a dropdown
    if (key === "sequence_name" && selectedCommand?.commandInfo?.command === "run_sequence") {
      return (
        <HStack width="100%" spacing={2}>
          <Select
            flex={1}
            value={isVariable ? "" : (currentValue as string) || ""}
            onChange={(e) => {
              if (!isVariable && isEditing) {
                setEditedParams({
                  ...editedParams,
                  [key]: e.target.value,
                });
              }
            }}
            isDisabled={isVariable || !isEditing || waypointsQuery.isLoading}
            placeholder={waypointsQuery.isLoading ? "Loading sequences..." : "Select a sequence"}>
            {waypointsQuery.isLoading ? (
              <option value="" disabled>
                Loading...
              </option>
            ) : waypointsQuery.data?.sequences && waypointsQuery.data.sequences.length > 0 ? (
              waypointsQuery.data.sequences.map((seq) => (
                <option key={seq.id} value={seq.name}>
                  {seq.name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                {waypointsQuery.isError ? "Error loading sequences" : "No sequences available"}
              </option>
            )}
          </Select>
          <Select
            width="180px"
            value={variableName}
            onChange={(e) => {
              if (isEditing) {
                handleVariableSelect(key, e.target.value);
              }
            }}
            isDisabled={!isEditing}>
            <option value="">No Variable</option>
            {availableVariables?.map((variable) => (
              <option key={variable.id} value={variable.name}>
                {variable.name}
              </option>
            ))}
          </Select>
        </HStack>
      );
    }

    // For location fields in various PF400 commands
    if (
      key === "name" &&
      selectedCommand?.commandInfo?.command === "move" &&
      selectedCommand?.commandInfo?.toolType === "pf400"
    ) {
      return (
        <HStack width="100%" spacing={2}>
          <Select
            flex={1}
            value={isVariable ? "" : (currentValue as string) || ""}
            onChange={(e) => {
              if (!isVariable && isEditing) {
                setEditedParams({
                  ...editedParams,
                  [key]: e.target.value,
                });
              }
            }}
            isDisabled={isVariable || !isEditing || waypointsQuery.isLoading}
            placeholder={waypointsQuery.isLoading ? "Loading locations..." : "Select a location"}>
            {waypointsQuery.isLoading ? (
              <option value="" disabled>
                Loading...
              </option>
            ) : waypointsQuery.data?.locations && waypointsQuery.data.locations.length > 0 ? (
              waypointsQuery.data.locations.map((loc) => (
                <option key={loc.id} value={loc.name}>
                  {loc.name}
                </option>
              ))
            ) : (
              <option value="" disabled>
                {waypointsQuery.isError ? "Error loading locations" : "No locations available"}
              </option>
            )}
          </Select>
          <Select
            width="180px"
            value={variableName}
            onChange={(e) => {
              if (isEditing) {
                handleVariableSelect(key, e.target.value);
              }
            }}
            isDisabled={!isEditing}>
            <option value="">No Variable</option>
            {availableVariables?.map((variable) => (
              <option key={variable.id} value={variable.name}>
                {variable.name}
              </option>
            ))}
          </Select>
        </HStack>
      );
    }

    // Default rendering for all other parameters
    return (
      <HStack width="100%" spacing={2}>
        <Input
          flex={1}
          value={isVariable ? "" : (currentValue as string) || ""}
          onChange={(e) => {
            if (!isVariable && isEditing) {
              setEditedParams({
                ...editedParams,
                [key]: e.target.value,
              });
            }
          }}
          placeholder={isVariable ? "Using variable" : "Enter value"}
          isDisabled={isVariable || !isEditing}
        />
        <Select
          width="180px"
          value={variableName}
          onChange={(e) => {
            if (isEditing) {
              handleVariableSelect(key, e.target.value);
            }
          }}
          isDisabled={!isEditing}>
          <option value="">No Variable</option>
          {availableVariables?.map((variable) => (
            <option key={variable.id} value={variable.name}>
              {variable.name}
            </option>
          ))}
        </Select>
      </HStack>
    );
  };

  return (
    <Drawer isOpen={isOpen} onClose={onClose} placement="right" size="lg">
      <DrawerOverlay />
      <DrawerContent>
        <DrawerCloseButton />
        <DrawerHeader>Command Details</DrawerHeader>
        <DrawerBody>
          {selectedCommand ? (
            <VStack spacing={4} align="self-start" width="100%">
              <Divider />
              <Text as="b">Tool:</Text>
              <Text>{capitalizeFirst(selectedCommand.commandInfo.toolType)}</Text>
              <Divider />
              <Text as="b">Name:</Text>
              <Text>
                {capitalizeFirst(selectedCommand.commandInfo.command.replaceAll("_", " "))}
              </Text>
              <Divider />
              <Text as="b" fontSize="18px">
                Parameters
              </Text>
              <VStack align="stretch" spacing={4} width="100%">
                {Object.entries(selectedCommand.commandInfo.params).map(([key, value], index) => {
                  // The six well fields, edit mode only: one picker at the first
                  // saved well key, nothing at the rest. The read-only drawer (run
                  // page) renders them exactly as before: no grid and no read.
                  const wellsBinding = isEditing
                    ? lookupLocalBinding(
                        selectedCommand.commandInfo.toolType,
                        selectedCommand.commandInfo.command,
                        key,
                      )
                    : undefined;
                  if (wellsBinding !== undefined && isWellsBinding(wellsBinding)) {
                    if (
                      !isWellGroupAnchor(
                        Object.keys(selectedCommand.commandInfo.params),
                        selectedCommand.commandInfo.toolType,
                        selectedCommand.commandInfo.command,
                        key,
                      )
                    ) {
                      return null;
                    }
                    return (
                      <Box key="well-picker">
                        <FastTransferWellPicker
                          toolId={selectedCommand.commandInfo.toolId}
                          enabled={isEditing}
                          values={{ ...selectedCommand.commandInfo.params, ...editedParams }}
                          allowVariables={true}
                          fieldsLayout="rows"
                          onPatch={handleWellPatch}
                          renderField={renderWellField}
                        />
                      </Box>
                    );
                  }

                  // Get current value (from editedParams if available, otherwise from command)
                  const currentValue = editedParams[key] !== undefined ? editedParams[key] : value;

                  // Check if it's a variable reference
                  const isVariable = isVariableReference(currentValue);
                  const variableName = isVariable
                    ? getVariableNameFromReference(currentValue as string)
                    : "";

                  return (
                    <Box key={index}>
                      <Text as="b" flex="1" mb={1}>
                        {capitalizeFirst(key).replaceAll("_", " ")}:
                        {isVariable && (
                          <Badge ml={2} colorScheme="green">
                            Variable: {variableName}
                          </Badge>
                        )}
                      </Text>
                      {renderParameterInput(key, value)}
                    </Box>
                  );
                })}

                {/* Advanced Parameters Section */}
                <Accordion allowToggle width="100%" mt={4}>
                  <AccordionItem>
                    <h2>
                      <AccordionButton>
                        <Box as="span" flex="1" textAlign="left">
                          <Text as="b" fontSize="16px">
                            Advanced Parameters
                          </Text>
                        </Box>
                        <AccordionIcon />
                      </AccordionButton>
                    </h2>
                    <AccordionPanel pb={4}>
                      <VStack align="stretch" spacing={4} width="100%">
                        {/* Skip Execution Variable */}
                        <Text as="b" fontSize="15px">
                          Skip Execution Condition
                        </Text>
                        <FormControl>
                          <FormLabel>Variable</FormLabel>
                          <Select
                            value={advancedParams.skipExecutionVariable?.variable || ""}
                            onChange={(e) => handleSkipVariableSelect(e.target.value)}
                            isDisabled={!isEditing}>
                            <option value="">None</option>
                            {availableVariables?.map((variable) => (
                              <option key={variable.id} value={variable.name}>
                                {variable.name}
                              </option>
                            ))}
                          </Select>
                        </FormControl>

                        <FormControl
                          isDisabled={
                            !advancedParams.skipExecutionVariable?.variable || !isEditing
                          }>
                          <FormLabel>Value to Match</FormLabel>
                          <Input
                            value={advancedParams.skipExecutionVariable?.value || ""}
                            onChange={(e) => handleSkipValueChange(e.target.value)}
                            placeholder="Value that variable must match to skip"
                          />
                        </FormControl>

                        {isToolStep(selectedCommand?.commandInfo) && (
                          <>
                            <Divider my={4} />
                            <FormControl>
                              <FormLabel>Lane</FormLabel>
                              <Input
                                value={advancedParams.lane ?? ""}
                                onChange={(e) => handleLaneChange(e.target.value)}
                                placeholder="primary"
                                autoComplete="off"
                                maxLength={32}
                                list={isEditing ? "lane-suggestions" : undefined}
                                isDisabled={!isEditing}
                                aria-describedby={
                                  laneFlagText
                                    ? "lane-helper-text lane-flag-text"
                                    : "lane-helper-text"
                                }
                              />
                              {isEditing && (
                                <datalist id="lane-suggestions">
                                  {laneSuggestions.map((lane) => (
                                    <option key={lane} value={lane} />
                                  ))}
                                </datalist>
                              )}
                              <FormHelperText
                                id="lane-helper-text"
                                fontSize="xs"
                                color={mutedColor}>
                                {laneHelperText(laneSuggestions)}
                              </FormHelperText>
                              {laneFlagText && (
                                <Text id="lane-flag-text" fontSize="sm" color={warnColor} mt={2}>
                                  <WarningTwoIcon aria-hidden mr={2} />
                                  {laneFlagText}
                                </Text>
                              )}
                            </FormControl>

                            <FormControl display="flex" alignItems="center">
                              <FormLabel mb="0">Wait for all earlier steps</FormLabel>
                              <Switch
                                colorScheme="teal"
                                isChecked={advancedParams.laneBarrier === true}
                                onChange={(e) => handleBarrierChange(e.target.checked)}
                                isDisabled={!isEditing}
                              />
                            </FormControl>
                            <Text fontSize="xs" color={mutedColor}>
                              {LANE_BARRIER_HELP}
                            </Text>

                            <HStack align="flex-start" spacing={2}>
                              <InfoIcon aria-hidden mt={1} color={mutedColor} />
                              <Text fontSize="sm" color={mutedColor}>
                                {LANE_INERT_NOTE}
                              </Text>
                            </HStack>
                            <Divider my={4} />
                          </>
                        )}

                        {/* Run Asynchronously */}
                        <FormControl display="flex" alignItems="center" mt={4}>
                          <FormLabel mb="0">Run Asynchronously</FormLabel>
                          <Switch
                            isChecked={advancedParams.runAsynchronously || false}
                            onChange={(e) => handleRunAsyncChange(e.target.checked)}
                            isDisabled={!isEditing}
                          />
                        </FormControl>

                        <Text fontSize="sm" color="gray.500" mt={2}>
                          The command will be skipped if the selected variable matches the specified
                          value.
                        </Text>
                      </VStack>
                    </AccordionPanel>
                  </AccordionItem>
                </Accordion>

                {isEditing && (
                  <HStack spacing={4} mt={4} align="left">
                    <Button
                      colorScheme="teal"
                      variant="outline"
                      onClick={handleSaveInputs}
                      isDisabled={!isEditing}>
                      Save Inputs
                    </Button>
                  </HStack>
                )}
              </VStack>
            </VStack>
          ) : (
            <Text>No command selected.</Text>
          )}
        </DrawerBody>
      </DrawerContent>
    </Drawer>
  );
};
