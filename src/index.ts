import 'dotenv/config'; 
import { mcpServer } from "./mcp-server.js";
import { createSSEServer } from "./sse-server.js";

const sseServer = createSSEServer(mcpServer);

sseServer.listen(process.env.PORT || 3001, () => {
  console.log('Local server listening on port', process.env.PORT || 3001, "http://localhost:3001/supercommerce_api/mcp/sse");
});