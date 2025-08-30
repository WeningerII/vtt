/**
 * MessageType enumerates the different kinds of packets that can
 * traverse the network. These correspond to the design described in
 * the specification (HELLO, SNAPSHOT, INTENT, etc.).
 */
export declare enum MessageType {
    HELLO = 0,
    JOIN = 1,
    SNAPSHOT = 2,
    INTENT = 3,
    ACK = 4,
    CHAT = 5,
    RESYNC = 6
}
/**
 * A very small protocol codec that simply wraps JSON. Production
 * implementations should use binary varints and domain specific
 * encodings.
 */
export declare const _Protocol: {
    encode<T>(type: MessageType, payload: T): string;
    decode(data: string): {
        type: MessageType;
        payload: any;
    };
};
//# sourceMappingURL=Protocol.d.ts.map