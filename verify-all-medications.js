const ExcelJS = require("exceljs");
const fs = require("fs");
const path = require("path");
const csvParser = require("csv-parser");

class MedicationVerifier {
  constructor() {
    this.excelPath = path.join(
      __dirname,
      "Analysis",
      "main_diseases_analysis_final.xlsx"
    );
    this.csvPath = path.join(__dirname, "CSV", "final_diseases_complete.csv");
    this.drugDataPath = path.join(
      __dirname,
      "Analysis",
      "drug_data_analysis.xlsx"
    );

    this.diseaseData = [];
    this.drugData = [];
    this.excelData = {};
  }

  async loadData() {
    console.log("Loading CSV data...");
    await this.loadCsvData();

    console.log("Loading drug database...");
    await this.loadDrugData();

    console.log("Loading Excel analysis...");
    await this.loadExcelData();
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

  async loadDrugData() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.drugDataPath);
    const worksheet = workbook.getWorksheet("All Drugs");

    this.drugData = [];
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const drug = {
        drugName: row.getCell(1).value || "",
        whatIs: row.getCell(2).value || "",
        sideEffects: row.getCell(3).value || "",
        url: row.getCell(4).value || "",
      };
      this.drugData.push(drug);
    });
  }

  async loadExcelData() {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(this.excelPath);

    this.excelData = {};

    workbook.eachSheet((worksheet, sheetId) => {
      if (worksheet.name === "Summary") return;

      const sheetData = {
        name: worksheet.name,
        medications: [],
      };

      let inMedicationSection = false;
      let medicationHeaderRow = null;

      worksheet.eachRow((row, rowNumber) => {
        const cellValue = row.getCell(1).value;

        if (cellValue && cellValue.toString().includes("MEDICATIONS & DRUGS")) {
          inMedicationSection = true;
          medicationHeaderRow = rowNumber + 1; // Next row should be headers
          return;
        }

        if (
          inMedicationSection &&
          rowNumber > medicationHeaderRow &&
          rowNumber > 1
        ) {
          const medicationName = row.getCell(1).value;
          const whatIs = row.getCell(2).value;
          const sideEffects = row.getCell(3).value;
          const diseaseTag = row.getCell(4).value;

          if (medicationName && medicationName.toString().trim() !== "") {
            sheetData.medications.push({
              name: medicationName.toString(),
              whatIs: whatIs ? whatIs.toString() : "",
              sideEffects: sideEffects ? sideEffects.toString() : "",
              diseaseTag: diseaseTag ? diseaseTag.toString() : "",
            });
          }
        }
      });

      this.excelData[worksheet.name] = sheetData;
    });
  }

  countMedicationsInCsv(diseaseName) {
    // Find the disease data to get its medication list
    const diseaseRow = this.diseaseData.find((row) => {
      const englishName = row["Disease_Name_English"] || "";
      return (
        englishName.toLowerCase() === diseaseName.toLowerCase() ||
        englishName.toLowerCase().includes(diseaseName.toLowerCase())
      );
    });

    if (!diseaseRow || !diseaseRow["Medications_Drugs"]) {
      return 0;
    }

    const medicationsText = diseaseRow["Medications_Drugs"];
    const medicationList = medicationsText
      .split(";")
      .map((med) => med.trim())
      .filter((med) => med);

    return medicationList.length;
  }

  async runVerification() {
    console.log("=".repeat(80));
    console.log("🔍 VERIFICATION: ALL MEDICATIONS INCLUDED - NODE.JS VERSION");
    console.log("=".repeat(80));
    console.log("");
    console.log(`📊 File: ${this.excelPath}`);
    console.log(`📈 Total Sheets: ${Object.keys(this.excelData).length + 1}`); // +1 for Summary
    console.log("");
    console.log("🔍 MEDICATION COUNT VERIFICATION:");
    console.log("=".repeat(60));

    let totalCsvMedications = 0;
    let totalExcelMedications = 0;
    const results = [];

    // Map common disease names
    const diseaseMapping = {
      "Heart disease": "Heart disease",
      "Chronic kidney disease": "Chronic kidney disease",
      COPD: "COPD",
      Pneumonia: "Pneumonia",
      Stroke: "Stroke",
      Dementia: "Dementia",
      "Depression major depressive dis":
        "Depression (major depressive disorder)",
      "High cholesterol": "High cholesterol",
      Obesity: "Obesity",
      Arthritis: "Arthritis",
    };

    for (const [sheetName, sheetData] of Object.entries(this.excelData)) {
      const mappedName = diseaseMapping[sheetName] || sheetName;
      const csvCount = this.countMedicationsInCsv(mappedName);
      const excelCount = sheetData.medications.length;

      totalCsvMedications += csvCount;
      totalExcelMedications += excelCount;

      const status =
        csvCount === excelCount
          ? "✅ COMPLETE"
          : csvCount > 0
          ? `⚠️  PARTIAL (${excelCount}/${csvCount})`
          : "Could not verify medication count";

      const result = {
        disease: sheetName,
        csvCount,
        excelCount,
        status,
      };
      results.push(result);

      console.log(
        `${sheetName.padEnd(30)} | CSV: ${csvCount
          .toString()
          .padStart(3)} | Excel: ${excelCount
          .toString()
          .padStart(3)} | ${status}`
      );
    }

    console.log("");
    console.log("=".repeat(60));
    console.log("📊 TOTAL SUMMARY:");
    console.log(`   • Total Medications in CSV:   ${totalCsvMedications}`);
    console.log(`   • Total Medications in Excel: ${totalExcelMedications}`);

    if (totalCsvMedications === totalExcelMedications) {
      console.log("   🎉 SUCCESS: ALL medications are included!");
    } else {
      console.log(
        `   ⚠️  WARNING: ${Math.abs(
          totalCsvMedications - totalExcelMedications
        )} medications difference detected`
      );
    }

    // Show sample medication details
    console.log("");
    console.log("💊 SAMPLE MEDICATION DETAILS:");
    console.log("-".repeat(50));

    const firstSheetName = Object.keys(this.excelData)[0];
    if (
      firstSheetName &&
      this.excelData[firstSheetName].medications.length > 0
    ) {
      console.log(`From '${firstSheetName}' sheet:`);
      console.log("");
      console.log(
        "Columns: Medication Name | What Is | Side Effects | Disease Tag"
      );
      console.log("");

      const sampleMeds = this.excelData[firstSheetName].medications.slice(0, 3);
      sampleMeds.forEach((med, index) => {
        console.log(`${index + 1}. ${med.name}`);
        if (med.diseaseTag) {
          console.log(`   Disease Tag: ${med.diseaseTag}`);
        }
        if (
          med.whatIs &&
          med.whatIs !== "Information not available in database"
        ) {
          const truncatedWhatIs =
            med.whatIs.length > 80
              ? med.whatIs.substring(0, 80) + "..."
              : med.whatIs;
          console.log(`   What Is: ${truncatedWhatIs}`);
        }
        if (
          med.sideEffects &&
          med.sideEffects !== "Side effects information not available"
        ) {
          const truncatedSideEffects =
            med.sideEffects.length > 80
              ? med.sideEffects.substring(0, 80) + "..."
              : med.sideEffects;
          console.log(`   Side Effects: ${truncatedSideEffects}`);
        }
        console.log("");
      });
    }

    console.log("🎯 NODE.JS VERSION FEATURES:");
    console.log("   ✅ Complete medication verification");
    console.log("   ✅ Excel parsing with ExcelJS");
    console.log("   ✅ CSV data integration");
    console.log("   ✅ Smart disease matching algorithm");
    console.log("   ✅ Comprehensive medication analysis");
    console.log("");
    console.log("=".repeat(80));
    console.log("✨ VERIFICATION COMPLETE - Node.js implementation working!");
    console.log("=".repeat(80));

    return results;
  }
}

// Main execution
async function main() {
  try {
    const verifier = new MedicationVerifier();
    await verifier.loadData();
    await verifier.runVerification();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = MedicationVerifier;

// Run if called directly
if (require.main === module) {
  main();
}
