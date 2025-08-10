import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolPaths } from "./tools/paths.js";
import { z } from "zod";


const mcpServer = new McpServer({
  name: "ExampleMCPServer",
  version: "1.0.0"
}, {
  capabilities: {},
});



mcpServer.resource(
  'document',
  new ResourceTemplate("document://{name}", {
    list: async () => {
      return {
        resources: [
          {
            name: 'document-getting-started',
            uri: 'document://getting-started',
          }
        ]
      }
    }
  }),
  async (uri, variables) => {
    return {
      contents: [
        {
          uri: uri.href,
          text: 'Getting Started',
          mimeType: 'text/plain'
        }
      ]
    }
  }
);



function jsonSchemaToZod(schema: any): z.ZodTypeAny {
  // Handle union types like ['string', 'null']
  if (Array.isArray(schema.type)) {
    const nonNullType = schema.type.find((t: string) => t !== "null");
    const baseType = jsonSchemaToZod({ ...schema, type: nonNullType });
    return schema.type.includes("null") ? baseType.nullable() : baseType;
  }

  switch (schema.type) {
    case "string":
      return z.string();

    case "number":
      return z.number();

    case "integer":
      return z.number().int();

    case "boolean":
      return z.boolean();

    case "array":
      if (!schema.items) {
        throw new Error("Array type must have 'items'");
      }
      return z.array(jsonSchemaToZod(schema.items));

    case "object":
      if (!schema.properties) {
        return z.object({}).passthrough(); // allow any if no properties defined
      }
      const shape: Record<string, z.ZodTypeAny> = {};
      for (const [propName, propSchema] of Object.entries<any>(schema.properties)) {
        let propType = jsonSchemaToZod(propSchema);
        if (!schema.required || !schema.required.includes(propName)) {
          propType = propType.optional();
        }
        if (propSchema.description) {
          propType = propType.describe(propSchema.description);
        }
        shape[propName] = propType;
      }
      return z.object(shape);

    default:
      throw new Error(`Unsupported type: ${schema.type}`);
  }
}

function jsonSchemaToZodShape(jsonSchema: any): Record<string, z.ZodTypeAny> {
  if (jsonSchema.type !== "object" || !jsonSchema.properties) {
    throw new Error("Top-level schema must be type object");
  }

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [propName, propSchema] of Object.entries<any>(jsonSchema.properties)) {
    let zodType = jsonSchemaToZod(propSchema);
    if (propSchema.description) {
      zodType = zodType.describe(propSchema.description);
    }
    if (!jsonSchema.required || !jsonSchema.required.includes(propName)) {
      zodType = zodType.optional();
    }
    shape[propName] = zodType;
  }
  return shape;
}

const registeredTools = new Set<string>();

async function registerTools() {
  for (const toolPath of toolPaths) {
    const parts = toolPath.split("/");
    const fileName = parts[parts.length - 1];
    const toolName = fileName.replace(/\.js$/, "");

    if (registeredTools.has(toolName)) {
      console.warn(`Tool ${toolName} already registered — skipping`);
      continue;
    }

    try {
      const toolModule = await import(`./tools/${toolPath}`);
      const apiTool = toolModule.apiTool || toolModule.default;

      if (!apiTool) {
        console.warn(`No apiTool or default export found for ${toolName} in ${toolPath}`);
        continue;
      }

      const toolFunc = apiTool.function;
      if (typeof toolFunc !== "function") {
        console.warn(`apiTool.function is not a function for ${toolName} in ${toolPath}`);
        continue;
      }

     
 const definition_obj = {
    title: apiTool.definition.function.name,
    description: apiTool.definition.function.description,
    inputSchema: jsonSchemaToZodShape(apiTool.definition.function.parameters),
  };

      mcpServer.registerTool(
         toolName,
         definition_obj,
        async (args, extra) => {
          // Call your tool function with the provided arguments
          const rawResult = await toolFunc(args);

          // Wrap the raw result into the expected content array structure
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(rawResult, null, 2),
                mimeType: "application/json",
              },
            ],
          };
        }
      );

      registeredTools.add(toolName);
      console.log(`Registered tool: ${toolName}`);
    } catch (err) {
      console.error(`Failed to register tool ${toolName} from ${toolPath}:`, err);
    }
  }
}

// Run registration once on module load
await registerTools();

export { mcpServer };
