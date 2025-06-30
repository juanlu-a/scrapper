const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

console.log("🔍 DISEASES & DRUG FAMILIES ANALYSIS STARTING...");

// Helper function to clean cell text
function cleanCellText(text) {
  if (!text) return "";
  return text
    .replace(/[\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Helper function to parse CSV line
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      values.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

// Function to parse CSV data
function parseCSV(filePath) {
  console.log(`📂 Reading CSV file: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");

  if (lines.length === 0) {
    throw new Error("CSV file is empty");
  }

  const headers = parseCSVLine(lines[0]);
  const data = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    const values = parseCSVLine(lines[i]);
    const row = {};

    for (let j = 0; j < headers.length; j++) {
      const value = values[j] ? values[j].replace(/^"|"$/g, "").trim() : "";
      row[headers[j]] = cleanCellText(value);
    }

    data.push(row);
  }

  console.log(`✅ Successfully parsed ${data.length} records`);
  return data;
}

// Function to analyze diseases and drug families
function analyzeDiseasesDrugs(diseasesDrugsData) {
  console.log("🔄 Analyzing diseases and drug families...");

  // Drug families analysis
  const familyCounts = {};
  const familyToDiseases = {};
  const familyToDrugs = {};

  // Diseases analysis
  const diseaseCounts = {};
  const diseaseToFamilies = {};
  const diseaseToDrugs = {};

  // Drugs analysis
  const drugCounts = {};
  const drugToFamilies = {};
  const drugToDiseases = {};

  diseasesDrugsData.forEach((row) => {
    const disease = row.Disease || row.disease;
    const drugFamily = row.Drug_Family || row.drug_family;
    const drugName = row.Drug_Name || row.drug_name;

    if (!disease || !drugFamily || !drugName) return;

    // Drug families analysis
    familyCounts[drugFamily] = (familyCounts[drugFamily] || 0) + 1;

    if (!familyToDiseases[drugFamily]) {
      familyToDiseases[drugFamily] = new Set();
    }
    familyToDiseases[drugFamily].add(disease);

    if (!familyToDrugs[drugFamily]) {
      familyToDrugs[drugFamily] = new Set();
    }
    familyToDrugs[drugFamily].add(drugName);

    // Diseases analysis
    diseaseCounts[disease] = (diseaseCounts[disease] || 0) + 1;

    if (!diseaseToFamilies[disease]) {
      diseaseToFamilies[disease] = new Set();
    }
    diseaseToFamilies[disease].add(drugFamily);

    if (!diseaseToDrugs[disease]) {
      diseaseToDrugs[disease] = new Set();
    }
    diseaseToDrugs[disease].add(drugName);

    // Drugs analysis
    drugCounts[drugName] = (drugCounts[drugName] || 0) + 1;

    if (!drugToFamilies[drugName]) {
      drugToFamilies[drugName] = new Set();
    }
    drugToFamilies[drugName].add(drugFamily);

    if (!drugToDiseases[drugName]) {
      drugToDiseases[drugName] = new Set();
    }
    drugToDiseases[drugName].add(disease);
  });

  // Convert Sets to arrays and sort by frequency
  const sortedFamilies = Object.entries(familyCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([family, count]) => ({
      family,
      count,
      diseases: Array.from(familyToDiseases[family] || []),
      drugs: Array.from(familyToDrugs[family] || []),
      uniqueDiseases: (familyToDiseases[family] || new Set()).size,
      uniqueDrugs: (familyToDrugs[family] || new Set()).size,
    }));

  const sortedDiseases = Object.entries(diseaseCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([disease, count]) => ({
      disease,
      count,
      families: Array.from(diseaseToFamilies[disease] || []),
      drugs: Array.from(diseaseToDrugs[disease] || []),
      uniqueFamilies: (diseaseToFamilies[disease] || new Set()).size,
      uniqueDrugs: (diseaseToDrugs[disease] || new Set()).size,
    }));

  const sortedDrugs = Object.entries(drugCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([drug, count]) => ({
      drug,
      count,
      families: Array.from(drugToFamilies[drug] || []),
      diseases: Array.from(drugToDiseases[drug] || []),
      uniqueFamilies: (drugToFamilies[drug] || new Set()).size,
      uniqueDiseases: (drugToDiseases[drug] || new Set()).size,
    }));

  console.log(`✅ Analysis complete:`);
  console.log(`   📋 Unique drug families: ${sortedFamilies.length}`);
  console.log(`   🏥 Unique diseases: ${sortedDiseases.length}`);
  console.log(`   💊 Unique drugs: ${sortedDrugs.length}`);

  return {
    families: sortedFamilies,
    diseases: sortedDiseases,
    drugs: sortedDrugs,
  };
}

// Function to create Excel report
async function createExcelReport(diseasesDrugsData, analysis, outputPath) {
  console.log("📊 Creating Excel report...");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Diseases & Drug Families Analyzer";
  workbook.created = new Date();

  // 1. Raw Data Sheet
  console.log("📝 Creating Raw Data sheet");
  const rawDataSheet = workbook.addWorksheet("Raw Data");

  // Add headers
  const headers = Object.keys(diseasesDrugsData[0]);
  rawDataSheet.addRow(headers);

  // Add data
  diseasesDrugsData.forEach((row) => {
    rawDataSheet.addRow(headers.map((header) => cleanCellText(row[header])));
  });

  // Format headers
  const headerRow = rawDataSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // Auto-size columns
  headers.forEach((_, i) => {
    rawDataSheet.getColumn(i + 1).width = 25;
  });

  // 2. Drug Families Analysis Sheet
  console.log("🏷️ Creating Drug Families Analysis sheet");
  const familiesSheet = workbook.addWorksheet("Drug Families Analysis");
  familiesSheet.columns = [
    { header: "Drug Family", key: "family", width: 40 },
    { header: "Total Uses", key: "count", width: 15 },
    { header: "Unique Diseases", key: "uniqueDiseases", width: 15 },
    { header: "Unique Drugs", key: "uniqueDrugs", width: 15 },
    { header: "Sample Diseases", key: "sampleDiseases", width: 50 },
    { header: "Sample Drugs", key: "sampleDrugs", width: 50 },
  ];

  analysis.families.forEach((item) => {
    familiesSheet.addRow({
      family: item.family,
      count: item.count,
      uniqueDiseases: item.uniqueDiseases,
      uniqueDrugs: item.uniqueDrugs,
      sampleDiseases:
        item.diseases.slice(0, 3).join(", ") +
        (item.diseases.length > 3 ? "..." : ""),
      sampleDrugs:
        item.drugs.slice(0, 3).join(", ") +
        (item.drugs.length > 3 ? "..." : ""),
    });
  });

  // Format headers
  const familiesHeader = familiesSheet.getRow(1);
  familiesHeader.font = { bold: true };
  familiesHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // 3. Diseases Analysis Sheet
  console.log("🏥 Creating Diseases Analysis sheet");
  const diseasesSheet = workbook.addWorksheet("Diseases Analysis");
  diseasesSheet.columns = [
    { header: "Disease", key: "disease", width: 40 },
    { header: "Total Drug Entries", key: "count", width: 15 },
    { header: "Unique Families", key: "uniqueFamilies", width: 15 },
    { header: "Unique Drugs", key: "uniqueDrugs", width: 15 },
    { header: "Sample Families", key: "sampleFamilies", width: 50 },
    { header: "Sample Drugs", key: "sampleDrugs", width: 50 },
  ];

  analysis.diseases.forEach((item) => {
    diseasesSheet.addRow({
      disease: item.disease,
      count: item.count,
      uniqueFamilies: item.uniqueFamilies,
      uniqueDrugs: item.uniqueDrugs,
      sampleFamilies:
        item.families.slice(0, 3).join(", ") +
        (item.families.length > 3 ? "..." : ""),
      sampleDrugs:
        item.drugs.slice(0, 3).join(", ") +
        (item.drugs.length > 3 ? "..." : ""),
    });
  });

  // Format headers
  const diseasesHeader = diseasesSheet.getRow(1);
  diseasesHeader.font = { bold: true };
  diseasesHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // 4. Drugs Analysis Sheet
  console.log("💊 Creating Drugs Analysis sheet");
  const drugsSheet = workbook.addWorksheet("Drugs Analysis");
  drugsSheet.columns = [
    { header: "Drug Name", key: "drug", width: 30 },
    { header: "Total Uses", key: "count", width: 15 },
    { header: "Unique Families", key: "uniqueFamilies", width: 15 },
    { header: "Unique Diseases", key: "uniqueDiseases", width: 15 },
    { header: "Sample Families", key: "sampleFamilies", width: 40 },
    { header: "Sample Diseases", key: "sampleDiseases", width: 50 },
  ];

  analysis.drugs.forEach((item) => {
    drugsSheet.addRow({
      drug: item.drug,
      count: item.count,
      uniqueFamilies: item.uniqueFamilies,
      uniqueDiseases: item.uniqueDiseases,
      sampleFamilies:
        item.families.slice(0, 2).join(", ") +
        (item.families.length > 2 ? "..." : ""),
      sampleDiseases:
        item.diseases.slice(0, 2).join(", ") +
        (item.diseases.length > 2 ? "..." : ""),
    });
  });

  // Format headers
  const drugsHeader = drugsSheet.getRow(1);
  drugsHeader.font = { bold: true };
  drugsHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // 5. Summary & Statistics Sheet
  console.log("📈 Creating Summary sheet");
  const summarySheet = workbook.addWorksheet("Summary & Statistics");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 40 },
    { header: "Value", key: "value", width: 40 },
  ];

  // Add summary statistics
  summarySheet.addRow({
    metric: "Diseases & Drug Families Data Analysis",
    value: "",
  });
  summarySheet.addRow({
    metric: "Analysis Date",
    value: new Date().toLocaleString(),
  });
  summarySheet.addRow({ metric: "", value: "" });

  summarySheet.addRow({ metric: "OVERALL STATISTICS", value: "" });
  summarySheet.addRow({
    metric: "Total Disease-Drug Relationships",
    value: diseasesDrugsData.length,
  });
  summarySheet.addRow({
    metric: "Unique Diseases",
    value: analysis.diseases.length,
  });
  summarySheet.addRow({
    metric: "Unique Drug Families",
    value: analysis.families.length,
  });
  summarySheet.addRow({ metric: "Unique Drugs", value: analysis.drugs.length });
  summarySheet.addRow({ metric: "", value: "" });

  summarySheet.addRow({ metric: "TOP 10 DRUG FAMILIES BY USAGE", value: "" });
  analysis.families.slice(0, 10).forEach((item, index) => {
    summarySheet.addRow({
      metric: `${index + 1}. ${item.family}`,
      value: `${item.count} uses across ${item.uniqueDiseases} diseases`,
    });
  });
  summarySheet.addRow({ metric: "", value: "" });

  summarySheet.addRow({ metric: "TOP 10 DISEASES BY DRUG COUNT", value: "" });
  analysis.diseases.slice(0, 10).forEach((item, index) => {
    summarySheet.addRow({
      metric: `${index + 1}. ${item.disease}`,
      value: `${item.uniqueDrugs} drugs from ${item.uniqueFamilies} families`,
    });
  });
  summarySheet.addRow({ metric: "", value: "" });

  summarySheet.addRow({ metric: "TOP 10 MOST VERSATILE DRUGS", value: "" });
  analysis.drugs.slice(0, 10).forEach((item, index) => {
    summarySheet.addRow({
      metric: `${index + 1}. ${item.drug}`,
      value: `Used for ${item.uniqueDiseases} diseases`,
    });
  });

  // Format summary headers
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = { bold: true, size: 16 };

  // Style section headers
  [4, 11, 22, 33].forEach((rowIndex) => {
    if (summarySheet.getRow(rowIndex)) {
      const row = summarySheet.getRow(rowIndex);
      row.font = { bold: true };
      row.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE0E0E0" },
      };
    }
  });

  // Save the workbook
  console.log(`💾 Saving Excel file to: ${outputPath}`);
  await workbook.xlsx.writeFile(outputPath);
  console.log("✅ Excel report created successfully!");
}

// Main function
async function main() {
  try {
    // Input and output paths
    const diseasesDrugsPath = path.resolve(
      __dirname,
      "../CSV/diseases_drugs_families.csv"
    );
    const outputPath = path.resolve(
      __dirname,
      "../Analysis/diseases_drugs_families_analysis.xlsx"
    );

    // Create analysis directory if it doesn't exist
    const analysisDir = path.dirname(outputPath);
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
      console.log(`📁 Created directory: ${analysisDir}`);
    }

    // Check if the diseases-drugs CSV exists
    if (!fs.existsSync(diseasesDrugsPath)) {
      throw new Error(
        `Diseases-drugs CSV file not found: ${diseasesDrugsPath}\nPlease run drugs-diseases-scrapper.js first!`
      );
    }

    // Parse the diseases-drugs data
    const diseasesDrugsData = parseCSV(diseasesDrugsPath);

    if (diseasesDrugsData.length === 0) {
      throw new Error("No data found in diseases-drugs CSV file");
    }

    console.log(
      `🧪 Analyzing ${diseasesDrugsData.length} disease-drug relationships...`
    );

    // Analyze the data
    const analysis = analyzeDiseasesDrugs(diseasesDrugsData);

    // Show top results in console
    console.log("\n📊 TOP 5 DRUG FAMILIES:");
    analysis.families
      .slice(0, 5)
      .forEach(({ family, count, uniqueDiseases }) => {
        console.log(
          `   - ${family}: ${count} uses across ${uniqueDiseases} diseases`
        );
      });

    console.log("\n📊 TOP 5 DISEASES BY DRUG COUNT:");
    analysis.diseases
      .slice(0, 5)
      .forEach(({ disease, uniqueDrugs, uniqueFamilies }) => {
        console.log(
          `   - ${disease}: ${uniqueDrugs} drugs from ${uniqueFamilies} families`
        );
      });

    console.log("\n📊 TOP 5 MOST VERSATILE DRUGS:");
    analysis.drugs.slice(0, 5).forEach(({ drug, uniqueDiseases }) => {
      console.log(`   - ${drug}: used for ${uniqueDiseases} diseases`);
    });

    // Create Excel report
    await createExcelReport(diseasesDrugsData, analysis, outputPath);

    console.log(`\n🎉 ANALYSIS COMPLETE!`);
    console.log(`📊 Excel report saved to: ${outputPath}`);
    console.log(`\n📈 Key Insights:`);
    console.log(
      `   🏷️ Most common drug family: ${analysis.families[0]?.family || "N/A"}`
    );
    console.log(
      `   🏥 Disease with most drugs: ${analysis.diseases[0]?.disease || "N/A"}`
    );
    console.log(
      `   💊 Most versatile drug: ${analysis.drugs[0]?.drug || "N/A"}`
    );
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

// Execute the script
main();
