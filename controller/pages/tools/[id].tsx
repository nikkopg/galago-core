import { ChangeEvent, useEffect, useState } from "react";
import ToolStatusCard from "@/components/tools/ToolStatusCard";
import { RunRecoverySection } from "@/components/tools/RunRecoverySection";
import { BoundedRawJson } from "@/components/ui/BoundedRawJson";
import {
  Select,
  Button,
  FormControl,
  FormLabel,
  Box,
  VStack,
  Input,
  NumberInput,
  NumberInputField,
  Heading,
  HStack,
  Text,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorModeValue,
} from "@chakra-ui/react";
import { useRouter } from "next/router";
import { trpc } from "@/utils/trpc";
import { ToolCommandInfo } from "@/types";
import { ToolType } from "gen-interfaces/controller";
import type { ExecuteCommandReply } from "gen-interfaces/tools/grpc_interfaces/tool_base";
import { capitalizeFirst } from "@/utils/parser";
import Head from "next/head";
import { TeachPendant } from "@/components/tools/advanced/teach_pendant/TeachPendant";
import { commandFields } from "@/components/tools/constants";
import { omitBlankParams, coerceBooleanParams } from "@/components/tools/commandParams";
import { lookupFieldBinding } from "@/components/tools/fieldOptions";
import { OptionsSelect } from "@/components/tools/OptionsSelect";
import { loadingToast } from "@/components/ui/Toast";
import { Tool } from "@/types";

// Inside your component
type AtomicFormValues = string | number | boolean | string[];
type FormValues = Record<string, AtomicFormValues | Record<string, AtomicFormValues>>;

// UI-SPEC copy pinned as module-top JS string constants (the G-04-5
// apostrophe-rule convention: rendered copy is never raw JSX text, and the
// display contract stays greppable at the source level).
const REPLY_META_DATA_LABEL = "Reply meta_data";
const NO_REPLY_DATA_LABEL = "No reply data returned.";

export default function Page() {
  const router = useRouter();
  const mutedColor = useColorModeValue("gray.500", "whiteAlpha.700");
  const [id, setId] = useState<string | null>(null);
  const infoQuery = trpc.tool.info.useQuery({ toolId: id || "" });
  const config = infoQuery.data;
  const [_commandExecutionStatus, setCommandExecutionStatus] = useState<CommandStatus>({});
  const [selectedCommand, setSelectedCommand] = useState<string | undefined>();
  const [formValues, setFormValues] = useState<FormValues>({});
  // The most recent completed runCommand reply (GEN-03): undefined = nothing
  // sent yet (the panel is born hidden), null = a completed send with no
  // reply data (the server did not set return_reply, RESEARCH Pitfall 6),
  // otherwise the reply with its optional meta_data record. Set ONLY from
  // the mutation's onSuccess handler — the error toast stays the only error
  // surface and the panel never feeds a send (UI-SPEC rules 5 and 6).
  const [lastReply, setLastReply] = useState<ExecuteCommandReply | null | undefined>(undefined);
  const [replyOpen, setReplyOpen] = useState(false);

  // Unused function - commented out (was used by __handleSelectCommand)
  // const doesCommandHaveParameters = (commandName: string) => {
  //   if (!config) return false;
  //   const fields = commandFields[config?.type][commandName];
  //   return fields && fields.length > 0;
  // };
  const toolCommandsDefined = Object.keys(commandFields).includes(String(config?.type));
  const commandOptions = config ? commandFields[config.type] : {};

  useEffect(() => {
    // Wait for the router to be ready and then extract the query parameter
    if (router.isReady) {
      const queryId = Array.isArray(router.query.id) ? router.query.id[0] : router.query.id;
      setId(queryId || null); // Ensure a null fallback if the ID is not available
    }
  }, [router.isReady, router.query.id]);

  useEffect(() => {
    if (config?.name) {
      document.title = `Tool: ${config.name}`;
    }
  }, [config?.name]);

  useEffect(() => {
    if (selectedCommand) {
      setFormValues((prevValues) => {
        const newValues = { ...prevValues };
        const fields = commandOptions[selectedCommand];

        fields.forEach((field) => {
          if (Array.isArray(field.type)) {
            const nestedFieldValues: Record<string, AtomicFormValues> = {};
            field.type.forEach((nestedField) => {
              nestedFieldValues[nestedField.name] =
                nestedField.defaultValue !== undefined ? nestedField.defaultValue : "";
            });
            newValues[field.name] = nestedFieldValues;
          }
          if (field.type === "text_array") {
            newValues[field.name] =
              field.defaultValue instanceof Array ? field.defaultValue.join(", ") : "";
          } else {
            newValues[field.name] = field.defaultValue !== undefined ? field.defaultValue : "";
          }
        });
        return newValues;
      });
    }
  }, [selectedCommand]);
  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedCommand(event.target.value);
    setFormValues({});
  };

  const commandMutation = trpc.tool.runCommand.useMutation();

  const executeCommandWithToast = (commandName: string, toolCommand: ToolCommandInfo) => {
    setCommandExecutionStatus((prevStatus) => ({ ...prevStatus, [commandName]: "idle" }));
    // Every new send starts with the reply disclosure collapsed again — one
    // panel, replaced per send, never a list (UI-SPEC rule 7).
    setReplyOpen(false);

    // Create a promise from the mutation
    const commandPromise = new Promise((resolve, reject) => {
      commandMutation.mutate(toolCommand, {
        onSuccess: (data) => {
          setCommandExecutionStatus((prevStatus) => ({
            ...prevStatus,
            [commandName]: "success",
          }));
          // Keep the reply for the read-only meta_data panel (GEN-03). A
          // completed send without reply data lands as null so the panel can
          // degrade legibly; onError leaves the panel untouched (UI-SPEC
          // rule 5).
          setLastReply(data ?? null);
          resolve(data);
        },
        onError: (error) => {
          setCommandExecutionStatus((prevStatus) => ({
            ...prevStatus,
            [commandName]: "error",
          }));
          reject(error);
        },
      });
    });

    // Use the loadingToast with the promise
    loadingToast(`Executing ${commandName}..`, "Please wait.", commandPromise, {
      successTitle: `Command ${commandName} completed!`,
      successDescription: () => "Command completed successfully",
      errorTitle: "Failed to execute command",
      errorDescription: (error) => `Error= ${error.message}`,
    });
  };

  const handleSubmit = () => {
    if (!selectedCommand || !config) return;

    const toolCommand: ToolCommandInfo = {
      toolId: config.name,
      toolType: config.type,
      command: selectedCommand,
      // D-04 (planner decision: omit blanks): a STACK send strips
      // empty-string/undefined/null params before the mutation — an
      // operator-typed 0 or false passes through. Coercion runs BEFORE the
      // strip (CR-01 gap closure, 05-04): a STACK boolean field stores the
      // operator's typed value as the string "false"/"true" (the boolean
      // Input's invalid HTML input type falls back to a text field), so
      // boolean-typed values
      // are coerced to real booleans first — a typed "false" sends false,
      // never the truthy protojs default of true. Every other tool type keeps
      // params verbatim so F.A.S.T. wire behavior is byte-identical to today;
      // the real-encoder wire cases pin the chosen STACK behaviour.
      params:
        String(config?.type) === "stack"
          ? omitBlankParams(
              coerceBooleanParams(
                formValues,
                selectedCommand ? (commandOptions[selectedCommand] ?? []) : [],
              ),
            )
          : formValues,
    };

    executeCommandWithToast(selectedCommand, toolCommand);
  };

  // Unused function - commented out (was used by __handleSelectCommand)
  // const executeCommand = (commandName: string, params: FormValues) => {
  //   if (!config) return;

  //   const toolCommand: ToolCommandInfo = {
  //     toolId: config.name,
  //     toolType: config.type,
  //     command: commandName,
  //     params: params,
  //   };

  //   executeCommandWithToast(commandName, toolCommand);
  // };

  const handleInputChange = (
    fieldName: string,
    fieldType: FieldType,
    value: string | number | boolean,
    parentField?: string,
  ) => {
    setFormValues((prevValues) => {
      const newValues = { ...prevValues };
      let updatedValue: AtomicFormValues = value;

      // If the field is of type 'text_array', split the string into an array.
      if (fieldType === "text_array" && typeof value === "string") {
        updatedValue = value.split(",").map((item) => item.trim());
      }

      if (parentField) {
        // If it's a nested field
        newValues[parentField] = {
          ...(newValues[parentField] as Record<string, any>),
          [fieldName]: updatedValue,
        };
      } else {
        // For top-level fields
        newValues[fieldName] = updatedValue;
      }
      return newValues;
    });
  };

  // Unused function - commented out
  // const __handleSelectCommand = (commandName: string) => {
  //   // Check if the command has parameters
  //   if (doesCommandHaveParameters(commandName)) {
  //     // If it has parameters, set up for additional input
  //     setSelectedCommand(commandName);
  //   } else {
  //     // If it doesn't have parameters, execute it immediately
  //     executeCommand(commandName, {});
  //   }
  // };
  const renderFields = (fields: Field[], parentField?: string) => {
    return fields.map((field) => {
      // Instrument-fed list field (D-10): top-level fields only. The binding map
      // is closed; every other field renders exactly as before.
      const binding = parentField
        ? undefined
        : lookupFieldBinding(String(config?.type), selectedCommand, field.name);
      if (binding !== undefined && binding.role.kind === "list") {
        return (
          <FormControl key={field.name} my={2}>
            <FormLabel>{field.name}</FormLabel>
            <OptionsSelect
              toolId={config?.name}
              binding={binding}
              value={formValues[field.name]}
              values={formValues}
              enabled={true}
              allowVariables={false}
              showRefresh={false}
              onSelect={(v) => handleInputChange(field.name, field.type, v)}
            />
          </FormControl>
        );
      }
      if (Array.isArray(field.type)) {
        return (
          <Box key={field.name} border="1px" borderColor="gray.200" borderRadius="md" p={4} my={2}>
            <Heading size="sm" mb={2}>
              {field.name}
            </Heading>
            {renderFields(field.type, field.name)}
          </Box>
        );
      } else if (field.type === "text_array") {
        return (
          <FormControl key={field.name} my={2}>
            <FormLabel>{field.name}</FormLabel>
            <Input
              type="text"
              value={String(
                (parentField
                  ? (formValues[parentField] as Record<string, AtomicFormValues>)?.[field.name] ||
                    ""
                  : formValues[field.name]) || "",
              )}
              onChange={(e) =>
                handleInputChange(field.name, field.type, e.target.value, parentField)
              }
            />
          </FormControl>
        );
      } else {
        return (
          <FormControl key={field.name} my={2}>
            <FormLabel>{field.name}</FormLabel>
            {field.type == "boolean" ? (
              <Input
                type="boolean"
                // Born-empty display (UI-SPEC AC-4): an untouched value (the
                // born-empty "") renders empty — never a painted "false"; a
                // genuinely typed value, including a real false, renders as
                // before. Nullish coalescing, not ||: only null/undefined are
                // absent, a real false is not.
                value={String(
                  (parentField
                    ? (formValues[parentField] as Record<string, AtomicFormValues>)?.[field.name]
                    : formValues[field.name]) ?? "",
                )}
                onChange={(e) =>
                  handleInputChange(field.name, field.type, e.target.value, parentField)
                }
              />
            ) : field.type === "select" ? (
              <Select
                placeholder="Select an option"
                value={String(
                  (parentField
                    ? (formValues[parentField] as Record<string, AtomicFormValues>)?.[field.name] ||
                      ""
                    : formValues[field.name]) || "",
                )}
                onChange={(e) =>
                  handleInputChange(field.name, field.type, e.target.value, parentField)
                }>
                {(field.options ?? []).map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            ) : field.type === "text" ? (
              <Input
                type="string"
                value={String(
                  (parentField
                    ? (formValues[parentField] as Record<string, AtomicFormValues>)?.[field.name] ||
                      ""
                    : formValues[field.name]) || "",
                )}
                onChange={(e) =>
                  handleInputChange(field.name, field.type, e.target.value, parentField)
                }
              />
            ) : (
              <NumberInput
                // Born-empty display (UI-SPEC AC-4): an untouched value (the
                // born-empty "") renders empty — never a painted 0; a genuinely
                // typed 0 renders as before. Nullish coalescing, not ||: only
                // null/undefined are absent, a real 0 is not.
                value={
                  ((parentField
                    ? (formValues[parentField] as Record<string, AtomicFormValues>)?.[field.name]
                    : formValues[field.name]) ?? "") as string | number
                }
                onChange={(_valueString, valueNumber) =>
                  // WR-01 (05-04): a cleared NumberInput parses to NaN — store
                  // the born-empty "" instead, so the visually-emptied field is
                  // blank and the STACK strip omits it (isBlank also treats a
                  // NaN as blank for defence in depth).
                  handleInputChange(
                    field.name,
                    field.type,
                    Number.isNaN(valueNumber) ? "" : valueNumber,
                    parentField,
                  )
                }>
                <NumberInputField />
              </NumberInput>
            )}
          </FormControl>
        );
      }
    });
  };

  return (
    <>
      <Head>
        <title>{config?.name ? `Tool: ${config.name}` : "Tool"}</title>
      </Head>
      <Box maxWidth="1800px" margin="auto">
        <HStack spacing={4} align="start" width="100%">
          {config?.type !== ToolType.pf400 && (
            <VStack spacing={4} width="100%">
              {!toolCommandsDefined && (
                <>
                  <Alert status="error" variant="left-accent" mb={2}>
                    <AlertIcon />
                    <Box flex="1">
                      <AlertTitle>Error</AlertTitle>
                      <AlertDescription>Invalid Tool Type.</AlertDescription>
                      <AlertDescription>
                        This tool has not been defined. Contact administrator.
                      </AlertDescription>
                    </Box>
                  </Alert>
                </>
              )}
              <ToolStatusCard toolId={id || ""} />
              {config && (
                <RunRecoverySection toolName={config.name} toolType={String(config.type)} />
              )}
              {toolCommandsDefined && (
                <FormControl>
                  <VStack width="100%" spacing={1}>
                    <FormLabel>Select Command</FormLabel>
                    <Select placeholder="Select command" onChange={handleChange}>
                      {Object.keys(commandOptions).map((command) => (
                        <option key={command} value={command}>
                          {capitalizeFirst(command.replaceAll("_", " "))}
                        </option>
                      ))}
                    </Select>
                    {selectedCommand && (
                      <>
                        {renderFields(commandOptions[selectedCommand])}
                        <Button width="100%" onClick={handleSubmit} colorScheme="teal">
                          Send Command
                        </Button>
                      </>
                    )}
                    {/* Reply meta_data panel (GEN-03, UI-SPEC AC-3): born hidden —
                        nothing renders until a completed send produces a reply. The
                        block is display-only: read-only bounded JSON through the one
                        shared display, no accent, no table, no editing affordance, no
                        send path (UI-SPEC rule 6). It shows the most recent completed
                        send's reply and is replaced per send (rule 7). */}
                    {lastReply !== undefined && (
                      <VStack align="stretch" width="100%" spacing={2} mt={4}>
                        <Heading size="sm" fontWeight={700}>
                          {REPLY_META_DATA_LABEL}
                        </Heading>
                        {lastReply?.meta_data !== undefined ? (
                          <BoundedRawJson
                            raw={lastReply.meta_data}
                            isOpen={replyOpen}
                            onToggle={() => setReplyOpen(!replyOpen)}
                          />
                        ) : (
                          <Text fontSize="sm" color={mutedColor}>
                            {NO_REPLY_DATA_LABEL}
                          </Text>
                        )}
                      </VStack>
                    )}
                  </VStack>
                </FormControl>
              )}
            </VStack>
          )}
          {config?.type === ToolType.pf400 && config && (
            <Box flex={1}>
              <TeachPendant tool={config as Tool} />
            </Box>
          )}
        </HStack>
      </Box>
    </>
  );
}
