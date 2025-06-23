const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

const csvWriter = createCsvWriter({
  path: `../CSV/diagnosis_treatment_data_final.csv`,
  header: [
    { id: "disease", title: "Disease" },
    { id: "diagnosis", title: "Diagnosis" },
    { id: "tests", title: "Tests" },
    { id: "treatment", title: "Treatment" },
    { id: "medications", title: "Medications" },
    { id: "symptoms_url", title: "Symptoms_URL" },
    { id: "diagnosis_url", title: "Diagnosis_URL" },
  ],
});

// Function to extract comprehensive diagnosis content
function extractDiagnosisContent($, mainContent) {
  console.log(`   🔍 Extracting diagnosis content...`);

  let diagnosis = "";

  // Multiple strategies for finding diagnosis content
  const diagnosisSelectors = [
    'h2:contains("Diagnosis")',
    'h3:contains("Diagnosis")',
    'h4:contains("Diagnosis")',
    'h2:contains("How is")',
    'h3:contains("How is")', // "How is X diagnosed?"
    'h2:contains("Diagnosing")',
    'h3:contains("Diagnosing")',
    ".diagnosis",
    "#diagnosis",
    '[id*="diagnosis"]',
  ];

  // Strategy 1: Look for dedicated diagnosis sections
  for (const selector of diagnosisSelectors) {
    const element = mainContent.find(selector).first();
    if (element.length) {
      console.log(`   🎯 Found diagnosis section: ${selector}`);

      // Try multiple content extraction methods
      let content = element.nextUntil("h1, h2, h3, h4").text().trim();

      if (!content || content.length < 50) {
        content = element.parent().nextUntil("h1, h2, h3, h4").text().trim();
      }

      if (!content || content.length < 50) {
        const followingPs = element.parent().find("p").slice(0, 5);
        if (followingPs.length) {
          content = followingPs
            .map((i, el) => $(el).text().trim())
            .get()
            .join(" ");
        }
      }

      if (content && content.length > 50) {
        diagnosis = content.substring(0, 4000);
        console.log(`   ✅ Extracted diagnosis (${diagnosis.length} chars)`);
        break;
      }
    }
  }

  // Strategy 2: If no dedicated section, find best paragraph
  if (!diagnosis || diagnosis.length < 100) {
    console.log(`   🔄 Looking for diagnosis-related paragraphs...`);

    const diagnosisKeywords = [
      "diagnos",
      "diagnostic",
      "diagnosed",
      "doctor will",
      "physician will",
      "medical history",
      "physical exam",
      "examination",
      "symptoms",
      "condition",
    ];

    let bestParagraph = "";
    let bestScore = 0;

    mainContent.find("p").each((i, el) => {
      const text = $(el).text().trim();
      if (text.length > 100 && text.length < 2000) {
        let score = 0;
        const lowerText = text.toLowerCase();

        diagnosisKeywords.forEach((keyword) => {
          if (lowerText.includes(keyword)) {
            score += keyword.length;
          }
        });

        if (score > bestScore && score > 15) {
          bestScore = score;
          bestParagraph = text;
        }
      }
    });

    if (bestParagraph) {
      diagnosis = bestParagraph.substring(0, 4000);
      console.log(`   ✅ Found diagnosis paragraph (score: ${bestScore})`);
    }
  }

  // Strategy 3: Page overview approach
  if (!diagnosis || diagnosis.length < 100) {
    const pageTitle = $("h1").first().text().trim();
    const firstParagraphs = [];

    mainContent
      .find("p")
      .slice(0, 5)
      .each((i, el) => {
        const text = $(el).text().trim();
        if (text.length > 50) {
          firstParagraphs.push(text);
        }
      });

    if (firstParagraphs.length > 0) {
      const contextualContent =
        (pageTitle ? pageTitle + ". " : "") +
        firstParagraphs.slice(0, 3).join(" ");
      if (contextualContent.length > 200) {
        diagnosis = contextualContent.substring(0, 4000);
        console.log(`   ✅ Created diagnosis from page overview`);
      }
    }
  }

  return diagnosis.replace(/\s+/g, " ").trim();
}

// Function to extract tests from text
function extractTestsFromText(text) {
  const tests = [];

  // Patterns for finding tests
  const testPatterns = [
    /(?:test|tests|testing|exam|examination|screening|procedure)(?:s)?\s+(?:may\s+)?(?:include|involves?|consists?\s+of|are|is|presented|performed)[:.]?\s*([^.!?]{10,200})/gi,
    /(?:tests?\s+(?:may\s+)?include|diagnostic\s+tests?|the\s+following\s+tests?)[:.]?\s*([^.!?]{10,300})/gi,
    /(?:doctor|physician)(?:\s+may|\s+might|\s+will)?\s+(?:order|recommend|perform|use)\s+([^.!?]*(?:test|scan|exam|biopsy|blood|imaging)[^.!?]{5,150})/gi,
  ];

  testPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = match[1].trim();
      if (extracted.length > 5) {
        const testItems = extracted
          .split(/[,;]\s*|(?:\s+and\s+)|(?:\s+or\s+)/)
          .map((item) => item.trim())
          .filter((item) => item.length > 3 && item.length < 150)
          .filter((item) => {
            const lower = item.toLowerCase();
            return (
              lower.includes("test") ||
              lower.includes("scan") ||
              lower.includes("exam") ||
              lower.includes("blood") ||
              lower.includes("urine") ||
              lower.includes("biopsy")
            );
          });

        tests.push(...testItems);
      }
    }
  });

  // Common specific tests
  const commonTests = [
    "blood test",
    "urine test",
    "x-ray",
    "CT scan",
    "MRI scan",
    "ultrasound",
    "biopsy",
    "endoscopy",
    "ECG",
    "stress test",
    "mammogram",
    "colonoscopy",
  ];

  commonTests.forEach((testName) => {
    const regex = new RegExp(
      `\\b${testName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi"
    );
    if (
      regex.test(text) &&
      !tests.some((t) => t.toLowerCase().includes(testName.toLowerCase()))
    ) {
      tests.push(testName.charAt(0).toUpperCase() + testName.slice(1));
    }
  });

  return [...new Set(tests)];
}

// Function to extract treatments from text
function extractTreatmentsFromText(text) {
  const treatments = [];

  const treatmentPatterns = [
    /(?:treatment|treatments|therapy|therapies|management)(?:s)?\s+(?:may\s+)?(?:include|involves?|consists?\s+of|options?|are|is)[:.]?\s*([^.!?]{10,250})/gi,
    /(?:treatment\s+options|therapeutic\s+options|management\s+strategies)\s+(?:may\s+)?(?:include|involve)[:.]?\s*([^.!?]{10,250})/gi,
    /(?:doctor|physician)(?:\s+may|\s+might|\s+will)?\s+(?:recommend|prescribe|suggest|use)\s+([^.!?]*(?:treatment|therapy|medication|surgery)[^.!?]{5,200})/gi,
  ];

  treatmentPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = match[1].trim();
      if (extracted.length > 5) {
        const treatmentItems = extracted
          .split(/[,;]\s*|(?:\s+and\s+)|(?:\s+or\s+)/)
          .map((item) => item.trim())
          .filter((item) => item.length > 3 && item.length < 200)
          .filter((item) => {
            const lower = item.toLowerCase();
            return (
              lower.includes("treatment") ||
              lower.includes("therapy") ||
              lower.includes("surgery") ||
              lower.includes("medication") ||
              lower.includes("exercise") ||
              lower.includes("care")
            );
          });

        treatments.push(...treatmentItems);
      }
    }
  });

  // Common treatments
  const commonTreatments = [
    "surgery",
    "medication",
    "physical therapy",
    "radiation therapy",
    "chemotherapy",
    "lifestyle changes",
    "exercise",
    "antibiotics",
    "pain management",
    "counseling",
    "monitoring",
  ];

  commonTreatments.forEach((treatment) => {
    const regex = new RegExp(
      `\\b${treatment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi"
    );
    if (
      regex.test(text) &&
      !treatments.some((t) => t.toLowerCase().includes(treatment.toLowerCase()))
    ) {
      treatments.push(treatment.charAt(0).toUpperCase() + treatment.slice(1));
    }
  });

  return [...new Set(treatments)];
}

// Function to extract medications from text
function extractMedicationsFromText(text) {
  const medications = [];

  const medicationPatterns = [
    /(?:medication|medications|medicine|drugs?)(?:s)?\s+(?:may\s+)?(?:include|used|prescribed|are|is)[:.]?\s*([^.!?]{5,200})/gi,
    /(?:doctor|physician)(?:\s+may|\s+might|\s+will)?\s+(?:prescribe|recommend|give)\s+([^.!?]{5,150})/gi,
  ];

  medicationPatterns.forEach((pattern) => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const extracted = match[1].trim();
      if (extracted.length > 2) {
        const medicationItems = extracted
          .split(/[,;]\s*|(?:\s+and\s+)|(?:\s+or\s+)/)
          .map((item) => item.trim())
          .filter((item) => item.length > 2 && item.length < 100)
          .filter((item) => {
            const lower = item.toLowerCase();
            return (
              lower.includes("medication") ||
              lower.includes("drug") ||
              lower.includes("antibiotic") ||
              lower.includes("pill") ||
              /cillin|mycin|azole|prazole/.test(lower)
            );
          });

        medications.push(...medicationItems);
      }
    }
  });

  // Common medications
  const commonMedications = [
    "antibiotics",
    "pain relievers",
    "ibuprofen",
    "acetaminophen",
    "steroids",
    "insulin",
    "antidepressants",
    "blood thinners",
  ];

  commonMedications.forEach((med) => {
    const regex = new RegExp(
      `\\b${med.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`,
      "gi"
    );
    if (
      regex.test(text) &&
      !medications.some((m) => m.toLowerCase().includes(med.toLowerCase()))
    ) {
      medications.push(med.charAt(0).toUpperCase() + med.slice(1));
    }
  });

  return [...new Set(medications)];
}

// Main scraping function
async function scrapeDisease(disease, symptomsUrl, diagnosisUrl) {
  console.log(`\n🔍 Scraping: ${disease}`);
  console.log(`   📍 Diagnosis URL: ${diagnosisUrl}`);

  if (!diagnosisUrl || diagnosisUrl === "NOT_FOUND") {
    console.log(`   ⚠️ No diagnosis URL available`);
    return {
      disease,
      diagnosis: "NO_DIAGNOSIS_URL",
      tests: "NO_DIAGNOSIS_URL",
      treatment: "NO_DIAGNOSIS_URL",
      medications: "NO_DIAGNOSIS_URL",
      symptoms_url: symptomsUrl,
      diagnosis_url: diagnosisUrl,
    };
  }

  try {
    const { data } = await axios.get(diagnosisUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(data);

    // Get main content
    let mainContent = $("main");
    if (!mainContent.length)
      mainContent = $(".main-content, .content, .page-content").first();
    if (!mainContent.length) mainContent = $("body");

    // Extract all content
    const diagnosis = extractDiagnosisContent($, mainContent);

    let tests = [];
    let treatments = [];
    let medications = [];

    // Look for dedicated sections first
    const selectors = {
      tests: [
        'h2:contains("Tests")',
        'h3:contains("Tests")',
        'h2:contains("Screening")',
        'h3:contains("Screening")',
      ],
      treatments: [
        'h2:contains("Treatment")',
        'h3:contains("Treatment")',
        'h2:contains("Therapy")',
        'h3:contains("Therapy")',
      ],
      medications: [
        'h2:contains("Medications")',
        'h3:contains("Medications")',
        'h2:contains("Medicine")',
        'h3:contains("Medicine")',
      ],
    };

    // Extract from dedicated sections
    for (const selector of selectors.tests) {
      const element = mainContent.find(selector).first();
      if (element.length) {
        const content = element.nextUntil("h1, h2, h3, h4").text().trim();
        if (content) {
          tests = extractTestsFromText(content);
          if (tests.length > 0) break;
        }
      }
    }

    for (const selector of selectors.treatments) {
      const element = mainContent.find(selector).first();
      if (element.length) {
        const content = element.nextUntil("h1, h2, h3, h4").text().trim();
        if (content) {
          treatments = extractTreatmentsFromText(content);
          if (treatments.length > 0) break;
        }
      }
    }

    for (const selector of selectors.medications) {
      const element = mainContent.find(selector).first();
      if (element.length) {
        const content = element.nextUntil("h1, h2, h3, h4").text().trim();
        if (content) {
          medications = extractMedicationsFromText(content);
          if (medications.length > 0) break;
        }
      }
    }

    // If no dedicated sections found, extract from diagnosis content
    if (tests.length === 0 && diagnosis) {
      tests = extractTestsFromText(diagnosis);
    }

    if (treatments.length === 0 && diagnosis) {
      treatments = extractTreatmentsFromText(diagnosis);
    }

    if (medications.length === 0 && diagnosis) {
      medications = extractMedicationsFromText(diagnosis);
    }

    // If still nothing found, analyze entire page
    if (
      tests.length === 0 &&
      treatments.length === 0 &&
      medications.length === 0
    ) {
      const allPageText = mainContent.text();
      tests = extractTestsFromText(allPageText).slice(0, 8);
      treatments = extractTreatmentsFromText(allPageText).slice(0, 8);
      medications = extractMedicationsFromText(allPageText).slice(0, 8);
    }

    // Format results
    const testsString = tests.join("; ");
    const treatmentsString = treatments.join("; ");
    const medicationsString = medications.join("; ");

    console.log(
      `   📊 Results: Diagnosis(${diagnosis.length}chars) Tests(${tests.length}) Treatments(${treatments.length}) Meds(${medications.length})`
    );

    return {
      disease,
      diagnosis: diagnosis || "Information not found",
      tests: testsString || "Tests information not found",
      treatment: treatmentsString || "Treatment information not found",
      medications: medicationsString || "Medications information not found",
      symptoms_url: symptomsUrl,
      diagnosis_url: diagnosisUrl,
    };
  } catch (error) {
    console.error(`   ❌ Error scraping ${disease}: ${error.message}`);
    return {
      disease,
      diagnosis: "ERROR - " + error.message,
      tests: "ERROR - " + error.message,
      treatment: "ERROR - " + error.message,
      medications: "ERROR - " + error.message,
      symptoms_url: symptomsUrl,
      diagnosis_url: diagnosisUrl,
    };
  }
}

// Load diseases with diagnosis URLs
async function loadDiseasesWithDiagnosisUrls() {
  try {
    const csvContent = fs.readFileSync(
      "../CSV/diseases_with_diagnosis_urls.csv",
      "utf8"
    );
    const lines = csvContent.split("\n").slice(1);

    const diseases = [];
    for (const line of lines) {
      if (line.trim()) {
        const parts = line.split(",");
        if (parts.length >= 4) {
          const disease = parts[0].trim();
          const symptomsUrl = parts[1].trim();
          const diagnosisUrl = parts[2].trim();
          const status = parts[3].trim();

          diseases.push({ disease, symptomsUrl, diagnosisUrl, status });
        }
      }
    }

    console.log(`📋 Loaded ${diseases.length} diseases with diagnosis URLs`);
    return diseases.filter((d) => d.diagnosisUrl !== "NOT_FOUND"); // Only process diseases with valid URLs
  } catch (error) {
    console.error("❌ Error loading diseases CSV:", error.message);
    return [];
  }
}

// Main execution
(async function main() {
  console.log("🔥 MAYO CLINIC CONTENT SCRAPER STARTING...");

  try {
    // FIRST FIX: Delete existing output file to prevent duplicates
    if (fs.existsSync("../CSV/diagnosis_treatment_data_final.csv")) {
      fs.unlinkSync("../CSV/diagnosis_treatment_data_final.csv");
      console.log("🧹 Cleared existing output CSV file");
    }

    const diseases = await loadDiseasesWithDiagnosisUrls();

    if (diseases.length === 0) {
      console.log("❌ No diseases found. Run mc-letters-scrapper.js first!");
      return;
    }

    console.log(
      `📊 Processing ${diseases.length} diseases with valid diagnosis URLs`
    );

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // SECOND FIX: Add tracking of processed diseases
    const processedDiseaseSet = new Set();

    for (let i = 0; i < diseases.length; i++) {
      const { disease, symptomsUrl, diagnosisUrl } = diseases[i];

      // Skip duplicates by URL
      const diseaseKey = diagnosisUrl.toLowerCase();
      if (processedDiseaseSet.has(diseaseKey)) {
        console.log(`\n⚠️ Skipping duplicate disease URL: ${diagnosisUrl}`);
        continue;
      }

      // Mark as processed
      processedDiseaseSet.add(diseaseKey);

      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 Processing ${i + 1}/${diseases.length}: ${disease}`);
      console.log(
        `📈 Progress: ${(((i + 1) / diseases.length) * 100).toFixed(1)}%`
      );

      const result = await scrapeDisease(disease, symptomsUrl, diagnosisUrl);
      results.push(result);

      if (
        result.diagnosis !== "ERROR" &&
        result.diagnosis !== "NO_DIAGNOSIS_URL" &&
        result.diagnosis.length > 50
      ) {
        successCount++;
      } else {
        errorCount++;
      }

      // THIRD FIX: Use JSON checkpoints instead of CSV checkpoints
      if ((i + 1) % 25 === 0) {
        // Save JSON checkpoint instead of CSV
        fs.writeFileSync(
          "diagnosis_scraper_checkpoint.json",
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              progress: i + 1,
              total: diseases.length,
              processed: results.length,
              successCount,
              errorCount,
            },
            null,
            2
          )
        );
        console.log(`💾 JSON checkpoint saved at disease ${i + 1}`);
      }

      // Delay between requests
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }

    // FOURTH FIX: Only write the CSV once at the very end
    console.log(`\n💾 Writing final CSV with ${results.length} entries...`);
    await csvWriter.writeRecords(results);

    console.log(`\n🎉 SCRAPING COMPLETED!`);
    console.log(`✅ Success: ${successCount} | ❌ Errors: ${errorCount}`);
    console.log(
      `📈 Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`
    );
    console.log(`💾 Data saved to: ../CSV/diagnosis_treatment_data_final.csv`);

    // Save a complete backup JSON too
    fs.writeFileSync(
      "diagnosis_treatment_data_complete.json",
      JSON.stringify(results, null, 2)
    );
    console.log(`💾 Backup saved to: diagnosis_treatment_data_complete.json`);
  } catch (error) {
    console.error("💥 Fatal error:", error);
  }
})();
