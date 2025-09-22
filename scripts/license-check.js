#!/usr/bin/env node
/**
 * License compliance checker for VTT project
 * Scans all dependencies and validates against approved licenses
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// Approved licenses (permissive and compatible with commercial use)
const APPROVED_LICENSES = [
  "MIT",
  "Apache-2.0",
  "BSD-2-Clause",
  "BSD-3-Clause",
  "ISC",
  "CC0-1.0",
  "Unlicense",
  "WTFPL",
  "0BSD",
];

// Licenses that require review
const REVIEW_REQUIRED = [
  "GPL-2.0",
  "GPL-3.0",
  "LGPL-2.1",
  "LGPL-3.0",
  "AGPL-3.0",
  "MPL-2.0",
  "EPL-1.0",
  "EPL-2.0",
  "CDDL-1.0",
  "CDDL-1.1",
];

// Prohibited licenses
const PROHIBITED_LICENSES = [
  "AGPL-1.0",
  "AGPL-3.0-only",
  "GPL-1.0",
  "GPL-2.0-only",
  "GPL-3.0-only",
];

class LicenseChecker {
  constructor() {
    this.violations = [];
    this.reviewRequired = [];
    this.approved = [];
    this.unknown = [];
  }

  async checkLicenses() {
    console.log("🔍 Scanning dependencies for license compliance...\n");

    try {
      // First try nlf (node license finder) if available, otherwise fallback
      let licenseData = {};
      try {
        const nlfOutput = execSync("npx nlf --format json", {
          encoding: "utf8",
          cwd: process.cwd(),
          timeout: 30000
        });
        const nlfData = JSON.parse(nlfOutput);
        nlfData.forEach(pkg => {
          licenseData[pkg.name] = {
            license: pkg.license,
            version: pkg.version,
            repository: pkg.repository
          };
        });
      } catch (nlfError) {
        console.log("📦 nlf not available, using package.json fallback...");
        await this.checkPackageJsonLicenses();
        return;
      }

      for (const [packageName, info] of Object.entries(licenseData)) {
        this.analyzeLicense(packageName, info);
      }

      this.generateReport();
    } catch (error) {
      console.error("❌ Failed to check licenses:", error.message);

      // Fallback: check package.json files directly
      console.log("📦 Falling back to package.json analysis...");
      await this.checkPackageJsonLicenses();
    }
  }

  analyzeLicense(packageName, info) {
    const license = info.license || info.licenses;
    const licenseString = Array.isArray(license) ? license.join(" OR ") : license;

    if (!licenseString || licenseString === "UNKNOWN") {
      this.unknown.push({ package: packageName, license: "UNKNOWN", ...info });
      return;
    }

    // Check for prohibited licenses
    if (this.containsProhibitedLicense(licenseString)) {
      this.violations.push({
        package: packageName,
        license: licenseString,
        severity: "HIGH",
        reason: "Prohibited license detected",
        ...info,
      });
      return;
    }

    // Check for licenses requiring review
    if (this.requiresReview(licenseString)) {
      this.reviewRequired.push({
        package: packageName,
        license: licenseString,
        reason: "License requires legal review",
        ...info,
      });
      return;
    }

    // Check for approved licenses
    if (this.isApproved(licenseString)) {
      this.approved.push({ package: packageName, license: licenseString, ...info });
      return;
    }

    // Unknown/custom license
    this.unknown.push({
      package: packageName,
      license: licenseString,
      reason: "Custom or unrecognized license",
      ...info,
    });
  }

  containsProhibitedLicense(licenseString) {
    return PROHIBITED_LICENSES.some((prohibited) =>
      licenseString.toLowerCase().includes(prohibited.toLowerCase()),
    );
  }

  requiresReview(licenseString) {
    return REVIEW_REQUIRED.some((review) =>
      licenseString.toLowerCase().includes(review.toLowerCase()),
    );
  }

  isApproved(licenseString) {
    return APPROVED_LICENSES.some((approved) =>
      licenseString.toLowerCase().includes(approved.toLowerCase()),
    );
  }

  async checkPackageJsonLicenses() {
    const nodeModulesPath = path.join(process.cwd(), "node_modules");

    if (!fs.existsSync(nodeModulesPath)) {
      console.log("⚠️  node_modules not found. Run pnpm install first.");
      return;
    }

    const packages = fs
      .readdirSync(nodeModulesPath)
      .filter((dir) => !dir.startsWith("."))
      .slice(0, 100); // Limit for performance

    for (const packageDir of packages) {
      const packageJsonPath = path.join(nodeModulesPath, packageDir, "package.json");

      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
          const license = packageJson.license || packageJson.licenses;

          this.analyzeLicense(packageJson.name || packageDir, {
            license,
            version: packageJson.version,
            repository: packageJson.repository,
          });
        } catch (error) {
          // Skip invalid package.json files
        }
      }
    }
  }

  generateReport() {
    console.log("📊 License Compliance Report");
    console.log("=".repeat(50));

    // Summary
    console.log(`\n📈 Summary:`);
    console.log(`  ✅ Approved: ${this.approved.length}`);
    console.log(`  ⚠️  Review Required: ${this.reviewRequired.length}`);
    console.log(`  ❌ Violations: ${this.violations.length}`);
    console.log(`  ❓ Unknown: ${this.unknown.length}`);

    // Violations (critical)
    if (this.violations.length > 0) {
      console.log(`\n❌ LICENSE VIOLATIONS (${this.violations.length}):`);
      this.violations.forEach((violation) => {
        console.log(`  • ${violation.package} (${violation.license})`);
        console.log(`    Reason: ${violation.reason}`);
      });
    }

    // Review required
    if (this.reviewRequired.length > 0) {
      console.log(`\n⚠️  REVIEW REQUIRED (${this.reviewRequired.length}):`);
      this.reviewRequired.forEach((item) => {
        console.log(`  • ${item.package} (${item.license})`);
      });
    }

    // Unknown licenses
    if (this.unknown.length > 0) {
      console.log(`\n❓ UNKNOWN LICENSES (${this.unknown.length}):`);
      this.unknown.slice(0, 10).forEach((item) => {
        console.log(`  • ${item.package} (${item.license || "UNKNOWN"})`);
      });
      if (this.unknown.length > 10) {
        console.log(`  ... and ${this.unknown.length - 10} more`);
      }
    }

    // Generate compliance files
    this.generateComplianceFiles();

    // Exit code - only fail on actual violations, not unknown licenses
    const exitCode = this.violations.length > 0 ? 1 : 0;

    if (exitCode === 0) {
      console.log("\n✅ License compliance check passed!");
      if (this.reviewRequired.length > 0 || this.unknown.length > 0) {
        console.log("⚠️  Some licenses require review, but this won't block CI");
      }
    } else {
      console.log("\n❌ License compliance check failed!");
      console.log("Please resolve violations before proceeding.");
    }

    process.exit(exitCode);
  }

  generateComplianceFiles() {
    const complianceDir = path.join(process.cwd(), "compliance");

    if (!fs.existsSync(complianceDir)) {
      fs.mkdirSync(complianceDir, { recursive: true });
    }

    // Generate detailed report
    const report = {
      timestamp: new Date().toISOString(),
      summary: {
        approved: this.approved.length,
        reviewRequired: this.reviewRequired.length,
        violations: this.violations.length,
        unknown: this.unknown.length,
      },
      approved: this.approved,
      reviewRequired: this.reviewRequired,
      violations: this.violations,
      unknown: this.unknown,
    };

    fs.writeFileSync(
      path.join(complianceDir, "license-report.json"),
      JSON.stringify(report, null, 2),
    );

    // Generate NOTICE file for attribution
    const noticeContent = this.generateNoticeFile();
    fs.writeFileSync(path.join(complianceDir, "NOTICE.txt"), noticeContent);

    console.log("\n📄 Compliance files generated:");
    console.log("  • compliance/license-report.json");
    console.log("  • compliance/NOTICE.txt");
  }

  generateNoticeFile() {
    let notice = "VTT - Virtual Tabletop\n";
    notice += "=".repeat(50) + "\n\n";
    notice += "This software includes the following third-party components:\n\n";

    this.approved.forEach((item) => {
      notice += `${item.package}\n`;
      notice += `License: ${item.license}\n`;
      if (item.repository) {
        notice += `Repository: ${typeof item.repository === "string" ? item.repository : item.repository.url}\n`;
      }
      notice += "\n";
    });

    return notice;
  }
}

// Run license check
if (require.main === module) {
  const checker = new LicenseChecker();
  checker.checkLicenses().catch(console.error);
}

module.exports = LicenseChecker;
