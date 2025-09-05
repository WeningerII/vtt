import path from 'path';
import dotenv from 'dotenv';

// Use process.cwd() for CommonJS compatibility
const __dirname = path.dirname(require.resolve('./env.ts'));

// Always load the env file that sits next to the server code
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Export something to make this a valid ES module
export {};
