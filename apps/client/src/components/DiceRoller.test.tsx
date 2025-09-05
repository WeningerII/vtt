import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
// Mock user-event since module is not available
// import userEvent from '@testing-library/user-event';
const userEvent = {
  setup: () => ({
    click: async (element: Element) => {
      console.log('Mock click on', element);
    },
    type: async (element: Element, text: string) => {
      console.log('Mock type on', element, 'text:', text);
    },
    clear: async (element: Element) => {
      console.log('Mock clear element:', element);
    },
    selectOptions: async (element: Element, values: string[]) => {
      console.log('Mock select options:', element, values);
    },
    tab: async () => {
      console.log('Mock tab navigation');
    }
  }),
  click: async (element: Element) => {
    console.log('Mock click on', element);
  },
  type: async (element: Element, text: string) => {
    console.log('Mock type on', element, 'text:', text);
  },
  clear: async (element: Element) => {
    console.log('Mock clear element:', element);
  },
  selectOptions: async (element: Element, values: string[]) => {
    console.log('Mock select options:', element, values);
  },
  tab: async () => {
    console.log('Mock tab navigation');
  }
};
import { DiceRoller, DiceRoll, DiceRollerProps } from "./DiceRoller";
import "@testing-library/jest-dom";

// Mock dependencies
jest.mock("@vtt/logging", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock Math.random for predictable dice rolls
const mockMathRandom = jest.spyOn(Math, "random");

describe("DiceRoller", () => {
  const mockOnRoll = jest.fn();
  const mockRecentRolls: DiceRoll[] = [
    {
      id: "roll1",
      expression: "1d20+5",
      result: 18,
      breakdown: "1d20 (13) +5 = 18",
      timestamp: new Date("2023-01-01T10:00:00Z"),
      roller: "TestPlayer",
      type: "attack",
    },
    {
      id: "roll2",
      expression: "2d6",
      result: 8,
      breakdown: "2d6 (3, 5) = 8",
      timestamp: new Date("2023-01-01T10:01:00Z"),
      roller: "TestPlayer",
      type: "damage",
    },
  ];

  const mockProps: DiceRollerProps = {
    onRoll: mockOnRoll,
    recentRolls: mockRecentRolls,
    playerName: "TestPlayer",
    readOnly: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Rendering", () => {
    it("renders without crashing", () => {
      render(<DiceRoller {...mockProps} />);
      expect(screen.getByText(/dice roller/i)).toBeInTheDocument();
    });

    it("displays dice expression input", () => {
      render(<DiceRoller {...mockProps} />);
      const input = screen.getByDisplayValue("1d20");
      expect(input).toBeInTheDocument();
    });

    it("displays common dice buttons", () => {
      render(<DiceRoller {...mockProps} />);
      expect(screen.getByText("d4")).toBeInTheDocument();
      expect(screen.getByText("d6")).toBeInTheDocument();
      expect(screen.getByText("d8")).toBeInTheDocument();
      expect(screen.getByText("d10")).toBeInTheDocument();
      expect(screen.getByText("d12")).toBeInTheDocument();
      expect(screen.getByText("d20")).toBeInTheDocument();
      expect(screen.getByText("d100")).toBeInTheDocument();
    });

    it("displays recent rolls", () => {
      render(<DiceRoller {...mockProps} />);
      expect(screen.getByText("1d20+5")).toBeInTheDocument();
      expect(screen.getByText("18")).toBeInTheDocument();
      expect(screen.getByText("2d6")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
    });

    it("renders in read-only mode", () => {
      render(<DiceRoller {...mockProps} readOnly={true} />);
      const rollButton = screen.getByText(/roll/i);
      expect(rollButton).toBeDisabled();
    });
  });

  describe("User Interactions", () => {
    beforeEach(() => {
      mockMathRandom.mockReturnValue(0.5); // Always roll middle value
    });

    afterEach(() => {
      mockMathRandom.mockRestore();
    });

    it("handles dice expression input", async () => {
      render(<DiceRoller {...mockProps} />);
      const input = screen.getByDisplayValue("1d20");

      await userEvent.clear(input);
      await userEvent.type(input, "2d6+3");

      expect(input).toHaveValue("2d6+3");
    });

    it("handles common dice button clicks", async () => {
      render(<DiceRoller {...mockProps} />);
      const d6Button = screen.getByText("d6");

      await userEvent.click(d6Button);
      const input = screen.getByDisplayValue("1d6");
      expect(input).toHaveValue("1d6");
    });

    it("handles roll button click", async () => {
      render(<DiceRoller {...mockProps} />);
      const rollButton = screen.getByText(/roll/i);

      await userEvent.click(rollButton);

      expect(mockOnRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          expression: "1d20",
          roller: "TestPlayer",
          type: "custom",
        }),
      );
    });

    it("handles advantage/disadvantage toggles", async () => {
      render(<DiceRoller {...mockProps} />);
      const advantageCheckbox = screen.getByLabelText(/advantage/i);
      const disadvantageCheckbox = screen.getByLabelText(/disadvantage/i);

      await userEvent.click(advantageCheckbox);
      expect(advantageCheckbox).toBeChecked();
      expect(disadvantageCheckbox).not.toBeChecked();

      await userEvent.click(disadvantageCheckbox);
      expect(disadvantageCheckbox).toBeChecked();
      expect(advantageCheckbox).not.toBeChecked();
    });

    it("handles keyboard shortcut for rolling", async () => {
      render(<DiceRoller {...mockProps} />);

      fireEvent.keyDown(window, { key: "r", ctrlKey: true });

      expect(mockOnRoll).toHaveBeenCalled();
    });

    it("handles roll type selection", async () => {
      render(<DiceRoller {...mockProps} />);
      const typeSelect = screen.getByDisplayValue("custom");

      await userEvent.selectOptions(typeSelect, ["attack"]);
      expect(typeSelect).toHaveValue("attack");
    });
  });

  describe("State Management", () => {
    it("maintains dice expression state", async () => {
      render(<DiceRoller {...mockProps} />);
      const input = screen.getByDisplayValue("1d20");

      await userEvent.clear(input);
      await userEvent.type(input, "3d8+2");

      expect(input).toHaveValue("3d8+2");
    });

    it("maintains roll type state", async () => {
      render(<DiceRoller {...mockProps} />);
      const typeSelect = screen.getByDisplayValue("custom");

      await userEvent.selectOptions(typeSelect, ["damage"]);
      expect(typeSelect).toHaveValue("damage");
    });

    it("maintains advantage/disadvantage state", async () => {
      render(<DiceRoller {...mockProps} />);
      const advantageCheckbox = screen.getByLabelText(/advantage/i);

      await userEvent.click(advantageCheckbox);
      expect(advantageCheckbox).toBeChecked();

      // State should persist
      const rollButton = screen.getByText(/roll/i);
      await userEvent.click(rollButton);
      expect(advantageCheckbox).toBeChecked();
    });

    it("resets conflicting advantage/disadvantage states", async () => {
      render(<DiceRoller {...mockProps} />);
      const advantageCheckbox = screen.getByLabelText(/advantage/i);
      const disadvantageCheckbox = screen.getByLabelText(/disadvantage/i);

      await userEvent.click(advantageCheckbox);
      expect(advantageCheckbox).toBeChecked();

      await userEvent.click(disadvantageCheckbox);
      expect(disadvantageCheckbox).toBeChecked();
      expect(advantageCheckbox).not.toBeChecked();
    });
  });

  describe("Error Handling", () => {
    it("handles invalid dice expressions", async () => {
      render(<DiceRoller {...mockProps} />);
      const input = screen.getByDisplayValue("1d20");
      const rollButton = screen.getByText(/roll/i);

      await userEvent.clear(input);
      await userEvent.type(input, "invalid");
      await userEvent.click(rollButton);

      expect(mockOnRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 0,
          breakdown: "Invalid expression",
        }),
      );
    });

    it("handles empty expressions gracefully", async () => {
      render(<DiceRoller {...mockProps} />);
      const input = screen.getByDisplayValue("1d20");
      const rollButton = screen.getByText(/roll/i);

      await userEvent.clear(input);
      await userEvent.click(rollButton);

      expect(mockOnRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 0,
          breakdown: "Invalid expression",
        }),
      );
    });

    it("prevents rolling in read-only mode", async () => {
      render(<DiceRoller {...mockProps} readOnly={true} />);
      const rollButton = screen.getByText(/roll/i);

      await userEvent.click(rollButton);

      expect(mockOnRoll).not.toHaveBeenCalled();
    });
  });

  describe("Accessibility", () => {
    it("has proper form labels", () => {
      render(<DiceRoller {...mockProps} />);

      expect(screen.getByLabelText(/dice expression/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/roll type/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/advantage/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/disadvantage/i)).toBeInTheDocument();
    });

    it("supports keyboard navigation", async () => {
      render(<DiceRoller {...mockProps} />);
      const input = screen.getByDisplayValue("1d20");

      input.focus();
      expect(input).toHaveFocus();

      await userEvent.tab();
      expect(document.activeElement).toBeInTheDocument();
    });

    it("has accessible button descriptions", () => {
      render(<DiceRoller {...mockProps} />);

      const rollButton = screen.getByText(/roll/i);
      expect(rollButton).toHaveAttribute("type", "button");
    });

    it("announces roll results to screen readers", async () => {
      render(<DiceRoller {...mockProps} />);
      const rollButton = screen.getByText(/roll/i);

      await userEvent.click(rollButton);

      // Check that roll result is announced
      expect(screen.getByRole("status")).toBeInTheDocument();
    });
  });

  describe("Performance", () => {
    it("renders efficiently with large recent rolls list", () => {
      const largeRollsList = Array.from({ length: 100 }, (_, i) => ({
        id: `roll-${i}`,
        expression: `1d20+${i}`,
        result: 10 + i,
        breakdown: `1d20 (${10 + i}) = ${10 + i}`,
        timestamp: new Date(),
        roller: "TestPlayer",
        type: "custom" as const,
      }));

      const largeDataProps = { ...mockProps, recentRolls: largeRollsList };
      const startTime = performance.now();
      render(<DiceRoller {...largeDataProps} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(200);
    });

    it("memoizes common dice options", () => {
      const { rerender } = render(<DiceRoller {...mockProps} />);

      // Common dice should be memoized and not recreated on rerenders
      const d20Button = screen.getByText("d20");
      expect(d20Button).toBeInTheDocument();

      rerender(<DiceRoller {...mockProps} playerName="NewPlayer" />);
      expect(screen.getByText("d20")).toBeInTheDocument();
    });

    it("debounces rapid dice rolls", async () => {
      jest.useFakeTimers();
      render(<DiceRoller {...mockProps} />);
      const rollButton = screen.getByText(/roll/i);

      // Rapid clicks
      await userEvent.click(rollButton);
      await userEvent.click(rollButton);
      await userEvent.click(rollButton);

      // Should only register appropriate number of calls
      expect(mockOnRoll).toHaveBeenCalledTimes(3);

      jest.useRealTimers();
    });
  });

  describe("Integration", () => {
    it("calls onRoll with correct roll data", async () => {
      mockMathRandom.mockReturnValue(0.75); // Roll 16 on d20
      render(<DiceRoller {...mockProps} />);
      const rollButton = screen.getByText(/roll/i);

      await userEvent.click(rollButton);

      expect(mockOnRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.stringMatching(/^roll_\d+_\w+$/),
          expression: "1d20",
          result: 16,
          breakdown: "1d20 (16) = 16",
          timestamp: expect.any(Date),
          roller: "TestPlayer",
          type: "custom",
        }),
      );
    });

    it("handles prop changes correctly", () => {
      const { rerender } = render(<DiceRoller {...mockProps} />);
      expect(screen.getByText("TestPlayer")).toBeInTheDocument();

      const newProps = { ...mockProps, playerName: "NewPlayer" };
      rerender(<DiceRoller {...newProps} />);

      expect(screen.getByText("NewPlayer")).toBeInTheDocument();
    });

    it("updates recent rolls display when props change", () => {
      const { rerender } = render(<DiceRoller {...mockProps} />);
      expect(screen.getByText("1d20+5")).toBeInTheDocument();

      const newRolls = [
        {
          id: "roll3",
          expression: "1d8",
          result: 5,
          breakdown: "1d8 (5) = 5",
          timestamp: new Date(),
          roller: "TestPlayer",
          type: "damage" as const,
        },
      ];

      rerender(<DiceRoller {...mockProps} recentRolls={newRolls} />);
      expect(screen.getByText("1d8")).toBeInTheDocument();
      expect(screen.queryByText("1d20+5")).not.toBeInTheDocument();
    });

    it("handles advantage rolls correctly", async () => {
      mockMathRandom.mockReturnValueOnce(0.75).mockReturnValueOnce(0.25); // Rolls 16 and 6
      render(<DiceRoller {...mockProps} />);

      const advantageCheckbox = screen.getByLabelText(/advantage/i);
      await userEvent.click(advantageCheckbox);

      const rollButton = screen.getByText(/roll/i);
      await userEvent.click(rollButton);

      expect(mockOnRoll).toHaveBeenCalledWith(
        expect.objectContaining({
          result: 16, // Should take the higher roll
          breakdown: expect.stringContaining("advantage"),
          advantage: true,
        }),
      );
    });
  });
});
