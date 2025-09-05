import React, { ReactElement } from "react";
import { render, RenderOptions } from "@testing-library/react";
// Mock implementations for missing dependencies
// import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// import { BrowserRouter } from "react-router-dom";

// Mock QueryClient and Provider
class MockQueryClient {
  defaultOptions = {};
  constructor(options?: any) {
    this.defaultOptions = options || {};
  }
  
  getQueryCache() {
    return {
      clear: () => {},
      getAll: () => [],
    };
  }
}

const QueryClientProvider = ({ children, client }: { children: React.ReactNode; client: any }) => {
  return <div data-testid="query-provider">{children}</div>;
};

// Mock BrowserRouter
const BrowserRouter = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="browser-router">{children}</div>;
};
import { setupMSW } from "./msw-setup";

// Setup MSW for all tests
setupMSW();

// Custom render function with providers
interface CustomRenderOptions extends Omit<RenderOptions, "wrapper"> {
  initialEntries?: string[];
  queryClient?: MockQueryClient;
}

const AllTheProviders = ({
  children,
  queryClient = new MockQueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchOnWindowFocus: false
      }
    }
  }),
}: {
  children: React.ReactNode;
  queryClient?: MockQueryClient;
}) => {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

const customRender = (ui: ReactElement, options: CustomRenderOptions = {}): any => {
  const { queryClient, ...renderOptions } = options;

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <AllTheProviders queryClient={queryClient!}>{children}</AllTheProviders>
  );

  return render(ui, { wrapper: Wrapper, ...renderOptions });
};

// Helper to create a fresh MockQueryClient for tests
export const createTestQueryClient = () =>
  new MockQueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0
      },
      mutations: {
        retry: false
      }
    }
  });

// Helper to wait for queries to settle
export const waitForQueries = async (queryClient: MockQueryClient) => {
  // Mock implementation - just resolve immediately since we're using mock queries
  return Promise.resolve();
};

// Mock user context for authenticated tests
export const mockAuthenticatedUser = {
  id: "user-1",
  email: "test@example.com",
  name: "Test User",
  role: "player",
};

// Helper to mock authentication
export const withAuthentication = (user = mockAuthenticatedUser) => {
  return (Component: React.ComponentType<any>) => {
    return (props: any) => (
      <div data-testid="authenticated-wrapper">
        <Component {...props} user={user} />
      </div>
    );
  };
};

// Helper to create mock character data
export const createMockCharacter = (overrides = {}) => ({
  id: "char-1",
  name: "Test Character",
  class: "Fighter",
  level: 5,
  race: "Human",
  background: "Soldier",
  alignment: "Lawful Good",
  experiencePoints: 6500,
  abilities: {
    strength: 16,
    dexterity: 14,
    constitution: 15,
    intelligence: 12,
    wisdom: 13,
    charisma: 10,
  },
  hitPoints: { current: 45, max: 50, temporary: 0 },
  armorClass: 18,
  initiative: 2,
  speed: 30,
  proficiencyBonus: 3,
  savingThrows: {
    strength: { proficient: true, value: 6 },
    dexterity: { proficient: false, value: 2 },
    constitution: { proficient: true, value: 5 },
    intelligence: { proficient: false, value: 1 },
    wisdom: { proficient: false, value: 1 },
    charisma: { proficient: false, value: 0 },
  },
  skills: {
    Athletics: { proficient: true, expertise: false, value: 6 },
    Intimidation: { proficient: true, expertise: false, value: 3 },
  },
  attacks: [],
  spells: {
    spellcastingAbility: null,
    spellSaveDC: 0,
    spellAttackBonus: 0,
    spellSlots: {},
    knownSpells: [],
  },
  equipment: [],
  features: [],
  conditions: [],
  ...overrides,
});

// Helper to create mock encounter data
export const createMockEncounter = (overrides = {}) => ({
  id: "encounter-1",
  name: "Test Encounter",
  campaignId: "campaign-1",
  status: "inactive" as const,
  currentTurn: 0,
  round: 1,
  actors: [],
  ...overrides,
});

// Helper to create mock campaign data
export const createMockCampaign = (overrides = {}) => ({
  id: "campaign-1",
  name: "Test Campaign",
  description: "A test campaign",
  dmId: "user-1",
  isActive: true,
  system: "dnd5e",
  createdAt: new Date().toISOString(),
  characters: [],
  encounters: [],
  ...overrides,
});

// Helper to create mock dice roll data
export const createMockDiceRoll = (overrides = {}) => ({
  id: `roll-${Date.now()}`,
  expression: "1d20",
  result: 15,
  breakdown: "1d20 (15) = 15",
  timestamp: new Date(),
  roller: "Test Player",
  type: "custom" as const,
  ...overrides,
});

// Mock user-event implementation
const mockUserEvent = {
  setup: () => ({
    click: async (element: HTMLElement) => {
      element.click();
    },
    type: async (element: HTMLElement, text: string) => {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        element.value = text;
        element.dispatchEvent(new Event('input', { bubbles: true }));
      }
    },
  }),
};

// Helper to simulate user interactions with delays
export const userInteraction = {
  async clickAndWait(element: HTMLElement, delay = 100) {
    const user = mockUserEvent.setup();
    await user.click(element);
    await new Promise((resolve) => setTimeout(resolve, delay));
  },

  async typeAndWait(element: HTMLElement, text: string, delay = 100) {
    const user = mockUserEvent.setup();
    await user.type(element, text);
    await new Promise((resolve) => setTimeout(resolve, delay));
  },

  async selectAndWait(element: HTMLElement, value: string, delay = 100) {
    const user = mockUserEvent.setup();
    if (element instanceof HTMLSelectElement) {
      element.value = value;
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
  },
};

// Helper to mock console methods for tests
export const mockConsole = () => {
  const originalConsole = { ...console };

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
    jest.spyOn(console, "info").mockImplementation(() => {});
  });

  afterEach(() => {
    Object.assign(console, originalConsole);
  });
};

// Helper to mock timers for tests
export const mockTimers = () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });
};

// Helper to mock localStorage
export const mockLocalStorage = () => {
  const localStorageMock = {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
    clear: jest.fn(),
  };

  beforeEach(() => {
    Object.defineProperty(window, "localStorage", {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
    localStorageMock.clear.mockClear();
  });

  return localStorageMock;
};

// Helper to mock window.matchMedia for responsive tests
export const mockMatchMedia = () => {
  beforeEach(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(), // deprecated
        removeListener: jest.fn(), // deprecated
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });
  });
};

// Helper to mock IntersectionObserver
export const mockIntersectionObserver = () => {
  beforeEach(() => {
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });
};

// Helper to mock ResizeObserver
export const mockResizeObserver = () => {
  beforeEach(() => {
    global.ResizeObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
    }));
  });
};

// Re-export everything from testing-library
export * from "@testing-library/react";
export { customRender as render };
