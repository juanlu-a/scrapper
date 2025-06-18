const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// Create CSV writer for the normalized data
const csvWriter = createCsvWriter({
  path: `./CSV/normalized_medical_data.csv`,
  header: [
    { id: "disease", title: "Disease" },
    { id: "category", title: "Category" }, // diagnosis, tests, treatment, medications
    { id: "item_number", title: "Item Number" },
    { id: "content", title: "Content" },
    { id: "original_url", title: "Original URL" },
    { id: "diagnosis_url", title: "Diagnosis URL" },
  ],
});

function splitContent(content, separator = "|") {
  if (
    !content ||
    content === "" ||
    content === "ERROR" ||
    content === "NO_DIAGNOSIS_URL"
  ) {
    return [];
  }

  // Split by | and clean up each item
  return content
    .split(separator)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => !item.toLowerCase().includes("error"))
    .filter((item) => item.length > 10); // Filter out very short items that might be noise
}

function normalizeData(scrapedData) {
  const normalizedRows = [];

  scrapedData.forEach((disease) => {
    const baseData = {
      disease: disease.disease,
      original_url: disease.original_url || "",
      diagnosis_url: disease.diagnosis_url || "",
    };

    // Process Diagnosis (usually one item, but handle it consistently)
    if (
      disease.diagnosis &&
      disease.diagnosis !== "" &&
      disease.diagnosis !== "ERROR"
    ) {
      const diagnosisItems = splitContent(disease.diagnosis);
      if (diagnosisItems.length === 0 && disease.diagnosis.length > 10) {
        // If no splitting occurred but we have content, treat as single item
        diagnosisItems.push(disease.diagnosis);
      }

      diagnosisItems.forEach((item, index) => {
        normalizedRows.push({
          ...baseData,
          category: "diagnosis",
          item_number: index + 1,
          content: item.trim(),
        });
      });
    }

    // Process Tests
    if (disease.tests && disease.tests !== "" && disease.tests !== "ERROR") {
      const testItems = splitContent(disease.tests);
      if (testItems.length === 0 && disease.tests.length > 10) {
        testItems.push(disease.tests);
      }

      testItems.forEach((item, index) => {
        normalizedRows.push({
          ...baseData,
          category: "tests",
          item_number: index + 1,
          content: item.trim(),
        });
      });
    }

    // Process Treatments
    if (
      disease.treatment &&
      disease.treatment !== "" &&
      disease.treatment !== "ERROR"
    ) {
      const treatmentItems = splitContent(disease.treatment);
      if (treatmentItems.length === 0 && disease.treatment.length > 10) {
        treatmentItems.push(disease.treatment);
      }

      treatmentItems.forEach((item, index) => {
        normalizedRows.push({
          ...baseData,
          category: "treatment",
          item_number: index + 1,
          content: item.trim(),
        });
      });
    }

    // Process Medications
    if (
      disease.medications &&
      disease.medications !== "" &&
      disease.medications !== "ERROR"
    ) {
      const medicationItems = splitContent(disease.medications);
      if (medicationItems.length === 0 && disease.medications.length > 10) {
        medicationItems.push(disease.medications);
      }

      medicationItems.forEach((item, index) => {
        normalizedRows.push({
          ...baseData,
          category: "medications",
          item_number: index + 1,
          content: item.trim(),
        });
      });
    }
  });

  return normalizedRows;
}

async function processScrapedData() {
  try {
    console.log("📖 Reading scraped data...");

    // Read the scraped JSON data
    const jsonData = fs.readFileSync("scraped.json", "utf8");
    const parsedData = JSON.parse(jsonData);

    // The data might be in a 'results' property or directly as an array
    const scrapedData = parsedData.results || parsedData;

    console.log(`📊 Found ${scrapedData.length} diseases in the scraped data`);

    // Normalize the data
    console.log("🔄 Normalizing data...");
    const normalizedData = normalizeData(scrapedData);

    console.log(`📈 Created ${normalizedData.length} normalized rows`);

    // Show some statistics
    const stats = {
      diagnosis: normalizedData.filter((row) => row.category === "diagnosis")
        .length,
      tests: normalizedData.filter((row) => row.category === "tests").length,
      treatment: normalizedData.filter((row) => row.category === "treatment")
        .length,
      medications: normalizedData.filter(
        (row) => row.category === "medications"
      ).length,
    };

    console.log("📊 Category breakdown:");
    console.log(`   🔍 Diagnosis entries: ${stats.diagnosis}`);
    console.log(`   🧪 Test entries: ${stats.tests}`);
    console.log(`   💊 Treatment entries: ${stats.treatment}`);
    console.log(`   💉 Medication entries: ${stats.medications}`);

    // Save to CSV
    console.log("💾 Saving normalized data to CSV...");
    await csvWriter.writeRecords(normalizedData);

    console.log("✅ Successfully created normalized_medical_data.csv");

    // Show sample of the data
    console.log("\n📋 Sample of normalized data:");
    normalizedData.slice(0, 5).forEach((row, index) => {
      console.log(
        `${index + 1}. ${row.disease} - ${row.category} ${
          row.item_number
        }: ${row.content.substring(0, 60)}...`
      );
    });
  } catch (error) {
    console.error("❌ Error processing data:", error.message);
  }
}

// Run the normalization
(async function main() {
  console.log("🚀 Starting data normalization...");
  await processScrapedData();
  console.log("🎉 Data normalization completed!");
})();
