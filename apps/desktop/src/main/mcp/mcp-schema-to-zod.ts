import { z } from "zod";

/**
 * Identical to apps/backend/src/modules/mcp/mcp-schema-to-zod.ts. Duplicated
 * rather than shared for the same reason as every other small stable utility
 * in this project (see apps/backend's token-crypto.ts comment) - this process
 * runs in a different runtime (Electron's main process vs. Express) and is
 * independently deployable/packaged.
 *
 * Why this exists at all: MCP's `listTools()` returns JSON Schema, but
 * `@langchain/google-genai`'s tool-binding path requires an actual Zod
 * object - handing it raw JSON Schema crashes with "Cannot read properties
 * of undefined (reading 'typeName')". This converts JSON Schema -> Zod for
 * exactly the shapes this project's own MCP tools use.
 */

interface JsonSchemaProperty {
  type?: string;
  description?: string;
  format?: string;
  enum?: string[];
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

function stringSchema(prop: JsonSchemaProperty): z.ZodTypeAny {
  if (prop.enum && prop.enum.length > 0) {
    return z.enum(prop.enum as [string, ...string[]]);
  }

  let schema = z.string();
  if (prop.format === "email") schema = schema.email();
  if (prop.format === "date-time") schema = schema.datetime();
  return schema;
}

function propertyToZod(prop: JsonSchemaProperty): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (prop.type) {
    case "string":
      schema = stringSchema(prop);
      break;
    case "number":
    case "integer":
      schema = z.number();
      break;
    case "boolean":
      schema = z.boolean();
      break;
    case "array":
      schema = z.array(prop.items ? propertyToZod(prop.items) : z.unknown());
      break;
    case "object":
      schema = objectToZod(prop);
      break;
    default:
      schema = z.unknown();
  }

  return prop.description ? schema.describe(prop.description) : schema;
}

function objectToZod(schema: JsonSchemaProperty): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const properties = schema.properties ?? {};
  const required = new Set(schema.required ?? []);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [key, propSchema] of Object.entries(properties)) {
    const fieldSchema = propertyToZod(propSchema);
    shape[key] = required.has(key) ? fieldSchema : fieldSchema.optional();
  }

  return z.object(shape);
}

export function mcpInputSchemaToZod(inputSchema: Record<string, unknown>): z.ZodObject<Record<string, z.ZodTypeAny>> {
  return objectToZod(inputSchema as JsonSchemaProperty);
}