// /api/index.js
import 'dotenv/config';
import { mcpServer } from '../src/mcp-server.js';
import { createSSEServer } from '../src/sse-server.js';

// Always export Express app for hosting environment
const sseServer = createSSEServer(mcpServer);

export default sseServer;
