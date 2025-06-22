const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

// Function to properly parse CSV line with quoted fields
function parseCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        // Escaped quote
        current += '"';
        i += 2;
        continue;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // End of field
      result.push(current.trim());
      current = "";
      i++;
      continue;
    } else {
      current += char;
    }
    i++;
  }

  // Add the last field
  if (current) {
    result.push(current.trim());
  }

  return result;
}

// Function to normalize and clean text
function normalizeText(text) {
  if (
    !text ||
    text === "Information not found" ||
    text === "Tests information not found" ||
    text === "Treatment information not found" ||
    text === "Medications information not found" ||
    text.startsWith("ERROR") ||
    text.startsWith("NO_")
  ) {
    return [];
  }

  return text
    .split(/[;|]\s*/) // Split by semicolons or pipes
    .map((item) => item.trim())
    .filter((item) => item.length > 3)
    .map((item) =>
      item
        .toLowerCase()
        .replace(/[^\w\s-]/g, "") // Remove special characters except hyphens
        .replace(/\s+/g, " ")
        .trim()
    )
    .filter((item) => item.length > 2);
}

// Function to extract medication names more precisely
function extractMedicationNames(medicationText) {
  if (
    !medicationText ||
    medicationText === "Medications information not found" ||
    medicationText.startsWith("ERROR") ||
    medicationText.startsWith("NO_")
  ) {
    return [];
  }

  const medications = [];
  const text = medicationText.toLowerCase();

  // Common medication patterns and suffixes
  const medicationSuffixes = [
    "cillin",
    "mycin",
    "azole",
    "prazole",
    "olol",
    "pril",
    "sartan",
    "statin",
    "ide",
    "ine",
    "ate",
    "one",
    "um",
    "ex",
    "max",
  ];

  // Split by common separators
  const items = medicationText
    .split(/[;|,]\s*/)
    .map((item) => item.trim())
    .filter((item) => item.length > 2);

  for (const item of items) {
    // Clean the item
    const cleaned = item
      .toLowerCase()
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Extract potential medication names (usually first word or two)
    const words = cleaned.split(" ");

    // Look for medication-like patterns
    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      // Check if word looks like a medication name
      if (word.length >= 4) {
        // Check if it has medication-like suffixes
        const hasMedSuffix = medicationSuffixes.some((suffix) =>
          word.endsWith(suffix)
        );

        // Check if it's a branded name (starts with capital)
        const isProperName = /^[A-Z][a-z]+/.test(item.split(" ")[i]);

        // Include if it looks like a medication
        if (hasMedSuffix || isProperName || word.length >= 6) {
          // Take the word and possibly the next one for compound names
          let medName = word;
          if (i < words.length - 1 && words[i + 1].length >= 3) {
            medName += " " + words[i + 1];
          }
          medications.push(medName.trim());
        }
      }
    }

    // Also add the full cleaned item if it's not too long
    if (
      cleaned.length >= 4 &&
      cleaned.length <= 50 &&
      !cleaned.includes("such as")
    ) {
      medications.push(cleaned);
    }
  }

  // Remove duplicates and return
  return [...new Set(medications)];
}

// Main analysis function
function analyzeMayoClinicData() {
  console.log("🔍 MAYO CLINIC DATA ANALYZER STARTING...");
  console.log(
    "📊 Analyzing patterns, shared treatments, tests, and medications"
  );

  try {
    const csvContent = fs.readFileSync(
      "../CSV/diagnosis_treatment_data_full.csv",
      "utf8"
    );
    const lines = csvContent.split("\n");

    if (lines.length < 2) {
      console.log("❌ CSV file appears to be empty or malformed");
      return;
    }

    const header = lines[0];
    const dataLines = lines.slice(1).filter((line) => line.trim()); // Skip header and empty lines

    console.log(`📋 Processing ${dataLines.length} disease records...`);
    console.log(`📋 CSV Header: ${header}`);

    const diseases = [];
    const allTests = new Map();
    const allTreatments = new Map();
    const allMedications = new Map();

    // Track which diseases use each item
    const testsByDisease = new Map();
    const treatmentsByDisease = new Map();
    const medicationsByDisease = new Map();

    let processedCount = 0;
    let validCount = 0;

    // Process each disease
    dataLines.forEach((line, index) => {
      if (line.trim()) {
        processedCount++;

        // Parse CSV line properly
        const parts = parseCsvLine(line);

        if (parts.length >= 5) {
          const disease = parts[0] || "";
          const diagnosis = parts[1] || "";
          const testsText = parts[2] || "";
          const treatmentText = parts[3] || "";
          const medicationsText = parts[4] || "";

          console.log(
            `🔍 Processing ${index + 1}: ${disease.substring(0, 30)}...`
          );

          // Skip invalid entries
          if (
            diagnosis === "NO_DIAGNOSIS_URL" ||
            diagnosis.startsWith("ERROR") ||
            diagnosis === "Information not found"
          ) {
            console.log(`   ⚠️ Skipping invalid entry`);
            return;
          }

          validCount++;
          diseases.push({
            disease,
            diagnosis,
            testsText,
            treatmentText,
            medicationsText,
          });

          // Process tests
          const tests = normalizeText(testsText);
          tests.forEach((test) => {
            if (!allTests.has(test)) {
              allTests.set(test, 0);
              testsByDisease.set(test, []);
            }
            allTests.set(test, allTests.get(test) + 1);
            testsByDisease.get(test).push(disease);
          });

          // Process treatments
          const treatments = normalizeText(treatmentText);
          treatments.forEach((treatment) => {
            if (!allTreatments.has(treatment)) {
              allTreatments.set(treatment, 0);
              treatmentsByDisease.set(treatment, []);
            }
            allTreatments.set(treatment, allTreatments.get(treatment) + 1);
            treatmentsByDisease.get(treatment).push(disease);
          });

          // Process medications with special extraction
          const medications = extractMedicationNames(medicationsText);
          medications.forEach((medication) => {
            if (!allMedications.has(medication)) {
              allMedications.set(medication, 0);
              medicationsByDisease.set(medication, []);
            }
            allMedications.set(medication, allMedications.get(medication) + 1);
            medicationsByDisease.get(medication).push(disease);
          });

          // Show progress every 50 diseases
          if (validCount % 50 === 0) {
            console.log(`\n📈 Progress: ${validCount} diseases processed...`);
            console.log(`   🧪 Tests so far: ${allTests.size}`);
            console.log(`   🏥 Treatments so far: ${allTreatments.size}`);
            console.log(`   💊 Medications so far: ${allMedications.size}\n`);
          }
        } else {
          console.log(
            `⚠️ Line ${index + 1} has insufficient columns (${
              parts.length
            }): ${line.substring(0, 100)}...`
          );
        }
      }
    });

    console.log(`\n📊 ANALYSIS RESULTS:`);
    console.log(`   📋 Total lines processed: ${processedCount}`);
    console.log(`   ✅ Valid diseases processed: ${validCount}`);
    console.log(`   🧪 Unique tests found: ${allTests.size}`);
    console.log(`   🏥 Unique treatments found: ${allTreatments.size}`);
    console.log(`   💊 Unique medications found: ${allMedications.size}`);

    if (validCount === 0) {
      console.log(
        "❌ No valid diseases found to analyze. Check the CSV format."
      );
      return;
    }

    // Create comprehensive analysis
    createComprehensiveAnalysis(
      allTests,
      testsByDisease,
      allTreatments,
      treatmentsByDisease,
      allMedications,
      medicationsByDisease,
      diseases
    );

    console.log(`\n✅ Analysis complete! Generated comprehensive file:`);
    console.log(
      `   📊 ../CSV/mayo-clinic-comprehensive-analysis.csv - All data in one file`
    );
    console.log(
      `   📈 ../CSV/analysis-summary.json - Overall statistics and insights`
    );
  } catch (error) {
    console.error("❌ Error analyzing data:", error.message);
    console.error("Stack trace:", error.stack);
  }
}

// Create comprehensive analysis in one CSV file
function createComprehensiveAnalysis(
  allTests,
  testsByDisease,
  allTreatments,
  treatmentsByDisease,
  allMedications,
  medicationsByDisease,
  diseases
) {
  const comprehensiveData = [];

  // Add all tests
  Array.from(allTests.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by usage count descending
    .forEach(([item, count]) => {
      comprehensiveData.push({
        category: "Test",
        item: item,
        usage_count: count,
        diseases_count: testsByDisease.get(item).length,
        is_shared: testsByDisease.get(item).length > 1 ? "Yes" : "No",
        diseases_using: testsByDisease.get(item).join("; "),
        clean_name_for_matching: item.replace(/\s+/g, " ").trim(),
        search_terms: item
          .split(" ")
          .filter((word) => word.length >= 3)
          .join(", "),
      });
    });

  // Add all treatments
  Array.from(allTreatments.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by usage count descending
    .forEach(([item, count]) => {
      comprehensiveData.push({
        category: "Treatment",
        item: item,
        usage_count: count,
        diseases_count: treatmentsByDisease.get(item).length,
        is_shared: treatmentsByDisease.get(item).length > 1 ? "Yes" : "No",
        diseases_using: treatmentsByDisease.get(item).join("; "),
        clean_name_for_matching: item.replace(/\s+/g, " ").trim(),
        search_terms: item
          .split(" ")
          .filter((word) => word.length >= 3)
          .join(", "),
      });
    });

  // Add all medications
  Array.from(allMedications.entries())
    .sort((a, b) => b[1] - a[1]) // Sort by usage count descending
    .forEach(([item, count]) => {
      const cleanName = item.replace(/\s+/g, " ").trim().split(" ")[0]; // First word for drug matching

      comprehensiveData.push({
        category: "Medication",
        item: item,
        usage_count: count,
        diseases_count: medicationsByDisease.get(item).length,
        is_shared: medicationsByDisease.get(item).length > 1 ? "Yes" : "No",
        diseases_using: medicationsByDisease.get(item).join("; "),
        clean_name_for_matching: cleanName,
        search_terms: item
          .split(" ")
          .filter((word) => word.length >= 3)
          .join(", "),
      });
    });

  // Create CSV writer for comprehensive data
  const comprehensiveWriter = createCsvWriter({
    path: "../CSV/mayo-clinic-comprehensive-analysis.csv",
    header: [
      { id: "category", title: "Category" },
      { id: "item", title: "Item" },
      { id: "usage_count", title: "Usage Count" },
      { id: "diseases_count", title: "Number of Diseases" },
      { id: "is_shared", title: "Shared by Multiple Diseases" },
      { id: "clean_name_for_matching", title: "Clean Name for Drug Matching" },
      { id: "search_terms", title: "Search Terms" },
      { id: "diseases_using", title: "Diseases Using This Item" },
    ],
  });

  comprehensiveWriter.writeRecords(comprehensiveData);

  // Create summary statistics
  createSummaryReport(diseases, allTests, allTreatments, allMedications);

  console.log(
    `📊 Comprehensive analysis saved with ${comprehensiveData.length} total entries:`
  );
  console.log(`   🧪 Tests: ${allTests.size}`);
  console.log(`   🏥 Treatments: ${allTreatments.size}`);
  console.log(`   💊 Medications: ${allMedications.size}`);

  // Show top items from each category
  const topTests = Array.from(allTests.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topTreatments = Array.from(allTreatments.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const topMedications = Array.from(allMedications.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  console.log(`\n🔝 TOP ITEMS BY CATEGORY:`);
  console.log(`   🧪 Most common tests:`);
  topTests.forEach((item, i) => {
    console.log(`      ${i + 1}. ${item[0]} (${item[1]} diseases)`);
  });

  console.log(`   🏥 Most common treatments:`);
  topTreatments.forEach((item, i) => {
    console.log(`      ${i + 1}. ${item[0]} (${item[1]} diseases)`);
  });

  console.log(`   💊 Most common medications:`);
  topMedications.forEach((item, i) => {
    console.log(`      ${i + 1}. ${item[0]} (${item[1]} diseases)`);
  });

  // Count shared items
  const sharedTests = Array.from(testsByDisease.values()).filter(
    (diseases) => diseases.length > 1
  ).length;
  const sharedTreatments = Array.from(treatmentsByDisease.values()).filter(
    (diseases) => diseases.length > 1
  ).length;
  const sharedMedications = Array.from(medicationsByDisease.values()).filter(
    (diseases) => diseases.length > 1
  ).length;

  console.log(`\n🔗 SHARED ITEMS SUMMARY:`);
  console.log(`   🧪 Tests shared by multiple diseases: ${sharedTests}`);
  console.log(
    `   🏥 Treatments shared by multiple diseases: ${sharedTreatments}`
  );
  console.log(
    `   💊 Medications shared by multiple diseases: ${sharedMedications}`
  );
}

// Create summary report with insights
function createSummaryReport(
  diseases,
  allTests,
  allTreatments,
  allMedications
) {
  // Handle empty data gracefully
  const topTests = Array.from(allTests.entries()).sort((a, b) => b[1] - a[1]);
  const topTreatments = Array.from(allTreatments.entries()).sort(
    (a, b) => b[1] - a[1]
  );
  const topMedications = Array.from(allMedications.entries()).sort(
    (a, b) => b[1] - a[1]
  );

  const summary = {
    timestamp: new Date().toISOString(),
    overview: {
      total_diseases: diseases.length,
      unique_tests: allTests.size,
      unique_treatments: allTreatments.size,
      unique_medications: allMedications.size,
      total_items: allTests.size + allTreatments.size + allMedications.size,
    },
    top_tests: topTests.slice(0, 10).map(([test, count]) => ({ test, count })),
    top_treatments: topTreatments
      .slice(0, 10)
      .map(([treatment, count]) => ({ treatment, count })),
    top_medications: topMedications
      .slice(0, 10)
      .map(([medication, count]) => ({ medication, count })),
    insights: {
      most_common_test: topTests.length > 0 ? topTests[0] : ["none", 0],
      most_common_treatment:
        topTreatments.length > 0 ? topTreatments[0] : ["none", 0],
      most_common_medication:
        topMedications.length > 0 ? topMedications[0] : ["none", 0],
      avg_tests_per_disease:
        diseases.length > 0
          ? (
              Array.from(allTests.values()).reduce((a, b) => a + b, 0) /
              diseases.length
            ).toFixed(2)
          : "0",
      avg_treatments_per_disease:
        diseases.length > 0
          ? (
              Array.from(allTreatments.values()).reduce((a, b) => a + b, 0) /
              diseases.length
            ).toFixed(2)
          : "0",
      avg_medications_per_disease:
        diseases.length > 0
          ? (
              Array.from(allMedications.values()).reduce((a, b) => a + b, 0) /
              diseases.length
            ).toFixed(2)
          : "0",
    },
    data_quality: {
      diseases_with_tests: diseases.filter(
        (d) => normalizeText(d.testsText).length > 0
      ).length,
      diseases_with_treatments: diseases.filter(
        (d) => normalizeText(d.treatmentText).length > 0
      ).length,
      diseases_with_medications: diseases.filter(
        (d) => extractMedicationNames(d.medicationsText).length > 0
      ).length,
    },
  };

  fs.writeFileSync(
    "../CSV/analysis-summary.json",
    JSON.stringify(summary, null, 2)
  );

  console.log(`\n📈 KEY INSIGHTS:`);
  console.log(
    `   🧪 Most common test: ${summary.insights.most_common_test[0]} (${summary.insights.most_common_test[1]} diseases)`
  );
  console.log(
    `   🏥 Most common treatment: ${summary.insights.most_common_treatment[0]} (${summary.insights.most_common_treatment[1]} diseases)`
  );
  console.log(
    `   💊 Most common medication: ${summary.insights.most_common_medication[0]} (${summary.insights.most_common_medication[1]} diseases)`
  );
  console.log(
    `   📊 Average tests per disease: ${summary.insights.avg_tests_per_disease}`
  );
  console.log(
    `   📊 Average treatments per disease: ${summary.insights.avg_treatments_per_disease}`
  );
  console.log(
    `   📊 Average medications per disease: ${summary.insights.avg_medications_per_disease}`
  );
}

// Main execution
(function main() {
  analyzeMayoClinicData();
})();
