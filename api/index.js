import 'dotenv/config';
import { mcpServer } from '../src/mcp-server.js';
import { createSSEServer } from '../src/sse-server.js';

const sseServer = createSSEServer(mcpServer);

// Export the Express app, do NOT listen here
export default sseServer;