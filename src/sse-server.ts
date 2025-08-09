import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

export function createSSEServer(mcpServer: McpServer) {
  const app = express();

  const transportMap = new Map();

  app.get("/sse", async (req, res) => {
    const transport = new SSEServerTransport("/messages", res);
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

  app.post("/messages", (req, res) => {
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
