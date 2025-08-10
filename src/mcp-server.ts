import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolPaths } from "./tools/paths.js";
import { z } from "zod";
import { completable } from "@modelcontextprotocol/sdk/server/completable.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";


const mcpServer = new McpServer({
  name: "Supercommerce",
  version: "1.0.0"
}, {
  capabilities: {},
});


mcpServer.registerResource(
  "document",
  "document://document-getting-started",
  {
       title: "Getting Started",
       description: "Getting Started",
        mimeType: "text/plain"
  },
  
  async (uri) => ({
    contents: [{
          uri: uri.href,
          text: 'Getting Started',
    }]
  })
);

mcpServer.registerResource(
  "config",
  "config://app",
  {
    title: "Application Config",
    description: "Application configuration data",
    mimeType: "text/plain"
  },
  async (uri) => ({
    contents: [{
      uri: uri.href,
      text: "App configuration here"
    }]
  })
);

//Dynamic resource with parameters
mcpServer.registerResource(
  "user-profile",
  new ResourceTemplate("users://{userId}/profile", { list: undefined }),
  {
    title: "User Profile",
    description: "User profile information"
  },
  async (uri, { userId }) => ({
    contents: [{
      uri: uri.href,
      text: `Profile data for user ${userId}`
    }]
  })
);

// // Resource with context-aware completion
mcpServer.registerResource(
  "repository",
  new ResourceTemplate("github://repos/{owner}/{repo}", {
    list: undefined,
    complete: {
      // Provide intelligent completions based on previously resolved parameters
      repo: (value, context) => {
        if (context?.arguments?.["owner"] === "org1") {
          return ["project1", "project2", "project3"].filter(r => r.startsWith(value));
        }
        return ["default-repo"].filter(r => r.startsWith(value));
      }
    }
  }),
  {
    title: "GitHub Repository",
    description: "Repository information"
  },
  async (uri, { owner, repo }) => ({
    contents: [{
      uri: uri.href,
      text: `Repository: ${owner}/${repo}`
    }]
  })
);

// Tool that returns ResourceLinks
mcpServer.registerTool(
  "list-files",
  {
    title: "List Files",
    description: "List project files",
    inputSchema: { pattern: z.string() }
  },
  async ({ pattern }) => ({
    content: [
      { type: "text", text: `Found files matching "${pattern}":` },
      // ResourceLinks let tools return references without file content
      {
        type: "resource_link",
        uri: "file:///README.md",
        name: "README.md",
        mimeType: "text/markdown",
        description: 'A README file'
      },
      {
        type: "resource_link",
        uri: "file:///src/index.ts",
        name: "index.ts",
        mimeType: "text/typescript",
        description: 'An index file'
      }
    ]
  })
);

mcpServer.registerPrompt(
  "review-code",
  {
    title: "Code Review",
    description: "Review code for best practices and potential issues",
    argsSchema: { code: z.string() }
  },
  ({ code }) => ({
    messages: [{
      role: "user",
      content: {
        type: "text",
        text: `Please review this code:\n\n${code}`
      }
    }]
  })
);

// Prompt with context-aware completion
mcpServer.registerPrompt(
  "team-greeting",
  {
    title: "Team Greeting",
    description: "Generate a greeting for team members",
    argsSchema: {
      department: completable(z.string(), (value) => {
        // Department suggestions
        return ["engineering", "sales", "marketing", "support"].filter(d => d.startsWith(value));
      }),
      name: completable(z.string(), (value, context) => {
        // Name suggestions based on selected department
        const department = context?.arguments?.["department"];
        if (department === "engineering") {
          return ["Alice", "Bob", "Charlie"].filter(n => n.startsWith(value));
        } else if (department === "sales") {
          return ["David", "Eve", "Frank"].filter(n => n.startsWith(value));
        } else if (department === "marketing") {
          return ["Grace", "Henry", "Iris"].filter(n => n.startsWith(value));
        }
        return ["Guest"].filter(n => n.startsWith(value));
      })
    }
  },
  ({ department, name }) => ({
    messages: [{
      role: "assistant",
      content: {
        type: "text",
        text: `Hello ${name}, welcome to the ${department} team!`
      }
    }]
  })
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
      console.error(`Registered tool: ${toolName}`);
    } catch (err) {
      console.error(`Failed to register tool ${toolName} from ${toolPath}:`, err);
    }
  }
}

// Run registration once on module load
await registerTools();

// Tool that uses LLM sampling to summarize any text
mcpServer.registerTool(
  "summarize",
  {
    description: "Summarize any text using an LLM",
    inputSchema: {
      text: z.string().describe("Text to summarize"),
    },
  },
  async ({ text }) => {
    // Call the LLM through MCP sampling
    const response = await mcpServer.server.createMessage({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Please summarize the following text concisely:\n\n${text}`,
          },
        },
      ],
      maxTokens: 500,
    });

    return {
      content: [
        {
          type: "text",
          text: response.content.type === "text" ? response.content.text : "Unable to generate summary",
        },
      ],
    };
  }
);

export { mcpServer };
