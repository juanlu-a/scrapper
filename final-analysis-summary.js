const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");

class FinalAnalysisSummary {
  constructor() {
    this.excelPath = path.join(
      __dirname,
      "Analysis",
      "main_diseases_analysis_final.xlsx"
    );
    this.csvPath = path.join(__dirname, "CSV", "final_diseases_complete.csv");

    this.diseaseData = [];
    this.sheetNames = [];
    this.targetDiseases = [
      "Heart disease",
      "Chronic kidney disease",
      "COPD",
      "Pneumonia",
      "Stroke",
      "Dementia",
      "Depression",
      "High cholesterol",
      "Obesity",
      "Arthritis",
    ];
  }

  async loadData() {
    // Load CSV data
    await this.loadCsvData();

    // Load Excel sheet names
    await this.loadExcelSheetNames();
  }

  loadCsvData() {
    return new Promise((resolve, reject) => {
      this.diseaseData = [];
      fs.createReadStream(this.csvPath)
        .pipe(csvParser())
        .on("data", (row) => {
          this.diseaseData.push(row);
        })
        .on("end", () => {
          resolve();
        })
        .on("error", reject);
    });
  }

  async loadExcelSheetNames() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.excelPath);

    this.sheetNames = [];
    workbook.eachSheet((worksheet) => {
      this.sheetNames.push(worksheet.name);
    });
  }

  async displaySummary() {
    console.log("=".repeat(80));
    console.log("🏥 MAIN DISEASES COMPREHENSIVE ANALYSIS - NODE.JS VERSION");
    console.log("=".repeat(80));
    console.log("");
    console.log(`📊 File: main_diseases_analysis_final.xlsx`);
    console.log(`📈 Total Sheets: ${this.sheetNames.length}`);
    console.log("");
    console.log("📋 DISEASE SHEETS:");
    console.log("-".repeat(50));

    const diseaseSheets = [];
    this.sheetNames.forEach((sheetName, index) => {
      if (sheetName === "Summary") {
        console.log(
          `${(index + 1)
            .toString()
            .padStart(2)}. 📊 ${sheetName} (Overview & Statistics)`
        );
      } else {
        diseaseSheets.push(sheetName);
        console.log(`${(index + 1).toString().padStart(2)}. 💊 ${sheetName}`);
      }
    });

    console.log("");
    console.log("🎯 TARGET DISEASES COVERAGE:");
    console.log("-".repeat(40));

    let foundCount = 0;
    for (const target of this.targetDiseases) {
      const found = diseaseSheets.some((sheet) =>
        this.isDiseaseMatch(target, sheet)
      );

      if (found) {
        foundCount++;
        console.log(`✅ ${target}`);
      } else {
        console.log(`❌ ${target}`);
      }
    }

    console.log("");
    console.log(
      `Success Rate: ${foundCount}/${this.targetDiseases.length} = ${Math.round(
        (foundCount / this.targetDiseases.length) * 100
      )}%`
    );

    console.log("");
    console.log("📝 EACH DISEASE SHEET CONTAINS:");
    console.log("-".repeat(40));
    console.log("• 🏷️  Disease Information (English & Spanish names)");
    console.log("• 🔍 Comprehensive Diagnosis Process");
    console.log("• 💊 Available Treatments");
    console.log("• 🧪 Diagnostic Tests");
    console.log("• 💉 Complete Medications Database with:");
    console.log("  - Medication names");
    console.log("  - Detailed descriptions ('What Is')");
    console.log("  - Comprehensive side effects");
    console.log("  - Disease tags");
    console.log("• 🎨 Professional Excel Formatting");

    // Get medication counts
    await this.displayMedicationStats();

    console.log("");
    console.log("🔧 DATA SOURCES:");
    console.log("-".repeat(20));
    console.log("• Disease Data: final_diseases_complete.csv");
    console.log("• Drug Data: drug_data_analysis.xlsx");
    console.log("• Integration: Smart medication matching algorithm");

    console.log("");
    console.log("🚀 HOW TO USE:");
    console.log("-".repeat(15));
    console.log("1. Open main_diseases_analysis_final.xlsx");
    console.log("2. Start with 'Summary' sheet for overview");
    console.log("3. Navigate to specific disease sheets");
    console.log("4. Review comprehensive medication information");
    console.log("5. Use for medical research or clinical reference");

    console.log("");
    console.log("💻 NODE.JS IMPLEMENTATION FEATURES:");
    console.log("-".repeat(35));
    console.log("• ✅ ExcelJS for Excel file manipulation");
    console.log("• ✅ CSV parsing with csv-parser");
    console.log("• ✅ Asynchronous data processing");
    console.log("• ✅ Promise-based architecture");
    console.log("• ✅ Error handling and validation");
    console.log("• ✅ Modular design for reusability");

    console.log("");
    console.log("=".repeat(80));
    console.log("✨ FINAL ANALYSIS READY - Complete medical database!");
    console.log("=".repeat(80));
  }

  async displayMedicationStats() {
    console.log("");
    console.log("💊 MEDICATION STATISTICS:");
    console.log("-".repeat(30));

    try {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(this.excelPath);

      let totalMedications = 0;
      const medicationCounts = {};

      workbook.eachSheet((worksheet) => {
        if (worksheet.name === "Summary") return;

        let medicationCount = 0;
        let inMedicationSection = false;
        let medicationHeaderRow = null;

        worksheet.eachRow((row, rowNumber) => {
          const cellValue = row.getCell(1).value;

          if (
            cellValue &&
            cellValue.toString().includes("MEDICATIONS & DRUGS")
          ) {
            inMedicationSection = true;
            medicationHeaderRow = rowNumber + 1;
            return;
          }

          if (
            inMedicationSection &&
            rowNumber > medicationHeaderRow &&
            rowNumber > 1
          ) {
            const medicationName = row.getCell(1).value;
            if (medicationName && medicationName.toString().trim() !== "") {
              medicationCount++;
            }
          }
        });

        medicationCounts[worksheet.name] = medicationCount;
        totalMedications += medicationCount;
      });

      // Display top medication counts
      const sortedCounts = Object.entries(medicationCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5);

      sortedCounts.forEach(([disease, count]) => {
        console.log(
          `• ${disease.padEnd(25)}: ${count.toString().padStart(3)} medications`
        );
      });

      if (Object.keys(medicationCounts).length > 5) {
        console.log("• ...                     : ...");
      }

      console.log(
        `• ${"TOTAL ACROSS ALL DISEASES".padEnd(25)}: ${totalMedications
          .toString()
          .padStart(3)} medications`
      );
    } catch (error) {
      console.log("• Could not load medication statistics");
    }
  }

  isDiseaseMatch(target, sheetName) {
    const targetLower = target.toLowerCase();
    const sheetLower = sheetName.toLowerCase();

    // Direct match
    if (sheetLower.includes(targetLower)) {
      return true;
    }

    // Word-by-word match
    const targetWords = targetLower.split(" ");
    return targetWords.some(
      (word) => word.length > 3 && sheetLower.includes(word)
    );
  }
}

// Main execution
async function main() {
  try {
    const summary = new FinalAnalysisSummary();
    await summary.loadData();
    await summary.displaySummary();
  } catch (error) {
    console.error("Error:", error);
    if (error.code === "ENOENT") {
      console.log("");
      console.log("❌ Excel file not found. Please run the analyzer first:");
      console.log("   node main-diseases-analyzer-final.js");
    }
    process.exit(1);
  }
}

// Export for use as module
module.exports = FinalAnalysisSummary;

// Run if called directly
if (require.main === module) {
  main();
}
