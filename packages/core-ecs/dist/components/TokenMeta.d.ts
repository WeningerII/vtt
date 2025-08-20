/**
 * TokenMeta holds metadata about a token on the tabletop, such as
 * faction or whether the player can select it. This is a simplified
 * version of the full design described in the spec.
 */
export interface TokenMeta {
    faction: string;
    controllableBy?: string[];
    isSelectable?: boolean;
    isBlocking?: boolean;
}
//# sourceMappingURL=TokenMeta.d.ts.map