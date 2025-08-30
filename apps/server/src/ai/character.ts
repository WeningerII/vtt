/**
 * AI Character Generation Service - Genesis System
 * Handles intelligent character creation from natural language prompts
 */

import { PrismaClient } from "@prisma/client";
// import { OpenAIProvider, AnthropicProvider } from "@vtt/ai"; // Temporarily disabled due to build issues
import { CharacterService } from "../character/CharacterService";

export interface CharacterConcept {
  prompt: string;
  preferences?: {
    system?: string; // D&D 5e, Pathfinder, etc.
    powerLevel?: "low" | "standard" | "high" | "epic";
    complexity?: "simple" | "moderate" | "complex";
    playstyle?: "combat" | "roleplay" | "exploration" | "balanced";
  };
}

export interface GenerationStep {
  step:
    | "concept"
    | "race"
    | "class"
    | "background"
    | "abilities"
    | "equipment"
    | "spells"
    | "personality"
    | "optimization";
  status: "pending" | "processing" | "completed" | "error";
  result?: any;
  reasoning?: string;
  alternatives?: any[];
  confidence?: number;
}

export interface CharacterGeneration {
  id: string;
  concept: CharacterConcept;
  steps: GenerationStep[];
  currentStep: string;
  character?: any;
  isComplete: boolean;
  error?: string;
  metadata: {
    provider: string;
    totalCostUSD: number;
    totalLatencyMs: number;
    generatedAt: Date;
  };
}

export class GenesisService {
  private prisma: PrismaClient;
  private characterService: CharacterService;
  private openaiProvider?: OpenAIProvider;
  private anthropicProvider?: AnthropicProvider;
  private activeGenerations = new Map<string, CharacterGeneration>();

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.characterService = new CharacterService();

    // Initialize AI providers
    const openaiKey = process.env.OPENAI_API_KEY;
    if (openaiKey?.trim()) {
      this.openaiProvider = new OpenAIProvider({ apiKey: openaiKey });
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey?.trim()) {
      this.anthropicProvider = new AnthropicProvider({ apiKey: anthropicKey });
    }
  }

  /**
   * Start character generation from concept
   */
  async startGeneration(concept: CharacterConcept, userId: string): Promise<CharacterGeneration> {
    const generationId = this.generateId();

    const generation: CharacterGeneration = {
      id: generationId,
      concept,
      steps: [
        { step: "concept", status: "processing" },
        { step: "race", status: "pending" },
        { step: "class", status: "pending" },
        { step: "background", status: "pending" },
        { step: "abilities", status: "pending" },
        { step: "equipment", status: "pending" },
        { step: "spells", status: "pending" },
        { step: "personality", status: "pending" },
        { step: "optimization", status: "pending" },
      ],
      currentStep: "concept",
      isComplete: false,
      metadata: {
        provider: "genesis",
        totalCostUSD: 0,
        totalLatencyMs: 0,
        generatedAt: new Date(),
      },
    };

    this.activeGenerations.set(generationId, generation);

    // Start async generation process
    this.processGeneration(generation, userId).catch((error) => {
      generation.error = error.message;
      generation.steps.forEach((step) => {
        if (step.status === "processing") step.status = "error";
      });
    });

    return generation;
  }

  /**
   * Get generation status
   */
  getGeneration(generationId: string): CharacterGeneration | null {
    return this.activeGenerations.get(generationId) || null;
  }

  /**
   * Process character generation pipeline
   */
  private async processGeneration(generation: CharacterGeneration, userId: string): Promise<void> {
    try {
      // Step 1: Analyze concept
      await this.analyzeConceptStep(generation);

      // Step 2: Determine race
      await this.determineRaceStep(generation);

      // Step 3: Determine class
      await this.determineClassStep(generation);

      // Step 4: Determine background
      await this.determineBackgroundStep(generation);

      // Step 5: Generate ability scores
      await this.generateAbilitiesStep(generation);

      // Step 6: Generate equipment
      await this.generateEquipmentStep(generation);

      // Step 7: Generate spells (if applicable)
      await this.generateSpellsStep(generation);

      // Step 8: Generate personality
      await this.generatePersonalityStep(generation);

      // Step 9: Optimize build
      await this.optimizeCharacterStep(generation);

      // Create final character
      const character = await this.createFinalCharacter(generation, userId);
      generation.character = character;
      generation.isComplete = true;
    } catch (error: any) {
      generation.error = error.message;
      throw error;
    }
  }

  private async analyzeConceptStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "concept");
    step.status = "processing";

    const prompt = `Analyze this D&D 5e character concept and extract key elements:

Concept: "${generation.concept.prompt}"

Preferences: ${JSON.stringify(generation.concept.preferences || {}, null, 2)}

Please analyze and extract:
1. Core character archetype/role
2. Suggested race options (3-5 best fits)
3. Suggested class options (3-5 best fits)  
4. Suggested background options (3-5 best fits)
5. Key personality traits implied
6. Combat vs roleplay focus
7. Power level assessment
8. Complexity requirements

Format as JSON with clear reasoning for each suggestion.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.9;

    this.updateCurrentStep(generation, "race");
  }

  private async determineRaceStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "race");
    step.status = "processing";

    const conceptAnalysis = this.getStep(generation, "concept").result;

    const prompt = `Based on this character concept analysis, choose the BEST race for this character:

Concept Analysis: ${JSON.stringify(conceptAnalysis, null, 2)}

Available D&D 5e races:
- Human (Variant/Standard)
- Elf (High/Wood/Dark/Eladrin)
- Dwarf (Mountain/Hill)
- Halfling (Lightfoot/Stout)
- Dragonborn
- Gnome (Forest/Rock)
- Half-Elf
- Half-Orc
- Tiefling
- Aarakocra
- Genasi
- Goliath
- Tabaxi
- Triton
- Aasimar
- Firbolg
- Kenku
- Lizardfolk
- Tortle
- Bugbear
- Goblin
- Hobgoblin
- Kobold
- Orc
- Yuan-Ti Pureblood

Choose ONE race and provide:
1. Selected race and subrace
2. Reasoning for choice
3. How racial traits support the concept
4. Alternative races considered
5. Ability score improvements gained

Format as JSON.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.85;

    this.updateCurrentStep(generation, "class");
  }

  private async determineClassStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "class");
    step.status = "processing";

    const conceptAnalysis = this.getStep(generation, "concept").result;
    const raceChoice = this.getStep(generation, "race").result;

    const prompt = `Choose the BEST class for this character:

Concept: ${JSON.stringify(conceptAnalysis, null, 2)}
Selected Race: ${JSON.stringify(raceChoice, null, 2)}

Available D&D 5e classes:
- Artificer
- Barbarian  
- Bard
- Cleric
- Druid
- Fighter
- Monk
- Paladin
- Ranger
- Rogue
- Sorcerer
- Warlock
- Wizard

Consider:
1. How class synergizes with chosen race
2. Concept fulfillment
3. Mechanical optimization
4. Roleplay opportunities

Choose ONE class and provide:
1. Selected class
2. Reasoning for choice
3. Suggested subclass at level 3
4. Key abilities and features
5. How it fulfills the character concept
6. Starting level recommendation (1-3)

Format as JSON.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.8;

    this.updateCurrentStep(generation, "background");
  }

  private async determineBackgroundStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "background");
    step.status = "processing";

    const conceptAnalysis = this.getStep(generation, "concept").result;
    const raceChoice = this.getStep(generation, "race").result;
    const classChoice = this.getStep(generation, "class").result;

    const prompt = `Choose the BEST background for this character:

Concept: ${JSON.stringify(conceptAnalysis, null, 2)}
Race: ${JSON.stringify(raceChoice, null, 2)}
Class: ${JSON.stringify(classChoice, null, 2)}

Available D&D 5e backgrounds:
- Acolyte, Criminal, Folk Hero, Noble, Sage, Soldier
- Charlatan, Entertainer, Guild Artisan, Hermit, Outlander, Sailor
- Anthropologist, Archaeologist, City Watch, Clan Crafter, Cloistered Scholar
- Courtier, Faction Agent, Far Traveler, Inheritor, Knight of the Order
- Mercenary Veteran, Urban Bounty Hunter, Uthgardt Tribe Member, Waterdhavian Noble

Consider:
1. Story integration with concept
2. Skill proficiencies that complement class
3. Background features and benefits
4. Roleplay opportunities
5. Equipment and starting wealth

Choose ONE background and provide:
1. Selected background
2. Reasoning for choice  
3. Skill proficiencies gained
4. Background feature description
5. How it enhances the character story
6. Starting equipment from background

Format as JSON.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.75;

    this.updateCurrentStep(generation, "abilities");
  }

  private async generateAbilitiesStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "abilities");
    step.status = "processing";

    const raceChoice = this.getStep(generation, "race").result;
    const classChoice = this.getStep(generation, "class").result;

    const prompt = `Generate optimal ability scores for this character using point buy (27 points):

Race: ${JSON.stringify(raceChoice, null, 2)}
Class: ${JSON.stringify(classChoice, null, 2)}

Point Buy Rules:
- Start with 8 in each ability
- Costs: 9(1), 10(2), 11(3), 12(4), 13(5), 14(7), 15(9)
- 27 points total to spend
- Apply racial bonuses AFTER point buy

Prioritize:
1. Class primary abilities (highest priority)
2. Class secondary abilities  
3. Constitution for survivability
4. Abilities that support concept

Provide:
1. Base scores before racial bonuses (point buy)
2. Final scores after racial bonuses
3. Ability modifiers
4. Points spent breakdown
5. Reasoning for each score
6. How scores support class features

Format as JSON with clear STR/DEX/CON/INT/WIS/CHA breakdown.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.9;

    this.updateCurrentStep(generation, "equipment");
  }

  private async generateEquipmentStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "equipment");
    step.status = "processing";

    const classChoice = this.getStep(generation, "class").result;
    const backgroundChoice = this.getStep(generation, "background").result;
    const abilities = this.getStep(generation, "abilities").result;

    const prompt = `Generate starting equipment for this character:

Class: ${JSON.stringify(classChoice, null, 2)}
Background: ${JSON.stringify(backgroundChoice, null, 2)}
Abilities: ${JSON.stringify(abilities, null, 2)}

Consider:
1. Class starting equipment options
2. Background equipment
3. Ability score optimizations (e.g., finesse weapons for high DEX)
4. Character concept alignment
5. Practical adventuring gear

Provide:
1. Weapons (with attack bonuses and damage)
2. Armor (with AC calculation)
3. Tools and equipment from background
4. Adventuring gear essentials
5. Starting currency
6. Equipment alternatives based on concept

Format as JSON with detailed equipment list and reasoning.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.8;

    this.updateCurrentStep(generation, "spells");
  }

  private async generateSpellsStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "spells");
    step.status = "processing";

    const classChoice = this.getStep(generation, "class").result;
    const abilities = this.getStep(generation, "abilities").result;

    // Check if character is a spellcaster
    const spellcastingClasses = [
      "wizard",
      "sorcerer",
      "warlock",
      "cleric",
      "druid",
      "bard",
      "paladin",
      "ranger",
      "artificer",
    ];
    const isSpellcaster = spellcastingClasses.some((cls) =>
      classChoice.selectedClass?.toLowerCase().includes(cls),
    );

    if (!isSpellcaster) {
      step.result = { spells: [], cantrips: [], message: "Non-spellcasting class" };
      step.status = "completed";
      step.confidence = 1.0;
      this.updateCurrentStep(generation, "personality");
      return;
    }

    const prompt = `Generate optimal starting spells for this spellcaster:

Class: ${JSON.stringify(classChoice, null, 2)}
Abilities: ${JSON.stringify(abilities, null, 2)}

Consider:
1. Spellcasting ability modifier
2. Spells known vs prepared mechanics
3. Cantrip selections
4. Level 1 spell choices  
5. Concept alignment
6. Utility vs combat balance
7. Ritual spells if applicable

Provide:
1. Cantrips known (list with reasoning)
2. 1st level spells (known/prepared with reasoning)
3. Spell attack bonus calculation
4. Spell save DC calculation
5. Spell slots available
6. Spellcasting focus/component pouch

Format as JSON with complete spell list and mechanics.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.85;

    this.updateCurrentStep(generation, "personality");
  }

  private async generatePersonalityStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "personality");
    step.status = "processing";

    const conceptAnalysis = this.getStep(generation, "concept").result;
    const backgroundChoice = this.getStep(generation, "background").result;

    const prompt = `Generate rich personality details for this character:

Original Concept: "${generation.concept.prompt}"
Concept Analysis: ${JSON.stringify(conceptAnalysis, null, 2)}
Background: ${JSON.stringify(backgroundChoice, null, 2)}

Create:
1. Personality Traits (2 distinct traits)
2. Ideals (1 core driving principle)
3. Bonds (1 important connection)
4. Flaws (1 meaningful weakness)
5. Physical description
6. Mannerisms and speech patterns
7. Backstory hooks for the DM
8. Character motivations
9. Fears and aspirations
10. Relationships and connections

Make it:
- Consistent with the original concept
- Mechanically integrated with background
- Rich and playable
- Memorable and distinct

Format as JSON with detailed explanations.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.7;

    this.updateCurrentStep(generation, "optimization");
  }

  private async optimizeCharacterStep(generation: CharacterGeneration): Promise<void> {
    const step = this.getStep(generation, "optimization");
    step.status = "processing";

    // Gather all previous results
    const allResults = {
      concept: this.getStep(generation, "concept").result,
      race: this.getStep(generation, "race").result,
      class: this.getStep(generation, "class").result,
      background: this.getStep(generation, "background").result,
      abilities: this.getStep(generation, "abilities").result,
      equipment: this.getStep(generation, "equipment").result,
      spells: this.getStep(generation, "spells").result,
      personality: this.getStep(generation, "personality").result,
    };

    const prompt = `Optimize and validate this complete character build:

Character Build: ${JSON.stringify(allResults, null, 2)}

Perform:
1. Rules validation (check for errors)
2. Mechanical optimization suggestions
3. Synergy analysis between race/class/background
4. Missing elements identification
5. Alternative choices recommendations
6. Power level assessment
7. Roleplay integration check
8. Future advancement suggestions (levels 2-5)

Provide:
1. Validation results (any rule violations)
2. Optimization score (1-10)
3. Specific improvements
4. Alternative builds
5. Advancement path recommendations
6. Character sheet summary
7. Final assessment

Format as JSON with detailed analysis.`;

    const result = await this.callAI(prompt, generation);

    step.result = result;
    step.status = "completed";
    step.confidence = 0.95;

    // Mark generation as ready for final character creation
    generation.currentStep = "completed";
  }

  private async createFinalCharacter(
    generation: CharacterGeneration,
    userId: string,
  ): Promise<any> {
    // Extract all the generated data
    const raceResult = this.getStep(generation, "race").result;
    const classResult = this.getStep(generation, "class").result;
    const backgroundResult = this.getStep(generation, "background").result;
    const abilitiesResult = this.getStep(generation, "abilities").result;
    const _equipmentResult = this.getStep(generation, "equipment").result;
    const _spellsResult = this.getStep(generation, "spells").result;
    const personalityResult = this.getStep(generation, "personality").result;

    // Create character using existing CharacterService
    const characterRequest = {
      name: personalityResult.name || this.generateCharacterName(),
      race: raceResult.selectedRace,
      class: classResult.selectedClass,
      background: backgroundResult.selectedBackground,
      level: classResult.startingLevel || 1,
      abilities: abilitiesResult.finalScores,
      // Add other fields as needed
    };

    const character = await this.characterService.createCharacter(userId, characterRequest);

    // Log generation job
    await this.logGenerationJob(generation, character);

    return character;
  }

  private async callAI(prompt: string, generation: CharacterGeneration): Promise<any> {
    const startTime = Date.now();

    try {
      // Try Anthropic first, fallback to OpenAI
      let result;
      let provider;

      if (this.anthropicProvider) {
        provider = "anthropic";
        const response = await this.anthropicProvider.generateGameContent("character", {
          additionalContext: prompt,
        });
        result = response.content;
        generation.metadata.totalCostUSD += response.costUSD;
      } else if (this.openaiProvider) {
        provider = "openai";
        const response = await this.openaiProvider.generateText(prompt, {
          model: "gpt-4",
          temperature: 0.7,
          maxTokens: 2000,
        });
        result = JSON.parse(response.text);
        generation.metadata.totalCostUSD += response.costUSD;
      } else {
        throw new Error("No AI provider available");
      }

      const latency = Date.now() - startTime;
      generation.metadata.totalLatencyMs += latency;
      generation.metadata.provider = provider;

      return result;
    } catch (error: any) {
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  private async logGenerationJob(generation: CharacterGeneration, character: any): Promise<void> {
    await this.prisma.generationJob.create({
      data: {
        type: "CHARACTER_GENERATION",
        status: "SUCCEEDED",
        input: generation.concept as any,
        output: character as any,
      },
    });
  }

  private getStep(generation: CharacterGeneration, stepName: string): GenerationStep {
    const step = generation.steps.find((s) => s.step === stepName);
    if (!step) throw new Error(`Step not found: ${stepName}`);
    return step;
  }

  private updateCurrentStep(generation: CharacterGeneration, nextStep: string): void {
    generation.currentStep = nextStep;
  }

  private generateId(): string {
    return `gen_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCharacterName(): string {
    const names = [
      "Aelindra",
      "Thorin",
      "Zara",
      "Gareth",
      "Luna",
      "Kael",
      "Rina",
      "Daven",
      "Lyra",
      "Magnus",
      "Vera",
      "Finn",
      "Nyx",
      "Orion",
      "Sage",
      "Raven",
    ];
    return names[Math.floor(Math.random() * names.length)];
  }

  // Public methods for external access
  async retryStep(generationId: string, stepName: string): Promise<void> {
    const generation = this.activeGenerations.get(generationId);
    if (!generation) throw new Error("Generation not found");

    const step = this.getStep(generation, stepName);
    step.status = "processing";
    step.error = undefined;

    // Re-run the specific step
    switch (stepName) {
      case "concept":
        await this.analyzeConceptStep(generation);
        break;
      case "race":
        await this.determineRaceStep(generation);
        break;
      case "class":
        await this.determineClassStep(generation);
        break;
      // Add other cases as needed
    }
  }

  async getGenerationHistory(_userId: string): Promise<CharacterGeneration[]> {
    // In a real implementation, this would query the database
    // For now, return active generations
    return Array.from(this.activeGenerations.values());
  }
}
