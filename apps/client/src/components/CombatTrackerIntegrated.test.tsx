import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import { CombatTrackerIntegrated } from "./CombatTrackerIntegrated";


// Mock the useEncounter hook
jest.mock('../hooks/useEncounter', () => ({
  useEncounter: jest.fn(() => ({
    encounter: null,
    loading: false,
    error: null,
    updateEncounter: jest.fn(),
    deleteEncounter: jest.fn()
  }))
}));

const { useEncounter } = require('../hooks/useEncounter');
// Mock dependencies
jest.mock("@vtt/logging", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock("../hooks/useEncounter", () => ({
  useEncounter: () => ({
    encounter: mockEncounter,
    isLoading: false,
    error: null,
    createEncounter: mockCreateEncounter,
    getEncounter: mockGetEncounter,
    startEncounter: mockStartEncounter,
    endEncounter: mockEndEncounter,
    addCharacterToEncounter: mockAddCharacter,
    addMonsterToEncounter: mockAddMonster,
    updateActorHealth: mockUpdateHealth,
  }),
}));

jest.mock("../hooks/useCharacter", () => ({
  useCharacter: () => ({
    characters: mockCharacters,
  }),
}));

// Mock data
const mockEncounter = {
  id: "encounter-1",
  campaignId: "campaign-1",
  name: "Test Encounter",
  status: "active" as const,
  currentTurn: 0,
  round: 1,
  actors: [
    {
      id: "actor-1",
      type: "character" as const,
      characterId: "char-1",
      name: "Aragorn",
      initiative: 18,
      hitPoints: { current: 75, max: 100 },
      armorClass: 16,
      conditions: [],
      isActive: true,
    },
    {
      id: "actor-2",
      type: "monster" as const,
      monsterId: "goblin",
      name: "Goblin #1",
      initiative: 12,
      hitPoints: { current: 7, max: 7 },
      armorClass: 15,
      conditions: ["poisoned"],
      isActive: false,
    },
  ],
};

const mockCharacters = [
  {
    id: "char-1",
    name: "Aragorn",
    class: "Ranger",
    level: 10,
  },
  {
    id: "char-2",
    name: "Legolas",
    class: "Ranger",
    level: 10,
  },
];

// Mock functions
const mockCreateEncounter = jest.fn();
const mockGetEncounter = jest.fn();
const mockStartEncounter = jest.fn();
const mockEndEncounter = jest.fn();
const mockAddCharacter = jest.fn();
const mockAddMonster = jest.fn();
const mockUpdateHealth = jest.fn();
const mockOnEncounterChange = jest.fn();

describe("CombatTrackerIntegrated", () => {
  const defaultProps = {
    campaignId: "campaign-1",
    encounterId: "encounter-1",
    onEncounterChange: mockOnEncounterChange,
    readOnly: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("Test Encounter")).toBeInTheDocument();
    });

    it("displays encounter information", () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      expect(screen.getByText("Test Encounter")).toBeInTheDocument();
      expect(screen.getByText("Round 1")).toBeInTheDocument();
      expect(screen.getByText("Turn: Aragorn")).toBeInTheDocument();
    });

    it("displays combat actors", () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      expect(screen.getByText("Aragorn")).toBeInTheDocument();
      expect(screen.getByText("75/100 HP")).toBeInTheDocument();
      expect(screen.getByText("AC 16")).toBeInTheDocument();
      expect(screen.getByText("Initiative: 18")).toBeInTheDocument();

      expect(screen.getByText("Goblin #1")).toBeInTheDocument();
      expect(screen.getByText("7/7 HP")).toBeInTheDocument();
      expect(screen.getByText("AC 15")).toBeInTheDocument();
      expect(screen.getByText("Initiative: 12")).toBeInTheDocument();
    });

    it("displays conditions on actors", () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      expect(screen.getByText("poisoned")).toBeInTheDocument();
    });

    it("highlights active actor", () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const activeActor = screen.getByText("Aragorn").closest(".combat-actor");
      expect(activeActor).toHaveClass("active");
    });

    it("renders in read-only mode", () => {
      render(<CombatTrackerIntegrated {...defaultProps} readOnly={true} />);

      const buttons = screen.queryAllByRole("button");
      buttons.forEach((button) => {
        expect(button).toBeDisabled();
      });
    });

    it("displays loading state", () => {
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: null,
        isLoading: true,
        error: null,
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      render(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("Loading encounter...")).toBeInTheDocument();
    });

    it("displays error state", () => {
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: null,
        isLoading: false,
        error: "Failed to load encounter",
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      render(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("Error: Failed to load encounter")).toBeInTheDocument();
    });
  });

  describe("User Interactions", () => {
    it("handles next turn button click", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const nextTurnButton = screen.getByText("Next Turn");
      await userEvent.click(nextTurnButton);

      // Should advance to next actor or round
      expect(mockStartEncounter).toHaveBeenCalled();
    });

    it("handles previous turn button click", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const prevTurnButton = screen.getByText("Previous Turn");
      await userEvent.click(prevTurnButton);

      expect(mockStartEncounter).toHaveBeenCalled();
    });

    it("handles start encounter button click", async () => {
      const inactiveEncounter = { ...mockEncounter, status: "inactive" as const };
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: inactiveEncounter,
        isLoading: false,
        error: null,
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      render(<CombatTrackerIntegrated {...defaultProps} />);

      const startButton = screen.getByText("Start Encounter");
      await userEvent.click(startButton);

      expect(mockStartEncounter).toHaveBeenCalledWith("encounter-1");
    });

    it("handles end encounter button click", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const endButton = screen.getByText("End Encounter");
      await userEvent.click(endButton);

      expect(mockEndEncounter).toHaveBeenCalledWith("encounter-1");
    });

    it("handles add combatant button click", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const addButton = screen.getByText("Add Combatant");
      await userEvent.click(addButton);

      expect(screen.getByText("Add Combatant")).toBeInTheDocument();
      expect(screen.getByText("Character")).toBeInTheDocument();
      expect(screen.getByText("Monster")).toBeInTheDocument();
    });

    it("handles health modification", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const healthInput = screen.getByDisplayValue("75");
      await userEvent.clear(healthInput);
      await userEvent.type(healthInput, "60");
      await userEvent.tab(); // Trigger blur to save

      expect(mockUpdateHealth).toHaveBeenCalledWith("actor-1", 60);
    });

    it("handles initiative modification", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const initiativeInput = screen.getByDisplayValue("18");
      await userEvent.clear(initiativeInput);
      await userEvent.type(initiativeInput, "20");
      await userEvent.tab();

      // Should trigger actor update
      expect(mockUpdateHealth).toHaveBeenCalled();
    });

    it("handles condition addition", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const addConditionButton = screen.getByLabelText("Add condition to Aragorn");
      await userEvent.click(addConditionButton);

      const conditionSelect = screen.getByRole("combobox");
      await userEvent.selectOptions(conditionSelect, "stunned");

      const confirmButton = screen.getByText("Add");
      await userEvent.click(confirmButton);

      expect(mockUpdateHealth).toHaveBeenCalled();
    });

    it("handles condition removal", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const removeConditionButton = screen.getByLabelText("Remove poisoned from Goblin #1");
      await userEvent.click(removeConditionButton);

      expect(mockUpdateHealth).toHaveBeenCalled();
    });

    it("handles keyboard shortcuts", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      // Space for next turn
      fireEvent.keyDown(document, { key: " " });
      expect(mockStartEncounter).toHaveBeenCalled();

      // Escape to close dialogs
      fireEvent.keyDown(document, { key: "Escape" });

      // Arrow keys for navigation
      fireEvent.keyDown(document, { key: "ArrowDown" });
      fireEvent.keyDown(document, { key: "ArrowUp" });
    });
  });

  describe("State Management", () => {
    it("maintains encounter state", async () => {
      const { rerender } = render(<CombatTrackerIntegrated {...defaultProps} />);

      expect(screen.getByText("Round 1")).toBeInTheDocument();

      const updatedEncounter = { ...mockEncounter, round: 2 };
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: updatedEncounter,
        isLoading: false,
        error: null,
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      rerender(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("Round 2")).toBeInTheDocument();
    });

    it("handles encounter prop changes", () => {
      const { rerender } = render(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("Test Encounter")).toBeInTheDocument();

      rerender(<CombatTrackerIntegrated {...defaultProps} encounterId="encounter-2" />);
      expect(mockGetEncounter).toHaveBeenCalledWith("encounter-2");
    });

    it("calls onEncounterChange when encounter updates", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const nextTurnButton = screen.getByText("Next Turn");
      await userEvent.click(nextTurnButton);

      expect(mockOnEncounterChange).toHaveBeenCalledWith(mockEncounter);
    });
  });

  describe("Error Handling", () => {
    it("handles API errors gracefully", () => {
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: null,
        isLoading: false,
        error: "Network error",
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      render(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("Error: Network error")).toBeInTheDocument();
    });

    it("handles missing encounter gracefully", () => {
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: null,
        isLoading: false,
        error: null,
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      render(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("No encounter found")).toBeInTheDocument();
    });

    it("validates health input", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const healthInput = screen.getByDisplayValue("75");
      await userEvent.clear(healthInput);
      await userEvent.type(healthInput, "-10");
      await userEvent.tab();

      expect(screen.getByText("Health cannot be negative")).toBeInTheDocument();
      expect(mockUpdateHealth).not.toHaveBeenCalled();
    });

    it("validates initiative input", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const initiativeInput = screen.getByDisplayValue("18");
      await userEvent.clear(initiativeInput);
      await userEvent.type(initiativeInput, "invalid");
      await userEvent.tab();

      expect(screen.getByText("Initiative must be a number")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA labels", () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      expect(screen.getByRole("region", { name: /combat tracker/i })).toBeInTheDocument();
      expect(screen.getByRole("list", { name: /combat actors/i })).toBeInTheDocument();

      const healthInputs = screen.getAllByLabelText(/health/i);
      expect(healthInputs.length).toBeGreaterThan(0);
    });

    it("supports keyboard navigation", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const firstButton = screen.getAllByRole("button")[0];
      firstButton.focus();
      expect(firstButton).toHaveFocus();

      await userEvent.tab();
      expect(document.activeElement).toBeInTheDocument();
    });

    it("announces turn changes to screen readers", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const nextTurnButton = screen.getByText("Next Turn");
      await userEvent.click(nextTurnButton);

      expect(screen.getByRole("status")).toHaveTextContent(/turn changed/i);
    });

    it("has proper focus management for dialogs", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const addButton = screen.getByText("Add Combatant");
      await userEvent.click(addButton);

      const dialog = screen.getByRole("dialog");
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveFocus();
    });
  });

  describe("Performance", () => {
    it("renders efficiently with large actor lists", () => {
      const largeActorList = Array.from({ length: 50 }, (_, i) => ({
        id: `actor-${i}`,
        type: "monster" as const,
        monsterId: "goblin",
        name: `Goblin #${i}`,
        initiative: 10 + i,
        hitPoints: { current: 7, max: 7 },
        armorClass: 15,
        conditions: [],
        isActive: false,
      }));

      const largeEncounter = { ...mockEncounter, actors: largeActorList };
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: largeEncounter,
        isLoading: false,
        error: null,
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      const startTime = performance.now();
      render(<CombatTrackerIntegrated {...defaultProps} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(300);
    });

    it("memoizes actor components", () => {
      const { rerender } = render(<CombatTrackerIntegrated {...defaultProps} />);

      const actorElement = screen.getByText("Aragorn");
      expect(actorElement).toBeInTheDocument();

      // Rerender with same props should not recreate components
      rerender(<CombatTrackerIntegrated {...defaultProps} />);
      expect(screen.getByText("Aragorn")).toBeInTheDocument();
    });

    it("debounces health updates", async () => {
      jest.useFakeTimers();
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const healthInput = screen.getByDisplayValue("75");

      await userEvent.clear(healthInput);
      await userEvent.type(healthInput, "70");
      await userEvent.type(healthInput, "65");
      await userEvent.type(healthInput, "60");

      // Should debounce multiple rapid changes
      expect(mockUpdateHealth).not.toHaveBeenCalled();

      jest.runAllTimers();
      expect(mockUpdateHealth).toHaveBeenCalledTimes(1);

      jest.useRealTimers();
    });
  });

  describe("Integration", () => {
    it("integrates with useEncounter hook", () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      expect(mockGetEncounter).toHaveBeenCalledWith("encounter-1");
    });

    it("integrates with useCharacter hook for adding characters", async () => {
      render(<CombatTrackerIntegrated {...defaultProps} />);

      const addButton = screen.getByText("Add Combatant");
      await userEvent.click(addButton);

      const characterTab = screen.getByText("Character");
      await userEvent.click(characterTab);

      expect(screen.getByText("Aragorn")).toBeInTheDocument();
      expect(screen.getByText("Legolas")).toBeInTheDocument();
    });

    it("handles encounter creation when none exists", async () => {
      jest.mocked(useEncounter).mockReturnValueOnce({
        encounter: null,
        isLoading: false,
        error: null,
        createEncounter: mockCreateEncounter,
        getEncounter: mockGetEncounter,
        startEncounter: mockStartEncounter,
        endEncounter: mockEndEncounter,
        addCharacterToEncounter: mockAddCharacter,
        addMonsterToEncounter: mockAddMonster,
        updateActorHealth: mockUpdateHealth,
      });

      render(<CombatTrackerIntegrated {...defaultProps} encounterId={undefined} />);

      const createButton = screen.getByText("Create New Encounter");
      await userEvent.click(createButton);

      expect(mockCreateEncounter).toHaveBeenCalledWith("campaign-1");
    });
  });
});
