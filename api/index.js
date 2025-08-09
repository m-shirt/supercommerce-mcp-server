import 'dotenv/config';
import { mcpServer } from '../src/mcp-server.js';
import { createSSEServer } from '../src/sse-server.js';

const sseServer = createSSEServer(mcpServer);

// Just export the Express/SSE server instance — no listen here!
export default sseServer;
