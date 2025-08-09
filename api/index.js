import 'dotenv/config';
import { mcpServer } from './mcp-server.js';
import { createSSEServer } from './sse-server.js';

const sseServer = createSSEServer(mcpServer);

// Just export the Express/SSE server instance — no listen here!
export default sseServer;
