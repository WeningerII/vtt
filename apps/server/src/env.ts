import { fileURLToPath } from 'url';
import path from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load the env file that sits next to the server code
dotenv.config({ path: path.resolve(__dirname, '../.env') });
