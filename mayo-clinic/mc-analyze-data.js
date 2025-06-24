const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

console.log("🔍 MEDICAL DATA ANALYSIS STARTING...");

// Helper function to clean cell text and prevent line breaks
function cleanCellText(text) {
  if (!text) return "";

  // Remove ALL invisible and control characters first
  let cleaned = text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "") // Control characters
    .replace(/[\r\n\t]/g, " ") // Line breaks and tabs
    .replace(/\u00A0/g, " ") // Non-breaking spaces
    .replace(/\u2028/g, " ") // Line separator
    .replace(/\u2029/g, " ") // Paragraph separator
    .replace(/\s+/g, " ") // Multiple spaces to single
    .trim();

  // Optional: Replace colons with arrows if still having issues
  // cleaned = cleaned.replace(/:/g, ' →');

  return cleaned;
}
// Function to parse CSV data
function parseCSV(filePath) {
  console.log(`📂 Reading CSV file: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf8");
  const lines = content.trim().split("\n");

  // Get headers from first line
  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine);

  const data = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;

    // Parse each line properly
    const values = parseCSVLine(lines[i]);

    // Create an object from headers and values
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      // Clean up quotes, extra whitespace, AND invisible characters
      let value = values[j] ? values[j].replace(/^"|"$/g, "").trim() : "";

      // Remove ALL invisible characters and control characters
      value = value
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "") // Remove control characters
        .replace(/[\r\n\t]/g, " ") // Replace line breaks and tabs with spaces
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .trim();

      row[headers[j]] = value;
    }

    data.push(row);
  }

  console.log(`✅ Successfully parsed ${data.length} records`);
  return data;
}

// Helper function to properly parse a CSV line (handles multi-line quoted fields)
function parseCSVLine(line) {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Handle escaped quotes ("") within quoted fields
        current += '"';
        i++; // Skip the next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Found field separator outside of quotes
      values.push(current);
      current = "";
    } else {
      // Regular character (including colons, semicolons, newlines within quotes)
      current += char;
    }
  }

  // Add the last field
  values.push(current);

  return values;
}

// Updated parseCSV function to handle multi-line fields
function parseCSV(filePath) {
  console.log(`📂 Reading CSV file: ${filePath}`);
  const content = fs.readFileSync(filePath, "utf8");

  // Don't split by lines immediately - we need to handle multi-line quoted fields
  const rows = [];
  let currentRow = "";
  let inQuotes = false;

  // Process character by character to properly handle quoted multi-line fields
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        currentRow += '""';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
        currentRow += char;
      }
    } else if (char === "\n" && !inQuotes) {
      // End of row (only if not inside quotes)
      if (currentRow.trim()) {
        rows.push(currentRow.trim());
      }
      currentRow = "";
    } else {
      currentRow += char;
    }
  }

  // Add the last row if it exists
  if (currentRow.trim()) {
    rows.push(currentRow.trim());
  }

  if (rows.length === 0) {
    throw new Error("No data found in CSV file");
  }

  // Get headers from first row
  const headers = parseCSVLine(rows[0]);

  const data = [];
  for (let i = 1; i < rows.length; i++) {
    // Parse each row properly
    const values = parseCSVLine(rows[i]);

    // Create an object from headers and values
    const row = {};
    for (let j = 0; j < headers.length; j++) {
      // Clean up quotes, extra whitespace, AND invisible characters
      let value = values[j] ? values[j].replace(/^"|"$/g, "").trim() : "";

      // Remove ALL invisible characters and control characters
      value = value
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, "") // Remove control characters
        .replace(/[\r\n\t]/g, " ") // Replace line breaks and tabs with spaces
        .replace(/\s+/g, " ") // Replace multiple spaces with single space
        .trim();

      row[headers[j]] = value;
    }

    data.push(row);
  }

  console.log(`✅ Successfully parsed ${data.length} records`);
  return data;
}

// Function to extract and count items from a semicolon-separated list
function extractAndCountItems(data, fieldName) {
  const itemCounts = {};
  const itemsByDisease = {};

  console.log(`🔢 Counting items in field: ${fieldName}`);

  data.forEach((row) => {
    const diseaseName = row.Disease;
    const itemsText = row[fieldName];

    // Skip rows with errors or missing data
    if (
      !itemsText ||
      itemsText.toLowerCase().includes("error") ||
      itemsText.toLowerCase().includes("not found")
    ) {
      return;
    }

    // Split by semicolon and trim each item
    const items = itemsText
      .split(";")
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    // Add to disease-specific tracking
    itemsByDisease[diseaseName] = items;

    // Count each item
    items.forEach((item) => {
      itemCounts[item] = (itemCounts[item] || 0) + 1;
    });
  });

  // Sort items by count (descending)
  const sortedItems = Object.entries(itemCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([item, count]) => ({ item, count }));

  console.log(`📊 Found ${sortedItems.length} unique items in ${fieldName}`);

  return {
    counts: sortedItems,
    byDisease: itemsByDisease,
  };
}

// Function to create the Excel report
async function createExcelReport(
  data,
  medications,
  treatments,
  tests,
  outputPath
) {
  console.log("📊 Creating Excel report...");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Mayo Clinic Data Analyzer";
  workbook.created = new Date();

  // 1. Full Data Sheet
  console.log("📝 Creating Full Data sheet");
  const fullDataSheet = workbook.addWorksheet("Full Data");

  // Add headers
  const headers = Object.keys(data[0]);
  fullDataSheet.addRow(headers);

  // Add data rows with cleaned text
  data.forEach((row) => {
    fullDataSheet.addRow(headers.map((header) => cleanCellText(row[header])));
  });

  // Format headers
  const headerRow = fullDataSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // Auto-size columns (approximate)
  headers.forEach((_, i) => {
    const column = fullDataSheet.getColumn(i + 1);
    column.width = 30;
  });

  // 2. Medications Analysis Sheet
  console.log("💊 Creating Medications Analysis sheet");
  const medsSheet = workbook.addWorksheet("Medications Analysis");
  medsSheet.addRow(["Medication", "Count", "Percentage of Diseases"]);

  medications.counts.forEach(({ item, count }) => {
    const percentage = ((count / data.length) * 100).toFixed(2);
    medsSheet.addRow([cleanCellText(item), count, `${percentage}%`]);
  });

  // Format headers
  const medsHeaderRow = medsSheet.getRow(1);
  medsHeaderRow.font = { bold: true };
  medsHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // Add summary section
  medsSheet.addRow([]);
  medsSheet.addRow(["SUMMARY STATISTICS"]);
  medsSheet.addRow(["Total Unique Medications", medications.counts.length]);
  medsSheet.addRow([
    "Most Common Medication",
    cleanCellText(medications.counts[0]?.item) || "None",
  ]);
  medsSheet.addRow([
    "Diseases with No Medications",
    data.length - Object.keys(medications.byDisease).length,
  ]);

  // 3. Treatments Analysis Sheet
  console.log("🩺 Creating Treatments Analysis sheet");
  const treatmentsSheet = workbook.addWorksheet("Treatments Analysis");
  treatmentsSheet.addRow(["Treatment", "Count", "Percentage of Diseases"]);

  treatments.counts.forEach(({ item, count }) => {
    const percentage = ((count / data.length) * 100).toFixed(2);
    treatmentsSheet.addRow([cleanCellText(item), count, `${percentage}%`]);
  });

  // Format headers
  const treatmentsHeaderRow = treatmentsSheet.getRow(1);
  treatmentsHeaderRow.font = { bold: true };
  treatmentsHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // Add summary section
  treatmentsSheet.addRow([]);
  treatmentsSheet.addRow(["SUMMARY STATISTICS"]);
  treatmentsSheet.addRow(["Total Unique Treatments", treatments.counts.length]);
  treatmentsSheet.addRow([
    "Most Common Treatment",
    cleanCellText(treatments.counts[0]?.item) || "None",
  ]);
  treatmentsSheet.addRow([
    "Diseases with No Treatments",
    data.length - Object.keys(treatments.byDisease).length,
  ]);

  // 4. Tests Analysis Sheet
  console.log("🔬 Creating Tests Analysis sheet");
  const testsSheet = workbook.addWorksheet("Tests Analysis");
  testsSheet.addRow(["Test", "Count", "Percentage of Diseases"]);

  tests.counts.forEach(({ item, count }) => {
    const percentage = ((count / data.length) * 100).toFixed(2);
    testsSheet.addRow([cleanCellText(item), count, `${percentage}%`]);
  });

  // Format headers
  const testsHeaderRow = testsSheet.getRow(1);
  testsHeaderRow.font = { bold: true };
  testsHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // Add summary section
  testsSheet.addRow([]);
  testsSheet.addRow(["SUMMARY STATISTICS"]);
  testsSheet.addRow(["Total Unique Tests", tests.counts.length]);
  testsSheet.addRow([
    "Most Common Test",
    cleanCellText(tests.counts[0]?.item) || "None",
  ]);
  testsSheet.addRow([
    "Diseases with No Tests",
    data.length - Object.keys(tests.byDisease).length,
  ]);

  // 5. Summary Sheet
  console.log("📈 Creating Summary sheet");
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.addRow(["Mayo Clinic Medical Data Analysis"]);
  summarySheet.addRow(["Date Generated", new Date().toLocaleString()]);
  summarySheet.addRow([]);

  summarySheet.addRow(["OVERALL STATISTICS"]);
  summarySheet.addRow(["Total Diseases Analyzed", data.length]);
  summarySheet.addRow(["Unique Medications", medications.counts.length]);
  summarySheet.addRow(["Unique Treatments", treatments.counts.length]);
  summarySheet.addRow(["Unique Tests", tests.counts.length]);
  summarySheet.addRow([]);

  summarySheet.addRow(["TOP 10 MEDICATIONS"]);
  summarySheet.addRow(["Medication", "Count", "Percentage"]);
  medications.counts.slice(0, 10).forEach(({ item, count }) => {
    const percentage = ((count / data.length) * 100).toFixed(2);
    summarySheet.addRow([cleanCellText(item), count, `${percentage}%`]);
  });
  summarySheet.addRow([]);

  summarySheet.addRow(["TOP 10 TREATMENTS"]);
  summarySheet.addRow(["Treatment", "Count", "Percentage"]);
  treatments.counts.slice(0, 10).forEach(({ item, count }) => {
    const percentage = ((count / data.length) * 100).toFixed(2);
    summarySheet.addRow([cleanCellText(item), count, `${percentage}%`]);
  });
  summarySheet.addRow([]);

  summarySheet.addRow(["TOP 10 TESTS"]);
  summarySheet.addRow(["Test", "Count", "Percentage"]);
  tests.counts.slice(0, 10).forEach(({ item, count }) => {
    const percentage = ((count / data.length) * 100).toFixed(2);
    summarySheet.addRow([cleanCellText(item), count, `${percentage}%`]);
  });

  // Format summary sheet
  summarySheet.getRow(1).font = { bold: true, size: 16 };

  // 6. Detailed Statistics Sheet
  console.log("📈 Creating Detailed Statistics sheet");
  const statsSheet = workbook.addWorksheet("Detailed Statistics");

  // Header
  statsSheet.addRow(["DETAILED MEDICAL DATA STATISTICS"]);
  statsSheet.getRow(1).font = { bold: true, size: 16 };
  statsSheet.addRow([`Analysis Date: ${new Date().toLocaleString()}`]);
  statsSheet.addRow([]);

  // Disease Statistics
  statsSheet.addRow(["DISEASE STATISTICS"]);
  statsSheet.getRow(4).font = { bold: true };

  // Calculate diseases with most/least items
  const diseaseMedCounts = Object.keys(medications.byDisease)
    .map((disease) => ({
      disease,
      count: medications.byDisease[disease].length,
    }))
    .sort((a, b) => b.count - a.count);

  const diseaseTreatmentCounts = Object.keys(treatments.byDisease)
    .map((disease) => ({
      disease,
      count: treatments.byDisease[disease].length,
    }))
    .sort((a, b) => b.count - a.count);

  const diseaseTestCounts = Object.keys(tests.byDisease)
    .map((disease) => ({
      disease,
      count: tests.byDisease[disease].length,
    }))
    .sort((a, b) => b.count - a.count);

  statsSheet.addRow([
    "Disease with most medications",
    diseaseMedCounts.length > 0
      ? `${diseaseMedCounts[0].disease} (${diseaseMedCounts[0].count})`
      : "None",
  ]);

  statsSheet.addRow([
    "Disease with most treatments",
    diseaseTreatmentCounts.length > 0
      ? `${diseaseTreatmentCounts[0].disease} (${diseaseTreatmentCounts[0].count})`
      : "None",
  ]);

  statsSheet.addRow([
    "Disease with most tests",
    diseaseTestCounts.length > 0
      ? `${diseaseTestCounts[0].disease} (${diseaseTestCounts[0].count})`
      : "None",
  ]);

  // Calculate averages
  const avgMedsPerDisease =
    diseaseMedCounts.reduce((sum, item) => sum + item.count, 0) /
    (diseaseMedCounts.length || 1);

  const avgTreatmentsPerDisease =
    diseaseTreatmentCounts.reduce((sum, item) => sum + item.count, 0) /
    (diseaseTreatmentCounts.length || 1);

  const avgTestsPerDisease =
    diseaseTestCounts.reduce((sum, item) => sum + item.count, 0) /
    (diseaseTestCounts.length || 1);

  statsSheet.addRow([
    "Average medications per disease",
    avgMedsPerDisease.toFixed(2),
  ]);
  statsSheet.addRow([
    "Average treatments per disease",
    avgTreatmentsPerDisease.toFixed(2),
  ]);
  statsSheet.addRow([
    "Average tests per disease",
    avgTestsPerDisease.toFixed(2),
  ]);
  statsSheet.addRow([]);

  // Medication Statistics
  statsSheet.addRow(["MEDICATION STATISTICS"]);
  statsSheet.getRow(statsSheet.rowCount).font = { bold: true };

  // Calculate rarity/prevalence
  const medRarity = {
    veryCommon: medications.counts.filter((m) => m.count / data.length > 0.2)
      .length,
    common: medications.counts.filter(
      (m) => m.count / data.length > 0.1 && m.count / data.length <= 0.2
    ).length,
    uncommon: medications.counts.filter(
      (m) => m.count / data.length > 0.05 && m.count / data.length <= 0.1
    ).length,
    rare: medications.counts.filter((m) => m.count / data.length <= 0.05)
      .length,
    unique: medications.counts.filter((m) => m.count === 1).length,
  };

  statsSheet.addRow([
    "Very common medications (>20% of diseases)",
    medRarity.veryCommon,
  ]);
  statsSheet.addRow([
    "Common medications (10-20% of diseases)",
    medRarity.common,
  ]);
  statsSheet.addRow([
    "Uncommon medications (5-10% of diseases)",
    medRarity.uncommon,
  ]);
  statsSheet.addRow(["Rare medications (<5% of diseases)", medRarity.rare]);
  statsSheet.addRow(["Unique medications (only 1 disease)", medRarity.unique]);
  statsSheet.addRow([]);

  // Treatment Statistics
  statsSheet.addRow(["TREATMENT STATISTICS"]);
  statsSheet.getRow(statsSheet.rowCount).font = { bold: true };

  const treatRarity = {
    veryCommon: treatments.counts.filter((t) => t.count / data.length > 0.2)
      .length,
    common: treatments.counts.filter(
      (t) => t.count / data.length > 0.1 && t.count / data.length <= 0.2
    ).length,
    uncommon: treatments.counts.filter(
      (t) => t.count / data.length > 0.05 && t.count / data.length <= 0.1
    ).length,
    rare: treatments.counts.filter((t) => t.count / data.length <= 0.05).length,
    unique: treatments.counts.filter((t) => t.count === 1).length,
  };

  statsSheet.addRow([
    "Very common treatments (>20% of diseases)",
    treatRarity.veryCommon,
  ]);
  statsSheet.addRow([
    "Common treatments (10-20% of diseases)",
    treatRarity.common,
  ]);
  statsSheet.addRow([
    "Uncommon treatments (5-10% of diseases)",
    treatRarity.uncommon,
  ]);
  statsSheet.addRow(["Rare treatments (<5% of diseases)", treatRarity.rare]);
  statsSheet.addRow(["Unique treatments (only 1 disease)", treatRarity.unique]);
  statsSheet.addRow([]);

  // Test Statistics
  statsSheet.addRow(["TEST STATISTICS"]);
  statsSheet.getRow(statsSheet.rowCount).font = { bold: true };

  const testRarity = {
    veryCommon: tests.counts.filter((t) => t.count / data.length > 0.2).length,
    common: tests.counts.filter(
      (t) => t.count / data.length > 0.1 && t.count / data.length <= 0.2
    ).length,
    uncommon: tests.counts.filter(
      (t) => t.count / data.length > 0.05 && t.count / data.length <= 0.1
    ).length,
    rare: tests.counts.filter((t) => t.count / data.length <= 0.05).length,
    unique: tests.counts.filter((t) => t.count === 1).length,
  };

  statsSheet.addRow([
    "Very common tests (>20% of diseases)",
    testRarity.veryCommon,
  ]);
  statsSheet.addRow(["Common tests (10-20% of diseases)", testRarity.common]);
  statsSheet.addRow([
    "Uncommon tests (5-10% of diseases)",
    testRarity.uncommon,
  ]);
  statsSheet.addRow(["Rare tests (<5% of diseases)", testRarity.rare]);
  statsSheet.addRow(["Unique tests (only 1 disease)", testRarity.unique]);
  statsSheet.addRow([]);

  // Correlation Data - Top diseases with multiple treatments/tests/medications
  statsSheet.addRow(["CORRELATION DATA"]);
  statsSheet.getRow(statsSheet.rowCount).font = { bold: true };

  // Find diseases with comprehensive treatment (many tests, treatments and meds)
  const comprehensiveTreatmentDiseases = [];

  data.forEach((row) => {
    const disease = row.Disease;
    const medCount = medications.byDisease[disease]?.length || 0;
    const treatCount = treatments.byDisease[disease]?.length || 0;
    const testCount = tests.byDisease[disease]?.length || 0;

    const totalItems = medCount + treatCount + testCount;

    if (totalItems > 0) {
      comprehensiveTreatmentDiseases.push({
        disease,
        totalItems,
        medCount,
        treatCount,
        testCount,
      });
    }
  });

  comprehensiveTreatmentDiseases.sort((a, b) => b.totalItems - a.totalItems);

  statsSheet.addRow([
    "Disease",
    "Total Items",
    "Medications",
    "Treatments",
    "Tests",
  ]);

  // Show top 10 most comprehensively treated diseases
  comprehensiveTreatmentDiseases.slice(0, 10).forEach((item) => {
    statsSheet.addRow([
      cleanCellText(item.disease),
      item.totalItems,
      item.medCount,
      item.treatCount,
      item.testCount,
    ]);
  });

  // Format correlation data table
  const tableStartRow = statsSheet.rowCount - 10;
  const tableEndRow = statsSheet.rowCount;

  for (let i = tableStartRow; i <= tableEndRow; i++) {
    const row = statsSheet.getRow(i);
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });
  }

  // Header row for correlation data
  const correlationHeaderRow = statsSheet.getRow(tableStartRow);
  correlationHeaderRow.font = { bold: true };
  correlationHeaderRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // Auto-sizing for all columns in stats sheet
  for (let i = 1; i <= 5; i++) {
    statsSheet.getColumn(i).width = i === 1 ? 40 : 20;
  }

  // Save the workbook
  console.log(`💾 Saving Excel file to: ${outputPath}`);
  await workbook.xlsx.writeFile(outputPath);
  console.log("✅ Excel report created successfully!");
}

// Main function
async function main() {
  try {
    // Input and output paths
    const inputCsvPath = path.resolve(
      __dirname,
      "../CSV/diagnosis_treatment_data_final.csv"
    );
    const outputXlsxPath = path.resolve(
      __dirname,
      "../Analysis/medical_data_analysis.xlsx"
    );

    // Create analysis directory if it doesn't exist
    const analysisDir = path.dirname(outputXlsxPath);
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
      console.log(`📁 Created directory: ${analysisDir}`);
    }

    // Parse CSV
    const data = parseCSV(inputCsvPath);

    if (data.length === 0) {
      throw new Error("No data found in CSV file");
    }

    console.log(`🧪 Analyzing ${data.length} diseases...`);

    // Extract and count medications, treatments, tests
    const medications = extractAndCountItems(data, "Medications");
    const treatments = extractAndCountItems(data, "Treatment");
    const tests = extractAndCountItems(data, "Tests");

    // Log top items
    console.log("\n📊 TOP 5 MEDICATIONS:");
    medications.counts.slice(0, 5).forEach(({ item, count }) => {
      console.log(`   - ${item}: ${count} diseases`);
    });

    console.log("\n📊 TOP 5 TREATMENTS:");
    treatments.counts.slice(0, 5).forEach(({ item, count }) => {
      console.log(`   - ${item}: ${count} diseases`);
    });

    console.log("\n📊 TOP 5 TESTS:");
    tests.counts.slice(0, 5).forEach(({ item, count }) => {
      console.log(`   - ${item}: ${count} diseases`);
    });

    // Create Excel report
    await createExcelReport(
      data,
      medications,
      treatments,
      tests,
      outputXlsxPath
    );

    console.log(`\n🎉 ANALYSIS COMPLETE!`);
    console.log(`📊 Excel report saved to: ${outputXlsxPath}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    console.error(error);
  }
}

// Execute the script
main();
