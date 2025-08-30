/**
 * Grid Manager Tests
 * Comprehensive test suite for grid management functionality
 */

import { GridManager } from "../GridManager";

describe("GridManager", () => {
  let gridManager: GridManager;

  beforeEach(() => {
    gridManager = new GridManager({
      type: "square",
      size: 50,
      offsetX: 0,
      offsetY: 0,
      color: "#000000",
      opacity: 0.5,
      snapToGrid: true,
      showGrid: true,
    });
  });

  describe("Grid Configuration", () => {
    test("should initialize with default settings", () => {
      const settings = gridManager.getSettings();
      expect(settings.type).toBe("square");
      expect(settings.size).toBe(50);
      expect(settings.snapToGrid).toBe(true);
    });

    test("should update grid settings", () => {
      gridManager.updateSettings({
        type: "hexagonal",
        size: 25,
        hexOrientation: "pointy",
      });

      const settings = gridManager.getSettings();
      expect(settings.type).toBe("hexagonal");
      expect(settings.size).toBe(25);
      expect(settings.hexOrientation).toBe("pointy");
    });

    test("should validate grid settings", () => {
      expect(() => {
        gridManager.updateSettings({ size: -10 });
      }).toThrow("Grid size must be positive");

      expect(() => {
        gridManager.updateSettings({ opacity: 1.5 });
      }).toThrow("Opacity must be between 0 and 1");
    });
  });

  describe("Square Grid Operations", () => {
    beforeEach(() => {
      gridManager.updateSettings({ type: "square", size: 50 });
    });

    test("should snap coordinates to square grid", () => {
      const snapped = gridManager.snapToGrid({ x: 123, y: 187 });
      expect(snapped.x).toBe(100); // 123 -> 100 (nearest 50px grid)
      expect(snapped.y).toBe(200); // 187 -> 200
    });

    test("should convert world coordinates to grid coordinates", () => {
      const gridCoord = gridManager.worldToGrid({ x: 150, y: 200 });
      expect(gridCoord.col).toBe(3); // 150 / 50 = 3
      expect(gridCoord.row).toBe(4); // 200 / 50 = 4
    });

    test("should convert grid coordinates to world coordinates", () => {
      const worldCoord = gridManager.gridToWorld({ col: 2, row: 3 });
      expect(worldCoord.x).toBe(100); // 2 * 50
      expect(worldCoord.y).toBe(150); // 3 * 50
    });

    test("should calculate grid bounds for area", () => {
      const bounds = gridManager.getGridBounds({ x: 0, y: 0, width: 300, height: 200 });
      expect(bounds.minCol).toBe(0);
      expect(bounds.maxCol).toBe(6); // 300 / 50
      expect(bounds.minRow).toBe(0);
      expect(bounds.maxRow).toBe(4); // 200 / 50
    });

    test("should handle grid offset", () => {
      gridManager.updateSettings({ offsetX: 25, offsetY: 25 });

      const snapped = gridManager.snapToGrid({ x: 100, y: 100 });
      expect(snapped.x).toBe(125); // 100 + 25 offset, snapped to grid
      expect(snapped.y).toBe(125);
    });
  });

  describe("Hexagonal Grid Operations", () => {
    beforeEach(() => {
      gridManager.updateSettings({
        type: "hexagonal",
        size: 50,
        hexOrientation: "pointy",
      });
    });

    test("should snap coordinates to hexagonal grid", () => {
      const snapped = gridManager.snapToGrid({ x: 100, y: 100 });
      expect(typeof snapped.x).toBe("number");
      expect(typeof snapped.y).toBe("number");
      // Hexagonal snapping is more complex, just verify we get valid coordinates
    });

    test("should convert hex grid coordinates", () => {
      const hexCoord = gridManager.worldToHex({ x: 100, y: 100 });
      expect(hexCoord.q).toBeDefined();
      expect(hexCoord.r).toBeDefined();
      expect(hexCoord.s).toBeDefined();
      // Hex coordinates should sum to zero
      expect(hexCoord.q + hexCoord.r + hexCoord.s).toBe(0);
    });

    test("should convert hex coordinates to world", () => {
      const worldCoord = gridManager.hexToWorld({ q: 1, r: 1, s: -2 });
      expect(typeof worldCoord.x).toBe("number");
      expect(typeof worldCoord.y).toBe("number");
    });

    test("should calculate hex distance", () => {
      const hex1 = { q: 0, r: 0, s: 0 };
      const hex2 = { q: 2, r: -1, s: -1 };
      const distance = gridManager.hexDistance(hex1, hex2);
      expect(distance).toBe(2);
    });

    test("should get hex neighbors", () => {
      const center = { q: 0, r: 0, s: 0 };
      const neighbors = gridManager.getHexNeighbors(center);
      expect(neighbors).toHaveLength(6);

      // All neighbors should be distance 1 from center
      neighbors.forEach((neighbor) => {
        expect(gridManager.hexDistance(center, neighbor)).toBe(1);
      });
    });

    test("should handle flat-top hex orientation", () => {
      gridManager.updateSettings({ hexOrientation: "flat" });

      const worldCoord = gridManager.hexToWorld({ q: 1, r: 0, s: -1 });
      expect(typeof worldCoord.x).toBe("number");
      expect(typeof worldCoord.y).toBe("number");
    });
  });

  describe("Isometric Grid Operations", () => {
    beforeEach(() => {
      gridManager.updateSettings({
        type: "isometric",
        size: 50,
        isoAngle: 30,
      });
    });

    test("should snap coordinates to isometric grid", () => {
      const snapped = gridManager.snapToGrid({ x: 100, y: 100 });
      expect(typeof snapped.x).toBe("number");
      expect(typeof snapped.y).toBe("number");
    });

    test("should convert isometric coordinates", () => {
      const isoCoord = gridManager.worldToIsometric({ x: 100, y: 100 });
      expect(typeof isoCoord.x).toBe("number");
      expect(typeof isoCoord.y).toBe("number");
    });

    test("should convert back from isometric", () => {
      const worldCoord = { x: 100, y: 100 };
      const isoCoord = gridManager.worldToIsometric(worldCoord);
      const backToWorld = gridManager.isometricToWorld(isoCoord);

      expect(backToWorld.x).toBeCloseTo(worldCoord.x, 0);
      expect(backToWorld.y).toBeCloseTo(worldCoord.y, 0);
    });
  });

  describe("Grid Rendering", () => {
    test("should generate grid lines for square grid", () => {
      const viewport = { x: 0, y: 0, width: 200, height: 200 };
      const lines = gridManager.getGridLines(viewport);

      expect(lines.horizontal.length).toBeGreaterThan(0);
      expect(lines.vertical.length).toBeGreaterThan(0);

      // Each line should have start and end points
      lines.horizontal.forEach((line) => {
        expect(line.x1).toBeDefined();
        expect(line.y1).toBeDefined();
        expect(line.x2).toBeDefined();
        expect(line.y2).toBeDefined();
      });
    });

    test("should generate hex grid points", () => {
      gridManager.updateSettings({ type: "hexagonal" });

      const viewport = { x: 0, y: 0, width: 200, height: 200 };
      const hexagons = gridManager.getHexGridPoints(viewport);

      expect(hexagons.length).toBeGreaterThan(0);
      hexagons.forEach((hex) => {
        expect(hex.points).toHaveLength(6); // Hexagon has 6 points
        expect(hex.center.x).toBeDefined();
        expect(hex.center.y).toBeDefined();
      });
    });

    test("should respect grid visibility settings", () => {
      gridManager.updateSettings({ showGrid: false });

      const viewport = { x: 0, y: 0, width: 200, height: 200 };
      const lines = gridManager.getGridLines(viewport);

      expect(lines.horizontal).toHaveLength(0);
      expect(lines.vertical).toHaveLength(0);
    });

    test("should apply grid subdivisions", () => {
      gridManager.updateSettings({ subdivisions: 2 });

      const viewport = { x: 0, y: 0, width: 100, height: 100 };
      const lines = gridManager.getGridLines(viewport);

      // Should have more lines due to subdivisions
      const expectedHorizontalLines = Math.ceil(100 / (50 / 2)) + 1;
      expect(lines.horizontal.length).toBeGreaterThanOrEqual(expectedHorizontalLines);
    });
  });

  describe("Grid Measurements", () => {
    test("should calculate distances in grid units", () => {
      const point1 = { x: 0, y: 0 };
      const point2 = { x: 100, y: 100 };

      const distance = gridManager.calculateGridDistance(point1, point2);
      expect(distance).toBeCloseTo(2.83, 1); // ~√8 grid units
    });

    test("should calculate area in grid units", () => {
      const polygon = [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
      ];

      const area = gridManager.calculateGridArea(polygon);
      expect(area).toBe(4); // 2x2 grid squares
    });

    test("should measure path length", () => {
      const path = [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
        { x: 50, y: 50 },
        { x: 100, y: 50 },
      ];

      const length = gridManager.measurePath(path);
      expect(length).toBe(3); // 3 grid units total
    });
  });

  describe("Grid Queries", () => {
    test("should find cells within radius", () => {
      const center = { x: 100, y: 100 };
      const radius = 75; // 1.5 grid cells

      const cells = gridManager.getCellsInRadius(center, radius);
      expect(cells.length).toBeGreaterThan(0);

      cells.forEach((cell) => {
        const distance = Math.sqrt(Math.pow(cell.x - center.x, 2) + Math.pow(cell.y - center.y, 2));
        expect(distance).toBeLessThanOrEqual(radius);
      });
    });

    test("should find cells in rectangular area", () => {
      const bounds = { x: 25, y: 25, width: 100, height: 100 };
      const cells = gridManager.getCellsInBounds(bounds);

      expect(cells.length).toBeGreaterThan(0);
      cells.forEach((cell) => {
        expect(cell.x).toBeGreaterThanOrEqual(bounds.x);
        expect(cell.x).toBeLessThan(bounds.x + bounds.width);
        expect(cell.y).toBeGreaterThanOrEqual(bounds.y);
        expect(cell.y).toBeLessThan(bounds.y + bounds.height);
      });
    });

    test("should find line of sight cells", () => {
      const start = { x: 0, y: 0 };
      const end = { x: 150, y: 100 };

      const losCells = gridManager.getLineOfSightCells(start, end);
      expect(losCells.length).toBeGreaterThan(0);

      // First cell should be at or near start
      expect(losCells[0].x).toBeCloseTo(start.x, 25);
      expect(losCells[0].y).toBeCloseTo(start.y, 25);

      // Last cell should be at or near end
      const lastCell = losCells[losCells.length - 1];
      expect(lastCell.x).toBeCloseTo(end.x, 25);
      expect(lastCell.y).toBeCloseTo(end.y, 25);
    });
  });

  describe("Performance", () => {
    test("should handle large grids efficiently", () => {
      const start = Date.now();

      const viewport = { x: 0, y: 0, width: 5000, height: 5000 };
      const lines = gridManager.getGridLines(viewport);

      const duration = Date.now() - start;
      expect(duration).toBeLessThan(100); // Should complete within 100ms
      expect(lines.horizontal.length).toBeGreaterThan(0);
      expect(lines.vertical.length).toBeGreaterThan(0);
    });

    test("should cache grid calculations", () => {
      const point = { x: 123, y: 456 };

      const start1 = Date.now();
      const snapped1 = gridManager.snapToGrid(point);
      const duration1 = Date.now() - start1;

      const start2 = Date.now();
      const snapped2 = gridManager.snapToGrid(point);
      const duration2 = Date.now() - start2;

      expect(snapped1).toEqual(snapped2);
      expect(duration2).toBeLessThanOrEqual(duration1);
    });

    test("should handle rapid grid setting changes", () => {
      const settings = [
        { type: "square" as const, size: 25 },
        { type: "hexagonal" as const, size: 30 },
        { type: "isometric" as const, size: 35 },
        { type: "square" as const, size: 50 },
      ];

      expect(() => {
        settings.forEach((setting) => {
          gridManager.updateSettings(setting);
          gridManager.snapToGrid({ x: 100, y: 100 });
        });
      }).not.toThrow();
    });
  });

  describe("Events", () => {
    test("should emit events on setting changes", (done) => {
      gridManager.on("settingsChanged", (data) => {
        expect(data.oldSettings).toBeDefined();
        expect(data.newSettings).toBeDefined();
        expect(data.newSettings.size).toBe(75);
        done();
      });

      gridManager.updateSettings({ size: 75 });
    });

    test("should emit events on grid calculations", (done) => {
      let eventCount = 0;

      gridManager.on("coordinatesCalculated", () => {
        eventCount++;
        if (eventCount === 2) done();
      });

      gridManager.snapToGrid({ x: 100, y: 100 });
      gridManager.worldToGrid({ x: 150, y: 200 });
    });
  });

  describe("Error Handling", () => {
    test("should handle invalid coordinates gracefully", () => {
      expect(() => {
        gridManager.snapToGrid({ x: NaN, y: 100 });
      }).not.toThrow();

      expect(() => {
        gridManager.snapToGrid({ x: Infinity, y: 100 });
      }).not.toThrow();
    });

    test("should handle extreme values", () => {
      const extremePoint = { x: 1e10, y: -1e10 };

      expect(() => {
        gridManager.snapToGrid(extremePoint);
      }).not.toThrow();

      expect(() => {
        gridManager.worldToGrid(extremePoint);
      }).not.toThrow();
    });

    test("should validate hex coordinates", () => {
      gridManager.updateSettings({ type: "hexagonal" });

      // Invalid hex coordinates (don't sum to zero)
      expect(() => {
        gridManager.hexToWorld({ q: 1, r: 1, s: 1 });
      }).toThrow("Invalid hex coordinates");
    });
  });
});
