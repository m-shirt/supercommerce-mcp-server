import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { toolPaths } from "../src/tools/paths.js"; // Your array of tool relative paths


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

      const { definition = {} } = apiTool;

      mcpServer.registerTool(
        toolName,
        definition,
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
