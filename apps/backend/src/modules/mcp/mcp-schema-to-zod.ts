import { z } from "zod";

/**
 * Minimal JSON-Schema-to-Zod converter, scoped to exactly what our own MCP
 * tools emit (see apps/mcp-gmail-calendar/src/tools/*.ts): flat objects of
 * string/number/boolean/array-of-string fields, optionally with an enum,
 * an "email" or "date-time" format, and per-field descriptions.
 *
 * Why this exists: `@modelcontextprotocol/sdk`'s `Client.listTools()` returns
 * each tool's input schema as JSON Schema (that's the wire format the MCP
 * protocol specifies), not as a Zod object. But `@langchain/google-genai`'s
 * tool-binding path calls `zodToJsonSchema()` on every tool's `schema`
 * unconditionally, assuming it's already a Zod instance - handing it raw JSON
 * Schema crashes with "Cannot read properties of undefined (reading
 * 'typeName')" the moment the agent tries to bind tools to the model. This
 * converter closes that gap by producing an actual Zod schema instead.
 *
 * This is intentionally NOT a general-purpose JSON-Schema-to-Zod library -
 * only the shapes our own tools use are supported. If a future MCP tool needs
 * something this doesn't handle (nested objects, oneOf/anyOf, etc.), extend
 * `propertyToZod` rather than reaching for a generic converter dependency.
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