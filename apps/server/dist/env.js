"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var url_1 = require("url");
var path_1 = require("path");
var dotenv_1 = require("dotenv");
var __filename = (0, url_1.fileURLToPath)(import.meta.url);
var __dirname = path_1.default.dirname(__filename);
// Always load the env file that sits next to the server code
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env') });
