const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");
const csvParser = require("csv-parser");

class MainDiseasesAnalyzer {
  constructor() {
    this.targetDiseases = [
      "Heart disease",
      "Chronic kidney disease",
      "COPD",
      "Pneumonia",
      "Stroke",
      "Dementia",
      "Depression (major depressive disorder)",
      "High cholesterol",
      "Obesity",
      "Arthritis",
    ];

    this.csvPath = path.join(__dirname, "CSV", "final_diseases_complete.csv");
    this.drugDataPath = path.join(
      __dirname,
      "Analysis",
      "drug_data_analysis.xlsx"
    );
    this.outputPath = path.join(
      __dirname,
      "Analysis",
      "main_diseases_analysis_final.xlsx"
    );

    this.diseaseData = [];
    this.drugData = [];
    this.processedDiseases = new Set();
    this.createdSheets = [];
  }

  async loadData() {
    console.log("Loading disease data from CSV...");
    await this.loadCsvData();

    console.log("Loading drug data from Excel...");
    await this.loadDrugData();

    console.log(
      `✓ Loaded ${this.diseaseData.length} diseases and ${this.drugData.length} drugs`
    );
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

  async createAnalysis() {
    console.log(
      "Creating Complete Main Diseases Analysis with ALL Medications..."
    );

    const workbook = new ExcelJS.Workbook();

    // Create summary sheet first
    const summarySheet = workbook.addWorksheet("Summary");
    this.createSummarySheet(summarySheet);

    // Process each target disease
    for (const disease of this.targetDiseases) {
      const diseaseRow = this.findDiseaseData(disease);

      if (!diseaseRow) {
        console.log(`No data found for ${disease}`);
        continue;
      }

      const diseaseName = diseaseRow["Disease_Name_English"];

      // Skip if already processed
      if (this.processedDiseases.has(diseaseName)) {
        continue;
      }
      this.processedDiseases.add(diseaseName);

      // Create sheet name (remove special characters and limit length)
      const sheetName = diseaseName
        .replace(/[()]/g, "")
        .replace(/\//g, "-")
        .substring(0, 31);

      const diseaseSheet = workbook.addWorksheet(sheetName);
      await this.setupDiseaseSheet(diseaseSheet, diseaseRow, diseaseName);

      this.createdSheets.push({ target: disease, actual: diseaseName });
      console.log(`✓ Created sheet for: ${diseaseName}`);
    }

    // Update summary sheet
    this.updateSummarySheet(summarySheet);

    // Save workbook
    await workbook.xlsx.writeFile(this.outputPath);
    console.log(`\nAnalysis saved to: ${this.outputPath}`);
    console.log(
      `Complete analysis with ALL medications finished! File saved at: ${this.outputPath}`
    );

    return this.outputPath;
  }

  findDiseaseData(disease) {
    // Try exact match first
    let matches = this.diseaseData.filter((row) => {
      const englishName = row["Disease_Name_English"] || "";
      return englishName.toLowerCase() === disease.toLowerCase();
    });

    if (matches.length === 0) {
      console.log(
        `No exact match found for ${disease}, trying partial match...`
      );
      // Try partial match
      matches = this.diseaseData.filter((row) => {
        const englishName = row["Disease_Name_English"] || "";
        return englishName.toLowerCase().includes(disease.toLowerCase());
      });
    }

    return matches.length > 0 ? matches[0] : null;
  }

  createSummarySheet(worksheet) {
    // Header styling
    const headerFont = { bold: true, size: 16, color: { argb: "FFFFFFFF" } };
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E79" },
    };
    const subheaderFont = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    const subheaderFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5B9BD5" },
    };

    // Title
    worksheet.mergeCells("A1:D1");
    const titleCell = worksheet.getCell("A1");
    titleCell.value = "MAIN DISEASES COMPREHENSIVE ANALYSIS";
    titleCell.font = headerFont;
    titleCell.fill = headerFill;
    titleCell.alignment = { horizontal: "center", vertical: "center" };
    worksheet.getRow(1).height = 30;

    // Info section
    worksheet.getCell("A3").value = "Analysis Date:";
    worksheet.getCell("B3").value = new Date().toISOString().split("T")[0];
    worksheet.getCell("A4").value = "Source Data:";
    worksheet.getCell("B4").value =
      "final_diseases_complete.csv + drug_data_analysis.xlsx";
    worksheet.getCell("A5").value = "Total Target Diseases:";
    worksheet.getCell("B5").value = this.targetDiseases.length;

    // Target diseases header
    worksheet.mergeCells("A7:D7");
    const targetHeader = worksheet.getCell("A7");
    targetHeader.value = "TARGET DISEASES";
    targetHeader.font = subheaderFont;
    targetHeader.fill = subheaderFill;
    targetHeader.alignment = { horizontal: "center" };

    // Column headers
    const headers = ["Disease Name", "Status", "Matched Name", "Spanish Name"];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(8, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
    });

    // Add target diseases
    this.targetDiseases.forEach((disease, index) => {
      worksheet.getCell(9 + index, 1).value = disease;
      worksheet.getCell(9 + index, 2).value = "Processing...";
    });

    // Set column widths
    worksheet.getColumn(1).width = 30;
    worksheet.getColumn(2).width = 15;
    worksheet.getColumn(3).width = 35;
    worksheet.getColumn(4).width = 25;
  }

  updateSummarySheet(worksheet) {
    const successFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFC6EFCE" },
    };
    const failureFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFC7CE" },
    };

    this.targetDiseases.forEach((disease, index) => {
      const rowIndex = 9 + index;
      const createdSheet = this.createdSheets.find(
        (sheet) => sheet.target === disease
      );

      if (createdSheet) {
        worksheet.getCell(rowIndex, 2).value = "✓ Found";
        worksheet.getCell(rowIndex, 2).fill = successFill;
        worksheet.getCell(rowIndex, 3).value = createdSheet.actual;

        // Try to find Spanish name
        const diseaseRow = this.findDiseaseData(disease);
        if (diseaseRow && diseaseRow["Disease_Name_Spanish"]) {
          worksheet.getCell(rowIndex, 4).value =
            diseaseRow["Disease_Name_Spanish"];
        }
      } else {
        worksheet.getCell(rowIndex, 2).value = "❌ Not Found";
        worksheet.getCell(rowIndex, 2).fill = failureFill;
      }
    });

    // Update summary stats
    worksheet.getCell("A20").value = "SUMMARY STATISTICS";
    worksheet.getCell("A20").font = { bold: true, size: 12 };
    worksheet.getCell(
      "A21"
    ).value = `Diseases Successfully Processed: ${this.createdSheets.length}/${this.targetDiseases.length}`;
    worksheet.getCell("A22").value = `Success Rate: ${Math.round(
      (this.createdSheets.length / this.targetDiseases.length) * 100
    )}%`;
  }

  async setupDiseaseSheet(worksheet, diseaseRow, diseaseName) {
    // Header styling
    const headerFont = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
    const headerFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF366092" },
    };
    const subheaderFont = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    const subheaderFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5B9BD5" },
    };

    let currentRow = 1;

    // Disease Title
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const titleCell = worksheet.getCell(`A${currentRow}`);
    titleCell.value = `${diseaseName.toUpperCase()} - COMPREHENSIVE ANALYSIS`;
    titleCell.font = headerFont;
    titleCell.fill = headerFill;
    titleCell.alignment = { horizontal: "center", vertical: "center" };
    worksheet.getRow(currentRow).height = 25;
    currentRow += 2;

    // Disease Information
    worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
    const infoHeader = worksheet.getCell(`A${currentRow}`);
    infoHeader.value = "DISEASE INFORMATION";
    infoHeader.font = subheaderFont;
    infoHeader.fill = subheaderFill;
    infoHeader.alignment = { horizontal: "center" };
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = "English Name:";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`B${currentRow}`).value =
      diseaseRow["Disease_Name_English"] || "";
    currentRow++;

    worksheet.getCell(`A${currentRow}`).value = "Spanish Name:";
    worksheet.getCell(`A${currentRow}`).font = { bold: true };
    worksheet.getCell(`B${currentRow}`).value =
      diseaseRow["Disease_Name_Spanish"] || "";
    currentRow += 2;

    // Diagnosis Section
    currentRow = await this.addTextSection(
      worksheet,
      currentRow,
      "DIAGNOSIS",
      diseaseRow["Diagnosis"] || "No diagnosis information available"
    );

    // Treatment Section
    currentRow = await this.addTextSection(
      worksheet,
      currentRow,
      "TREATMENT",
      diseaseRow["Treatment"] || "No treatment information available"
    );

    // Tests Section
    currentRow = await this.addTextSection(
      worksheet,
      currentRow,
      "TESTS",
      diseaseRow["Tests"] || "No test information available"
    );

    // Medications Section
    currentRow = await this.addMedicationsSection(
      worksheet,
      currentRow,
      diseaseName
    );

    // Set column widths
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 25;
    worksheet.getColumn(3).width = 40;
    worksheet.getColumn(4).width = 40;
    worksheet.getColumn(5).width = 15;
    worksheet.getColumn(6).width = 15;
  }

  async addTextSection(worksheet, startRow, sectionTitle, content) {
    const subheaderFont = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    const subheaderFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5B9BD5" },
    };

    // Section header
    worksheet.mergeCells(`A${startRow}:F${startRow}`);
    const sectionHeader = worksheet.getCell(`A${startRow}`);
    sectionHeader.value = sectionTitle;
    sectionHeader.font = subheaderFont;
    sectionHeader.fill = subheaderFill;
    sectionHeader.alignment = { horizontal: "center" };
    startRow++;

    // Content
    const chunks = this.chunkText(content, 500);
    chunks.forEach((chunk) => {
      worksheet.getCell(`A${startRow}`).value = chunk;
      worksheet.getCell(`A${startRow}`).alignment = {
        wrapText: true,
        vertical: "top",
      };
      worksheet.mergeCells(`A${startRow}:F${startRow}`);
      worksheet.getRow(startRow).height = Math.max(
        30,
        Math.ceil(chunk.length / 100) * 15
      );
      startRow++;
    });

    return startRow + 1;
  }

  async addMedicationsSection(worksheet, startRow, diseaseName) {
    const subheaderFont = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };
    const subheaderFill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF5B9BD5" },
    };

    // Section header
    worksheet.mergeCells(`A${startRow}:F${startRow}`);
    const medicationHeader = worksheet.getCell(`A${startRow}`);
    medicationHeader.value = "MEDICATIONS & DRUGS - DETAILED INFORMATION";
    medicationHeader.font = subheaderFont;
    medicationHeader.fill = subheaderFill;
    medicationHeader.alignment = { horizontal: "center" };
    startRow++;

    // Get medications from disease data (from CSV)
    const diseaseRow = this.findDiseaseData(diseaseName);
    const medicationsText =
      diseaseRow && diseaseRow["Medications_Drugs"]
        ? diseaseRow["Medications_Drugs"]
        : "No medication information available";

    const medicationList =
      medicationsText &&
      medicationsText !== "No medication information available"
        ? medicationsText
            .split(";")
            .map((med) => med.trim())
            .filter((med) => med)
        : ["No medications listed"];

    // Column headers
    const headers = [
      "Medication Name",
      "What Is",
      "Side Effects",
      "Disease Tag",
    ];
    headers.forEach((header, index) => {
      const cell = worksheet.getCell(startRow, index + 1);
      cell.value = header;
      cell.font = { bold: true };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFD9E1F2" },
      };
    });
    startRow++;

    console.log(
      `Found ${medicationList.length} medications for ${diseaseName}`
    );

    // Add medication data
    medicationList.forEach((medName) => {
      const drugInfo = this.lookupDrugInfo(medName);

      worksheet.getCell(startRow, 1).value = medName;
      worksheet.getCell(startRow, 2).value = drugInfo.whatIs;
      worksheet.getCell(startRow, 3).value = drugInfo.sideEffects;
      worksheet.getCell(startRow, 4).value = diseaseName;

      // Set row height and text wrapping
      [2, 3].forEach((col) => {
        worksheet.getCell(startRow, col).alignment = {
          wrapText: true,
          vertical: "top",
        };
      });
      worksheet.getRow(startRow).height = 60;

      startRow++;
    });

    return startRow + 2;
  }

  lookupDrugInfo(medName) {
    if (!medName || medName === "No medications listed") {
      return {
        whatIs: "Information not available",
        sideEffects: "Side effects information not available",
      };
    }

    const cleanMedName = medName.trim().toLowerCase();

    // Try exact match first
    let exactMatch = this.drugData.find(
      (drug) => drug.drugName && drug.drugName.toLowerCase() === cleanMedName
    );

    if (exactMatch) {
      return {
        whatIs: this.truncateText(exactMatch.whatIs, 300),
        sideEffects: this.truncateText(exactMatch.sideEffects, 250),
      };
    }

    // Try partial match
    let partialMatch = this.drugData.find(
      (drug) =>
        drug.drugName && drug.drugName.toLowerCase().includes(cleanMedName)
    );

    if (partialMatch) {
      return {
        whatIs: this.truncateText(partialMatch.whatIs, 300),
        sideEffects: this.truncateText(partialMatch.sideEffects, 250),
      };
    }

    // If no match found, return default
    return {
      whatIs: "Information not available in database",
      sideEffects: "Side effects information not available",
    };
  }

  chunkText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return [text || ""];
    }

    const chunks = [];
    let currentChunk = "";
    const sentences = text.split(/[.!?]+/);

    sentences.forEach((sentence) => {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) return;

      const sentenceWithPeriod = trimmedSentence + ".";

      if (currentChunk.length + sentenceWithPeriod.length <= maxLength) {
        currentChunk += (currentChunk ? " " : "") + sentenceWithPeriod;
      } else {
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        currentChunk = sentenceWithPeriod;
      }
    });

    if (currentChunk) {
      chunks.push(currentChunk);
    }

    return chunks.length > 0 ? chunks : [text];
  }

  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) {
      return text || "";
    }

    // Try to truncate at sentence boundary
    const truncated = text.substring(0, maxLength);
    const lastSentenceEnd = Math.max(
      truncated.lastIndexOf("."),
      truncated.lastIndexOf("!"),
      truncated.lastIndexOf("?")
    );

    if (lastSentenceEnd > maxLength * 0.7) {
      return truncated.substring(0, lastSentenceEnd + 1);
    }

    // Truncate at word boundary
    const lastSpace = truncated.lastIndexOf(" ");
    if (lastSpace > maxLength * 0.8) {
      return truncated.substring(0, lastSpace) + "...";
    }

    return truncated + "...";
  }
}

// Main execution
async function main() {
  try {
    const analyzer = new MainDiseasesAnalyzer();
    await analyzer.loadData();
    await analyzer.createAnalysis();
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

// Export for use as module
module.exports = MainDiseasesAnalyzer;

// Run if called directly
if (require.main === module) {
  main();
}
