import { RouteHandler } from "../router/types";
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from '../swagger/config';

export const swaggerDocsHandler: RouteHandler = async (ctx) => {
  const html = swaggerUi.generateHTML(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'VTT API Documentation'
  });
  
  ctx.res.writeHead(200, { 'Content-Type': 'text/html' });
  ctx.res.end(html);
};

export const swaggerJsonHandler: RouteHandler = async (ctx) => {
  ctx.res.writeHead(200, { 
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache'
  });
  ctx.res.end(JSON.stringify(swaggerSpec, null, 2));
};
