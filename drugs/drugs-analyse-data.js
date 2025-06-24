const fs = require("fs");
const path = require("path");
const ExcelJS = require("exceljs");

console.log("🔍 DRUG DATA ANALYSIS STARTING...");

// Function to read and parse the JSON data
function loadDrugData(filePath) {
  console.log(`📂 Reading drugs JSON file: ${filePath}`);
  try {
    const data = fs.readFileSync(filePath, "utf8");
    const drugData = JSON.parse(data);
    console.log(
      `✅ Successfully loaded data for ${Object.keys(drugData).length} drugs`
    );
    return drugData;
  } catch (error) {
    console.error(`❌ Error loading JSON data: ${error.message}`);
    throw error;
  }
}

// Function to extract and analyze side effects
function analyzeSideEffects(drugData) {
  console.log("🔄 Analyzing side effects across all drugs...");

  const sideEffectsMap = {};
  const drugToSideEffects = {};
  const commonPhrases = [
    "get emergency medical help if you have",
    "call your doctor at once if you have",
    "seek medical attention",
    "stop using",
    "common side effects",
    "this is not a complete list of side effects",
  ];

  // Extract common side effects and track which drugs have them
  Object.entries(drugData).forEach(([drugName, data]) => {
    if (!data.side_effects || data.side_effects === "Side effects not found") {
      return;
    }

    const sideEffectText = data.side_effects.toLowerCase();
    drugToSideEffects[drugName] = [];

    // Extract side effects from common phrases
    commonPhrases.forEach((phrase) => {
      const phraseIndex = sideEffectText.indexOf(phrase);
      if (phraseIndex !== -1) {
        // Get the text after the phrase until the next phrase or period
        let endIndex = sideEffectText.length;

        // Find the next phrase or period
        const possibleEndIndices = commonPhrases
          .map((p) => sideEffectText.indexOf(p, phraseIndex + phrase.length))
          .filter((idx) => idx > phraseIndex);

        const nextPeriod = sideEffectText.indexOf(
          ".",
          phraseIndex + phrase.length
        );
        if (nextPeriod !== -1) possibleEndIndices.push(nextPeriod);

        if (possibleEndIndices.length > 0) {
          endIndex = Math.min(...possibleEndIndices);
        }

        const sideEffectsSegment = sideEffectText
          .substring(phraseIndex + phrase.length, endIndex)
          .trim();

        // Split by commas, semicolons, or ";"
        const effects = sideEffectsSegment
          .split(/[,;]/)
          .map((effect) => effect.trim())
          .filter(
            (effect) =>
              effect.length > 3 &&
              !effect.includes("may report") &&
              !effect.includes("call your doctor")
          );

        effects.forEach((effect) => {
          if (!sideEffectsMap[effect]) {
            sideEffectsMap[effect] = { count: 0, drugs: [] };
          }
          sideEffectsMap[effect].count++;
          sideEffectsMap[effect].drugs.push(drugName);
          drugToSideEffects[drugName].push(effect);
        });
      }
    });
  });

  // Sort side effects by frequency
  const sortedSideEffects = Object.entries(sideEffectsMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([effect, data]) => ({
      effect,
      count: data.count,
      drugs: data.drugs,
    }));

  console.log(`✅ Identified ${sortedSideEffects.length} unique side effects`);
  return {
    sortedSideEffects,
    drugToSideEffects,
  };
}

// Function to analyze "what is" drug descriptions
function analyzeDrugDescriptions(drugData) {
  console.log("🔄 Analyzing drug descriptions...");

  const indications = {};
  const categories = {};
  const usageMap = {};

  // Common phrases indicating drug category/usage
  const categoryPhrases = [
    "is used to treat",
    "is used for",
    "is a",
    "may also be used for",
  ];

  Object.entries(drugData).forEach(([drugName, data]) => {
    if (!data.what_is) return;

    const whatIsText = data.what_is.toLowerCase();

    // Extract categories and indications
    categoryPhrases.forEach((phrase) => {
      const phraseIndex = whatIsText.indexOf(phrase);
      if (phraseIndex !== -1) {
        // Get text after the phrase
        const startIndex = phraseIndex + phrase.length;
        let endIndex = whatIsText.indexOf(".", startIndex);
        if (endIndex === -1) endIndex = whatIsText.length;

        const indication = whatIsText.substring(startIndex, endIndex).trim();
        if (indication) {
          if (!indications[indication]) {
            indications[indication] = { count: 0, drugs: [] };
          }
          indications[indication].count++;
          indications[indication].drugs.push(drugName);
        }

        // Try to extract drug class/category
        if (phrase === "is a") {
          const categoryEndIndex = whatIsText.indexOf(" that", startIndex);
          if (categoryEndIndex !== -1) {
            const category = whatIsText
              .substring(startIndex, categoryEndIndex)
              .trim();
            if (category && category.length > 3) {
              if (!categories[category]) {
                categories[category] = { count: 0, drugs: [] };
              }
              categories[category].count++;
              categories[category].drugs.push(drugName);
            }
          }
        }

        // Extract treatment usages
        if (phrase === "is used to treat" || phrase === "is used for") {
          const usages = indication
            .split(/[,;]/)
            .map((u) => u.trim())
            .filter((u) => u.length > 2 && !u.includes("purposes not listed"));

          usages.forEach((usage) => {
            if (!usageMap[usage]) {
              usageMap[usage] = { count: 0, drugs: [] };
            }
            usageMap[usage].count++;
            usageMap[usage].drugs.push(drugName);
          });
        }
      }
    });
  });

  // Sort results
  const sortedCategories = Object.entries(categories)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([category, data]) => ({
      category,
      count: data.count,
      drugs: data.drugs,
    }));

  const sortedUsages = Object.entries(usageMap)
    .sort((a, b) => b[1].count - a[1].count)
    .map(([usage, data]) => ({
      usage,
      count: data.count,
      drugs: data.drugs,
    }));

  console.log(`✅ Identified ${sortedCategories.length} drug categories`);
  console.log(`✅ Identified ${sortedUsages.length} treatment usages`);

  return {
    sortedCategories,
    sortedUsages,
  };
}

// Function to create the Excel report
async function createExcelReport(
  drugData,
  sideEffectsAnalysis,
  descriptionsAnalysis,
  outputPath
) {
  console.log("📊 Creating Excel report...");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Drug Data Analyzer";
  workbook.created = new Date();

  // 1. All Drugs Data Sheet
  const drugsSheet = workbook.addWorksheet("All Drugs");
  drugsSheet.columns = [
    { header: "Drug Name", key: "name", width: 25 },
    { header: "What Is", key: "what_is", width: 60 },
    { header: "Side Effects", key: "side_effects", width: 60 },
    { header: "URL", key: "url", width: 40 },
  ];

  // Add drug data
  Object.entries(drugData).forEach(([drugName, data]) => {
    drugsSheet.addRow({
      name: drugName,
      what_is: data.what_is || "N/A",
      side_effects: data.side_effects || "N/A",
      url: data.original_url || "N/A",
    });
  });

  // Style the header
  const headerRow = drugsSheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // 2. Side Effects Analysis Sheet
  const sideEffectsSheet = workbook.addWorksheet("Side Effects Analysis");
  sideEffectsSheet.columns = [
    { header: "Side Effect", key: "effect", width: 40 },
    { header: "Count", key: "count", width: 10 },
    { header: "Percentage", key: "percentage", width: 15 },
    { header: "Example Drugs", key: "drugs", width: 40 },
  ];

  // Add side effects data
  const drugCount = Object.keys(drugData).length;
  sideEffectsAnalysis.sortedSideEffects.forEach((item) => {
    sideEffectsSheet.addRow({
      effect: item.effect,
      count: item.count,
      percentage: `${((item.count / drugCount) * 100).toFixed(2)}%`,
      drugs:
        item.drugs.slice(0, 3).join(", ") +
        (item.drugs.length > 3 ? "..." : ""),
    });
  });

  // Style the header
  const sideEffectsHeader = sideEffectsSheet.getRow(1);
  sideEffectsHeader.font = { bold: true };
  sideEffectsHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // 3. Drug Categories Sheet
  const categoriesSheet = workbook.addWorksheet("Drug Categories");
  categoriesSheet.columns = [
    { header: "Category", key: "category", width: 30 },
    { header: "Count", key: "count", width: 10 },
    { header: "Percentage", key: "percentage", width: 15 },
    { header: "Example Drugs", key: "drugs", width: 40 },
  ];

  // Add category data
  descriptionsAnalysis.sortedCategories.forEach((item) => {
    categoriesSheet.addRow({
      category: item.category,
      count: item.count,
      percentage: `${((item.count / drugCount) * 100).toFixed(2)}%`,
      drugs:
        item.drugs.slice(0, 3).join(", ") +
        (item.drugs.length > 3 ? "..." : ""),
    });
  });

  // Style the header
  const categoriesHeader = categoriesSheet.getRow(1);
  categoriesHeader.font = { bold: true };
  categoriesHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // 4. Treatment Usages Sheet
  const usagesSheet = workbook.addWorksheet("Treatment Usages");
  usagesSheet.columns = [
    { header: "Treatment For", key: "usage", width: 40 },
    { header: "Count", key: "count", width: 10 },
    { header: "Percentage", key: "percentage", width: 15 },
    { header: "Example Drugs", key: "drugs", width: 40 },
  ];

  // Add usage data
  descriptionsAnalysis.sortedUsages.forEach((item) => {
    usagesSheet.addRow({
      usage: item.usage,
      count: item.count,
      percentage: `${((item.count / drugCount) * 100).toFixed(2)}%`,
      drugs:
        item.drugs.slice(0, 3).join(", ") +
        (item.drugs.length > 3 ? "..." : ""),
    });
  });

  // Style the header
  const usagesHeader = usagesSheet.getRow(1);
  usagesHeader.font = { bold: true };
  usagesHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // 5. Summary Sheet
  const summarySheet = workbook.addWorksheet("Summary");
  summarySheet.columns = [
    { header: "Metric", key: "metric", width: 40 },
    { header: "Value", key: "value", width: 40 },
  ];

  // Add summary data
  summarySheet.addRow({
    metric: "Total Drugs Analyzed",
    value: Object.keys(drugData).length,
  });
  summarySheet.addRow({
    metric: "Unique Side Effects Identified",
    value: sideEffectsAnalysis.sortedSideEffects.length,
  });
  summarySheet.addRow({
    metric: "Drug Categories Identified",
    value: descriptionsAnalysis.sortedCategories.length,
  });
  summarySheet.addRow({
    metric: "Treatment Usages Identified",
    value: descriptionsAnalysis.sortedUsages.length,
  });
  summarySheet.addRow({
    metric: "Drugs Missing Side Effects",
    value: Object.values(drugData).filter(
      (d) => !d.side_effects || d.side_effects === "Side effects not found"
    ).length,
  });
  summarySheet.addRow({
    metric: "Drugs Missing Descriptions",
    value: Object.values(drugData).filter((d) => !d.what_is).length,
  });
  summarySheet.addRow({
    metric: "Analysis Date",
    value: new Date().toLocaleString(),
  });

  // Add top side effects section
  summarySheet.addRow({});
  summarySheet.addRow({ metric: "TOP 10 MOST COMMON SIDE EFFECTS", value: "" });
  sideEffectsAnalysis.sortedSideEffects.slice(0, 10).forEach((item, index) => {
    summarySheet.addRow({
      metric: `${index + 1}. ${item.effect}`,
      value: `Found in ${item.count} drugs (${(
        (item.count / drugCount) *
        100
      ).toFixed(2)}%)`,
    });
  });

  // Add top categories section
  summarySheet.addRow({});
  summarySheet.addRow({
    metric: "TOP 10 MOST COMMON DRUG CATEGORIES",
    value: "",
  });
  descriptionsAnalysis.sortedCategories.slice(0, 10).forEach((item, index) => {
    summarySheet.addRow({
      metric: `${index + 1}. ${item.category}`,
      value: `${item.count} drugs (${((item.count / drugCount) * 100).toFixed(
        2
      )}%)`,
    });
  });

  // Add top treatments section
  summarySheet.addRow({});
  summarySheet.addRow({ metric: "TOP 10 MOST COMMON TREATMENTS", value: "" });
  descriptionsAnalysis.sortedUsages.slice(0, 10).forEach((item, index) => {
    summarySheet.addRow({
      metric: `${index + 1}. ${item.usage}`,
      value: `${item.count} drugs (${((item.count / drugCount) * 100).toFixed(
        2
      )}%)`,
    });
  });

  // Style the summary headers
  const summaryHeader = summarySheet.getRow(1);
  summaryHeader.font = { bold: true };
  summaryHeader.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFD3D3D3" },
  };

  // Style category headers in summary
  [9, 20, 31].forEach((rowIndex) => {
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
    const inputJsonPath = path.resolve(
      __dirname,
      "../CSV/drugs-information.json"
    );
    const outputXlsxPath = path.resolve(
      __dirname,
      "../Analysis/drug_data_analysis.xlsx"
    );

    // Create analysis directory if it doesn't exist
    const analysisDir = path.dirname(outputXlsxPath);
    if (!fs.existsSync(analysisDir)) {
      fs.mkdirSync(analysisDir, { recursive: true });
      console.log(`📁 Created directory: ${analysisDir}`);
    }

    // Load and analyze data
    const drugData = loadDrugData(inputJsonPath);
    const sideEffectsAnalysis = analyzeSideEffects(drugData);
    const descriptionsAnalysis = analyzeDrugDescriptions(drugData);

    // Create Excel report
    await createExcelReport(
      drugData,
      sideEffectsAnalysis,
      descriptionsAnalysis,
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
