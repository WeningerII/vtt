import { logger } from '@vtt/logging';

/**
 * Authentication service stub. Real implementation would issue JWTs,
 * validate refresh tokens, and manage campaign membership. For now we
 * only log that the service started.
 */
function main() {
  logger.info('Auth service stub – handle user sessions here');
}

main();