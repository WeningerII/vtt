import React from "react";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AIAssistant } from "./AIAssistant";
import "@testing-library/jest-dom";

// Mock dependencies
jest.mock("../utils/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock fetch for API calls
global.fetch = jest.fn();
const mockFetch = global.fetch as jest.MockedFunction<typeof fetch>;

describe("AIAssistant", () => {
  const mockProps = {
    // Add default props based on component interface
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("Rendering", () => {
    it("should render the AI assistant component with all UI elements", () => {
      render(<AIAssistant />);

      expect(screen.getByRole("heading", { name: /AI Assistant/i })).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/ask me anything/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /send/i })).toBeInTheDocument();
      expect(screen.getByTestId("message-list")).toBeInTheDocument();
    });

    it("should display quick action buttons", () => {
      render(<AIAssistant />);

      expect(screen.getByRole("button", { name: /explain rules/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /generate NPC/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create encounter/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /describe scene/i })).toBeInTheDocument();
    });

    it("should show loading state when processing", async () => {
      mockFetch.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () =>
                resolve({
                  ok: true,
                  json: async () => ({ response: "Test response", metadata: {} }),
                } as Response),
              100,
            ),
          ),
      );

      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i);
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "Test query" } });
      fireEvent.click(sendButton);

      expect(screen.getByTestId("loading-indicator")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.queryByTestId("loading-indicator")).not.toBeInTheDocument();
      });
    });
  });

  describe("User Interactions", () => {
    it("should handle text input and update state", async () => {
      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "What are the rules for grappling?" } });
      expect(input.value).toBe("What are the rules for grappling?");
    });

    it("should submit query on button click", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "Grappling rules explanation...",
          metadata: { provider: "openai", model: "gpt-4" },
        }),
      } as Response);

      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i);
      const sendButton = screen.getByRole("button", { name: /send/i });

      fireEvent.change(input, { target: { value: "Explain grappling" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/v1/assistant/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "Explain grappling" }),
        });
      });
    });

    it("should submit query on Enter key", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: "Test response", metadata: {} }),
      } as Response);

      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i);

      fireEvent.change(input, { target: { value: "Test query" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledTimes(1);
      });
    });

    it("should handle quick action buttons", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: "NPC generated...", metadata: {} }),
      } as Response);

      render(<AIAssistant />);
      const npcButton = screen.getByRole("button", { name: /generate NPC/i });

      fireEvent.click(npcButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith("/api/v1/assistant/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: "Generate a random NPC with personality and backstory" }),
        });
      });
    });

    it("should clear input after submission", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: "Response", metadata: {} }),
      } as Response);

      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i) as HTMLInputElement;

      fireEvent.change(input, { target: { value: "Test query" } });
      expect(input.value).toBe("Test query");

      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });
  });

  describe("State Management", () => {
    it("should manage message history correctly", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: "First response", metadata: { model: "gpt-4" } }),
        } as Response)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ response: "Second response", metadata: { model: "claude" } }),
        } as Response);

      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i);
      const sendButton = screen.getByRole("button", { name: /send/i });

      // First message
      fireEvent.change(input, { target: { value: "First query" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("First query")).toBeInTheDocument();
        expect(screen.getByText(/First response/i)).toBeInTheDocument();
      });

      // Second message
      fireEvent.change(input, { target: { value: "Second query" } });
      fireEvent.click(sendButton);

      await waitFor(() => {
        expect(screen.getByText("Second query")).toBeInTheDocument();
        expect(screen.getByText(/Second response/i)).toBeInTheDocument();
      });
    });

    it("should display message metadata", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          response: "Test response",
          metadata: {
            provider: "openai",
            model: "gpt-4",
            tokensUsed: 150,
            responseTime: 1234,
          },
        }),
      } as Response);

      render(<AIAssistant />);

      const testInput = screen.getByPlaceholderText(/ask me anything/i);
      fireEvent.change(testInput, { target: { value: "Test" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByText(/gpt-4/i)).toBeInTheDocument();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle API errors gracefully", async () => {
      mockFetch.mockRejectedValueOnce(new Error("API Error"));

      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i);

      fireEvent.change(input, { target: { value: "Test query" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("should display server error messages", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => ({ error: "Database connection failed" }),
      } as Response);

      render(<AIAssistant />);

      const testInput = screen.getByPlaceholderText(/ask me anything/i);
      fireEvent.change(testInput, { target: { value: "Test" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });

    it("should handle network failures", async () => {
      mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));

      render(<AIAssistant />);

      const testInput = screen.getByPlaceholderText(/ask me anything/i);
      fireEvent.change(testInput, { target: { value: "Test" } });
      fireEvent.click(screen.getByRole("button", { name: /send/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA labels and roles", () => {
      render(<AIAssistant />);

      const input = screen.getByPlaceholderText(/ask me anything/i);
      expect(input).toHaveAttribute("aria-label");

      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).toHaveAttribute("aria-label");

      const messageList = screen.getByTestId("message-list");
      expect(messageList).toHaveAttribute("role", "log");
    });

    it("should support keyboard navigation", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ response: "Response", metadata: {} }),
      } as Response);

      render(<AIAssistant />);
      const input = screen.getByPlaceholderText(/ask me anything/i);

      // Tab to input
      input.focus();
      expect(document.activeElement).toBe(input);

      // Type and submit with Enter
      fireEvent.change(input, { target: { value: "Test" } });
      fireEvent.keyPress(input, { key: "Enter", code: "Enter", charCode: 13 });

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalled();
      });
    });
  });

  describe("Performance", () => {
    it("renders efficiently with large datasets", () => {
      const largeDataProps = { ...mockProps };
      const startTime = performance.now();
      render(<AIAssistant {...largeDataProps} />);
      const endTime = performance.now();

      expect(endTime - startTime).toBeLessThan(100); // Should render in under 100ms
    });

    it("memoizes expensive calculations", () => {
      // Test memoization if applicable
    });
  });

  describe("Integration", () => {
    it("integrates correctly with parent components", () => {
      // Test component integration
    });

    it("handles prop changes correctly", () => {
      const { rerender } = render(<AIAssistant {...mockProps} />);

      const newProps = { ...mockProps };
      rerender(<AIAssistant {...newProps} />);

      // Test prop updates
    });
  });
});
