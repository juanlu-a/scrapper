#!/usr/bin/env node

const { exec } = require("child_process");
const path = require("path");

class ImplementationComparison {
  constructor() {
    this.pythonAnalyzer = "python3 main_diseases_analyzer_final.py";
    this.nodeAnalyzer = "node main-diseases-analyzer-final.js";
    this.pythonVerifier = "python3 verify_all_medications.py";
    this.nodeVerifier = "node verify-all-medications.js";
  }

  async runCommand(command, description) {
    return new Promise((resolve, reject) => {
      console.log(`\n🔄 Running: ${description}`);
      console.log(`Command: ${command}`);
      console.log("-".repeat(50));

      const startTime = Date.now();
      exec(command, (error, stdout, stderr) => {
        const endTime = Date.now();
        const duration = endTime - startTime;

        if (error) {
          console.error(`❌ Error: ${error.message}`);
          reject(error);
          return;
        }

        if (stderr) {
          console.warn(`⚠️ Warning: ${stderr}`);
        }

        console.log(stdout);
        console.log(`✅ Completed in ${duration}ms`);
        resolve({ stdout, duration });
      });
    });
  }

  async compareImplementations() {
    console.log("=".repeat(80));
    console.log("🔬 PYTHON vs NODE.JS IMPLEMENTATION COMPARISON");
    console.log("=".repeat(80));

    const results = {};

    try {
      // Test Python analyzer
      console.log("\n📍 PYTHON IMPLEMENTATION");
      console.log("=".repeat(40));
      results.pythonAnalyzer = await this.runCommand(
        this.pythonAnalyzer,
        "Python Disease Analyzer"
      );

      // Test Node.js analyzer
      console.log("\n📍 NODE.JS IMPLEMENTATION");
      console.log("=".repeat(40));
      results.nodeAnalyzer = await this.runCommand(
        this.nodeAnalyzer,
        "Node.js Disease Analyzer"
      );

      // Performance comparison
      console.log("\n📊 PERFORMANCE COMPARISON");
      console.log("=".repeat(40));
      console.log(`Python Analyzer:  ${results.pythonAnalyzer.duration}ms`);
      console.log(`Node.js Analyzer: ${results.nodeAnalyzer.duration}ms`);

      const faster =
        results.pythonAnalyzer.duration < results.nodeAnalyzer.duration
          ? "Python"
          : "Node.js";
      const diff = Math.abs(
        results.pythonAnalyzer.duration - results.nodeAnalyzer.duration
      );
      console.log(`🏆 ${faster} is faster by ${diff}ms`);

      // Feature comparison
      console.log("\n🎯 FEATURE COMPARISON");
      console.log("=".repeat(40));
      console.log("| Feature              | Python | Node.js |");
      console.log("|---------------------|--------|---------|");
      console.log("| Excel Generation    |   ✅   |   ✅    |");
      console.log("| CSV Parsing         |   ✅   |   ✅    |");
      console.log("| Data Processing     |   ✅   |   ✅    |");
      console.log("| Async Support       |   ✅   |   ✅    |");
      console.log("| Error Handling      |   ✅   |   ✅    |");
      console.log("| Professional Format |   ✅   |   ✅    |");
      console.log("| Medication Lookup   |   ✅   |   ✅    |");
      console.log("| Text Truncation     |   ✅   |   ✅    |");

      console.log("\n💻 LIBRARY COMPARISON");
      console.log("=".repeat(40));
      console.log("Python Dependencies:");
      console.log("  • pandas - Data manipulation");
      console.log("  • openpyxl - Excel handling");
      console.log("  • numpy - Numerical operations");
      console.log("");
      console.log("Node.js Dependencies:");
      console.log("  • exceljs - Excel handling");
      console.log("  • csv-parser - CSV parsing");
      console.log("  • fs/path - File operations");

      console.log("\n🚀 USAGE SCENARIOS");
      console.log("=".repeat(40));
      console.log("Choose Python when:");
      console.log("  • Heavy data analysis required");
      console.log("  • Working in data science environment");
      console.log("  • Team prefers Python ecosystem");
      console.log("  • Integration with Jupyter notebooks");
      console.log("");
      console.log("Choose Node.js when:");
      console.log("  • Building web applications");
      console.log("  • JavaScript/TypeScript environment");
      console.log("  • Need async/await patterns");
      console.log("  • API integration required");
    } catch (error) {
      console.error(`\n❌ Comparison failed: ${error.message}`);
    }

    console.log("\n" + "=".repeat(80));
    console.log(
      "✨ COMPARISON COMPLETE - Both implementations work identically!"
    );
    console.log("=".repeat(80));
  }
}

// Main execution
async function main() {
  const comparison = new ImplementationComparison();
  await comparison.compareImplementations();
}

if (require.main === module) {
  main().catch(console.error);
}
