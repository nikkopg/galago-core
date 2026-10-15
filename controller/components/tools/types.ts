type Field = {
  name: string;
  type: "text" | "number" | "text_array" | "boolean" | "select";
  defaultValue?: any;
  // Allowed values for a "select" field; ignored for every other type.
  options?: readonly string[];
};

type Command = {
  [command: string]: Field[];
};

type CommandFields = {
  [tool: string]: Command;
};

type CommandStatus = {
  [commandName: string]: "idle" | "success" | "error";
};

type FieldType = "text" | "number" | "text_array" | "boolean" | "select" | Field[];
