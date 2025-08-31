/**
 * Unified coverage configuration for merging Jest and Vitest coverage reports
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

// Coverage directories
const COVERAGE_DIRS = {
  jest: {
    server: "./apps/server/coverage",
    client: "./apps/client/coverage",
  },
  vitest: {
    packages: "./packages/*/coverage",
  },
  merged: "./coverage-merged",
  final: "./coverage-final",
};

// Coverage thresholds
const COVERAGE_THRESHOLDS = {
  global: {
    branches: 80,
    functions: 80,
    lines: 80,
    statements: 80,
  },
  perFile: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
};

/**
 * Collect all coverage files from different test runners
 */
function collectCoverageFiles() {
  const coverageFiles = [];

  // Jest coverage files
  const jestDirs = [COVERAGE_DIRS.jest.server, COVERAGE_DIRS.jest.client];
  jestDirs.forEach((dir) => {
    const coverageFile = path.join(dir, "coverage-final.json");
    if (fs.existsSync(coverageFile)) {
      coverageFiles.push({
        type: "jest",
        path: coverageFile,
        dir: dir,
      });
    }
  });

  // Vitest coverage files (packages)
  const packagesDir = "./packages";
  if (fs.existsSync(packagesDir)) {
    const packages = fs.readdirSync(packagesDir);
    packages.forEach((pkg) => {
      const coverageFile = path.join(packagesDir, pkg, "coverage", "coverage-final.json");
      if (fs.existsSync(coverageFile)) {
        coverageFiles.push({
          type: "vitest",
          path: coverageFile,
          dir: path.join(packagesDir, pkg, "coverage"),
          package: pkg,
        });
      }
    });
  }

  return coverageFiles;
}

/**
 * Merge coverage data from multiple sources
 */
function mergeCoverageData(coverageFiles) {
  const mergedCoverage = {};

  coverageFiles.forEach(({ path: filePath, type, package: pkg }) => {
    try {
      const coverageData = JSON.parse(fs.readFileSync(filePath, "utf8"));

      Object.keys(coverageData).forEach((file) => {
        // Normalize file paths
        let normalizedPath = file;

        // Handle different path formats from Jest vs Vitest
        if (type === "vitest" && pkg) {
          // Ensure package paths are correctly prefixed
          if (!normalizedPath.includes(`packages/${pkg}`)) {
            normalizedPath = path.join("packages", pkg, normalizedPath);
          }
        }

        // Convert to absolute path for consistency
        if (!path.isAbsolute(normalizedPath)) {
          normalizedPath = path.resolve(normalizedPath);
        }

        // Merge coverage data
        if (mergedCoverage[normalizedPath]) {
          // If file already exists, merge the coverage data
          mergedCoverage[normalizedPath] = mergeCoverageForFile(
            mergedCoverage[normalizedPath],
            coverageData[file],
          );
        } else {
          mergedCoverage[normalizedPath] = coverageData[file];
        }
      });
    } catch (error) {
      console.warn(`Failed to read coverage file ${filePath}:`, error.message);
    }
  });

  return mergedCoverage;
}

/**
 * Merge coverage data for a single file
 */
function mergeCoverageForFile(existing, newData) {
  // For now, take the newer data (could be enhanced to actually merge)
  // In practice, files shouldn't be tested by multiple runners
  return newData;
}

/**
 * Generate HTML report from merged coverage
 */
function generateHtmlReport(mergedCoverage) {
  // Ensure output directory exists
  if (!fs.existsSync(COVERAGE_DIRS.final)) {
    fs.mkdirSync(COVERAGE_DIRS.final, { recursive: true });
  }

  // Write merged coverage data
  const mergedFile = path.join(COVERAGE_DIRS.final, "coverage-final.json");
  fs.writeFileSync(mergedFile, JSON.stringify(mergedCoverage, null, 2));

  // Generate HTML report using nyc
  try {
    execSync(
      `npx nyc report --reporter=html --report-dir=${COVERAGE_DIRS.final}/html --temp-dir=${COVERAGE_DIRS.final}`,
      {
        stdio: "inherit",
      },
    );
    console.log(`✅ HTML coverage report generated in ${COVERAGE_DIRS.final}/html`);
  } catch (error) {
    console.error("Failed to generate HTML report:", error.message);
  }
}

/**
 * Generate text summary report
 */
function generateSummaryReport(mergedCoverage) {
  try {
    execSync(`npx nyc report --reporter=text-summary --temp-dir=${COVERAGE_DIRS.final}`, {
      stdio: "inherit",
    });
  } catch (error) {
    console.error("Failed to generate summary report:", error.message);
  }
}

/**
 * Check coverage thresholds
 */
function checkThresholds(mergedCoverage) {
  try {
    const thresholdArgs = [
      `--lines ${COVERAGE_THRESHOLDS.global.lines}`,
      `--functions ${COVERAGE_THRESHOLDS.global.functions}`,
      `--branches ${COVERAGE_THRESHOLDS.global.branches}`,
      `--statements ${COVERAGE_THRESHOLDS.global.statements}`,
    ].join(" ");

    execSync(`npx nyc check-coverage ${thresholdArgs} --temp-dir=${COVERAGE_DIRS.final}`, {
      stdio: "inherit",
    });
    console.log("✅ Coverage thresholds met");
    return true;
  } catch (error) {
    console.error("❌ Coverage thresholds not met");
    return false;
  }
}

/**
 * Main function to merge and report coverage
 */
function main() {
  console.log("🔍 Collecting coverage files...");
  const coverageFiles = collectCoverageFiles();

  if (coverageFiles.length === 0) {
    console.warn("⚠️  No coverage files found. Run tests first.");
    process.exit(1);
  }

  console.log(`📊 Found ${coverageFiles.length} coverage files:`);
  coverageFiles.forEach(({ path, type, package: pkg }) => {
    console.log(`  - ${type}${pkg ? ` (${pkg})` : ""}: ${path}`);
  });

  console.log("🔄 Merging coverage data...");
  const mergedCoverage = mergeCoverageData(coverageFiles);

  console.log(`📈 Merged coverage for ${Object.keys(mergedCoverage).length} files`);

  console.log("📋 Generating reports...");
  generateHtmlReport(mergedCoverage);
  generateSummaryReport(mergedCoverage);

  console.log("🎯 Checking coverage thresholds...");
  const thresholdsMet = checkThresholds(mergedCoverage);

  if (!thresholdsMet) {
    process.exit(1);
  }

  console.log("✅ Coverage merge and reporting completed successfully");
}

// Export for use in other scripts
module.exports = {
  collectCoverageFiles,
  mergeCoverageData,
  generateHtmlReport,
  generateSummaryReport,
  checkThresholds,
  COVERAGE_DIRS,
  COVERAGE_THRESHOLDS,
};

// Run if called directly
if (require.main === module) {
  main();
}
