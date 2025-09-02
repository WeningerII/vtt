/**
 * MessageType enumerates the different kinds of packets that can
 * traverse the network. These correspond to the design described in
 * the specification (HELLO, SNAPSHOT, INTENT, etc.).
 */
export var MessageType;
(function (MessageType) {
    MessageType[MessageType["HELLO"] = 0] = "HELLO";
    MessageType[MessageType["JOIN"] = 1] = "JOIN";
    MessageType[MessageType["SNAPSHOT"] = 2] = "SNAPSHOT";
    MessageType[MessageType["INTENT"] = 3] = "INTENT";
    MessageType[MessageType["ACK"] = 4] = "ACK";
    MessageType[MessageType["CHAT"] = 5] = "CHAT";
    MessageType[MessageType["RESYNC"] = 6] = "RESYNC";
})(MessageType || (MessageType = {}));
/**
 * A very small protocol codec that simply wraps JSON. Production
 * implementations should use binary varints and domain specific
 * encodings.
 */
export const _Protocol = {
    encode(type, payload) {
        return JSON.stringify({ type, payload });
    },
    decode(data) {
        return JSON.parse(data);
    },
};
//# sourceMappingURL=Protocol.js.map