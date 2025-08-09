import 'dotenv/config'; 
import { mcpServer } from "../api/mcp-server.js";
import { createSSEServer } from "./sse-server.js";

const sseServer = createSSEServer(mcpServer);

if (process.env.VERCEL !== '1') {
  sseServer.listen(process.env.PORT || 3001, () => {
    console.log('Server listening locally on port', process.env.PORT || 3001);
  });
}
