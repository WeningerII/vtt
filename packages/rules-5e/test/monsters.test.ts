import { describe, it, expect } from "vitest";
import SRDMonsters, { Goblin, Orc, Skeleton, _Wolf} from "@vtt/content-5e-srd";
import { compileMonster, abilityMod, CR_XP_MAP, crToProficiency } from "../src";

describe("abilityMod()", () => {
  it("computes standard modifiers", () => {
    expect(abilityMod(10)).toBe(0);
    expect(abilityMod(8)).toBe(-1);
    expect(abilityMod(12)).toBe(1);
    expect(abilityMod(20)).toBe(5);
  });
});

describe("CR mappings", () => {
  it("maps CR to XP and proficiency", () => {
    expect(CR_XP_MAP["1/4"]).toBe(50);
    expect(crToProficiency("1/2")).toBe(2);
    expect(crToProficiency("5")).toBe(3);
    expect(crToProficiency("15")).toBe(5);
    expect(crToProficiency("21")).toBe(7);
    expect(crToProficiency("29")).toBe(9);
  });
});

describe("compileMonster()", () => {
  it("compiles Goblin correctly", () => {
    const cm = compileMonster(Goblin);
    expect(cm.name).toBe("Goblin");
    expect(cm.challengeRating).toBe("1/4");
    expect(cm.xp).toBe(50);
    expect(cm.proficiencyBonus).toBe(2);
    expect(cm.passivePerception).toBe(9); // explicit in data
  });

  it("compiles Orc and derives values when missing", () => {
    const { xp: _xp,  proficiencyBonus: _pb,  passivePerception: _pp,  _...rest  } = Orc as any;
    const cm = compileMonster(rest);
    expect(cm.xp).toBe(100); // from CR map
    expect(cm.proficiencyBonus).toBe(2); // from CR
    expect(cm.passivePerception).toBe(10); // 10 + WIS mod (0)
  });

  it("includes resistances/vulnerabilities and conditions", () => {
    const cm = compileMonster(Skeleton);
    expect(cm.damageVulnerabilities).toContain("bludgeoning");
    expect(cm.damageImmunities).toContain("poison");
    expect(cm.conditionImmunities).toContain("poisoned");
  });

  it("compiles a list without error", () => {
    const list = SRDMonsters.map((_m) => compileMonster(m));
    expect(list.length).toBeGreaterThan(0);
    const wolf = list.find((_m) => m.id === "srd-wolf")!;
    expect(wolf.passivePerception).toBe(13);
  });
});
