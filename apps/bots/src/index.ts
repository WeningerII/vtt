import { Client, _Protocol as Protocol, MessageType } from "@vtt/net";
import { logger } from "@vtt/logging";

/**
 * Simple bot that connects to the server and sends a ping message.
 */
async function runBot() {
  const client = new Client("ws://localhost:8080");
  client.onMessage((msg: unknown) => {
    logger.info("Bot received", { message: msg });
  });
  // Wait until socket is open before sending
  setTimeout(() => {
    const joinPayload = { campaignId: "demo", sceneId: "scene1" };
    client.send(Protocol.encode(MessageType.JOIN, joinPayload));
  }, 1000);
}

runBot().catch((err) => logger.error(err));
