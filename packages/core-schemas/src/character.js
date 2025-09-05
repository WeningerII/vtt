/**
 * Unified Character Schema - Shared between frontend and backend
 */
// Type guards
export function isCharacter(obj) {
    return obj && typeof obj.id === "string" && typeof obj.name === "string";
}
export function isCreateCharacterRequest(obj) {
    return (obj &&
        typeof obj.name === "string" &&
        typeof obj.race === "string" &&
        typeof obj.class === "string");
}
//# sourceMappingURL=character.js.map