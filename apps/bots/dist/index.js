import { Client, Protocol, MessageType } from '@vtt/net';
/**
 * Simple bot that connects to the server and sends a ping message.
 */
async function runBot() {
    const client = new Client('ws://localhost:8080');
    client.onMessage((msg) => {
        console.log('Bot received', msg);
    });
    // Wait until socket is open before sending
    setTimeout(() => {
        const joinPayload = { campaignId: 'demo', sceneId: 'scene1' };
        client.send(Protocol.encode(MessageType.JOIN, joinPayload));
    }, 1000);
}
runBot().catch(err => console.error(err));
//# sourceMappingURL=index.js.map