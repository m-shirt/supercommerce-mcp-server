import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from "express";
import cors from "cors";
export function createSSEServer(mcpServer) {
    const app = express();
    // Add CORS middleware here, before routes
    app.use(cors({
        origin: "*",
        credentials: true,
        methods: ["GET", "POST", "OPTIONS"],
        allowedHeaders: ["Content-Type"]
    }));
    const transportMap = new Map();
    app.post("/supercommerce_api/mcp", express.json(), async (req, res) => {
        try {
            // Create a transport for this request
            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: undefined, // or provide your own
            });
            // Close transport when client disconnects
            res.on("close", async () => {
                try {
                    await transport.close();
                }
                catch (err) {
                    console.error("Error closing transport:", err);
                }
            });
            // Connect MCP server to transport
            await mcpServer.connect(transport);
            // Handle the incoming JSON-RPC request
            await transport.handleRequest(req, res, req.body);
        }
        catch (error) {
            console.error("Error handling MCP request:", error);
            if (!res.headersSent) {
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: "Internal server error",
                    },
                    id: null,
                });
            }
        }
    });
    // streamableHttpServer(mcpServer, app, "/supercommerce_api/mcp");
    app.get("/supercommerce_api/mcp/sse", async (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Credentials", "true"); // if you want to support cookies/auth
        const transport = new SSEServerTransport("/supercommerce_api/mcp/messages", res);
        transportMap.set(transport.sessionId, transport);
        await mcpServer.connect(transport);
        // Heartbeat every 25 seconds to keep connection alive
        const heartbeat = setInterval(() => {
            res.write(`: ping - ${new Date().toISOString()}\n\n`);
        }, 25000);
        req.on("close", () => {
            clearInterval(heartbeat);
            transportMap.delete(transport.sessionId);
        });
    });
    app.post("/supercommerce_api/mcp/messages", (req, res) => {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Credentials", "true"); // optional, if you want cookies/auth
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        const sessionId = req.query.sessionId;
        if (!sessionId) {
            console.error("Message received without sessionId");
            return res.status(400).json({ error: "sessionId is required" });
        }
        const transport = transportMap.get(sessionId);
        if (!transport) {
            console.error(`No transport found for sessionId: ${sessionId}`);
            return res.status(404).json({ error: "Transport not found for sessionId" });
        }
        transport.handlePostMessage(req, res);
    });
    return app;
}
