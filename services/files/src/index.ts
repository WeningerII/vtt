import { logger } from "@vtt/logging";

/**
 * A very simple static file service. In a real deployment this would
 * likely run behind a CDN with signed URLs and cache control. For
 * demonstration we simply log that the service would start.
 */
function main() {
  logger.info("Files service stub – serve static assets here");
}

main();
