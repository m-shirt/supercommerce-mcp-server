import 'dotenv/config'; 
import { mcpServer } from "../api/mcp-server.js";
import { createSSEServer } from "../api/sse-server.js";

const sseServer = createSSEServer(mcpServer);

sseServer.listen(process.env.PORT || 3001, () => {
  console.log('Local server listening on port', process.env.PORT || 3001);
});