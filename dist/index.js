import 'dotenv/config';
import { mcpServer } from './mcp-server.js';
import { createSSEServer } from './sse-server.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
const args = process.argv.slice(2);
const app = createSSEServer(mcpServer);
if (args.includes('--stdio')) {
    const stdioTransport = new StdioServerTransport();
    await mcpServer.connect(stdioTransport);
    console.error('STDIO transport started');
}
else {
    const port = process.env.PORT || 3001;
    app.listen(port, () => {
        console.error(`Local server listening on http://localhost:${port}/supercommerce_api/mcp`);
    });
}
export default app;
