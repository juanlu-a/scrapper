const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

const csvWriter = createCsvWriter({
  path: `../CSV/diagnosis_treatment_data_full.csv`,
  header: [
    { id: "disease", title: "Disease" },
    { id: "diagnosis", title: "Diagnosis" },
    { id: "tests", title: "Tests" },
    { id: "treatment", title: "Treatment" },
    { id: "medications", title: "Medications" },
    { id: "original_url", title: "Original URL" },
    { id: "diagnosis_url", title: "Diagnosis URL" },
  ],
});

// Function to parse content into arrays
function parseContentToArray(content) {
  if (!content || content === "ERROR" || content === "NO_DIAGNOSIS_URL") {
    return [];
  }

  // Split by common separators and clean up
  return content
    .split(/\|\||•|\n|;\s*(?=[A-Z])/)
    .map((item) => item.trim())
    .filter((item) => item.length > 5) // Filter out very short items
    .slice(0, 20); // Limit to avoid extremely long arrays
}

// Function to save JSON data
function saveJsonData(results) {
  const jsonData = {};

  results.forEach((result) => {
    if (result && result.disease) {
      jsonData[result.disease] = {
        disease: result.disease,
        diagnosis: result.diagnosis || "",
        tests: parseContentToArray(result.tests),
        treatment: parseContentToArray(result.treatment),
        medications: parseContentToArray(result.medications),
      };
    }
  });

  try {
    fs.writeFileSync(
      "scrapped-diseases.json",
      JSON.stringify(jsonData, null, 2)
    );
    console.log(
      `✅ JSON data saved to scrapped-diseases.json (${
        Object.keys(jsonData).length
      } diseases)`
    );
  } catch (error) {
    console.error("❌ Error saving JSON data:", error.message);
  }
}

async function findDiagnosisTreatmentUrl(originalUrl) {
  console.log(`🔍 Looking for diagnosis & treatment link in: ${originalUrl}`);

  try {
    const { data } = await axios.get(originalUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });

    const $ = cheerio.load(data);

    // Look for different possible selectors for the diagnosis & treatment tab/button
    const possibleSelectors = [
      'a[href*="diagnosis-treatment"]',
      'a:contains("Diagnosis")',
      'a:contains("diagnosis")',
      '.tab a[href*="diagnosis"]',
      '.nav a[href*="diagnosis"]',
      'button[data-target*="diagnosis"]',
      '[data-tab="diagnosis"]',
    ];

    for (const selector of possibleSelectors) {
      const diagnosisLink = $(selector).first();
      if (diagnosisLink.length) {
        let href = diagnosisLink.attr("href");
        if (href) {
          // Make sure it's a full URL
          if (href.startsWith("/")) {
            href = "https://www.mayoclinic.org" + href;
          }
          console.log(`   ✅ Found diagnosis & treatment URL: ${href}`);
          return href;
        }
      }
    }

    console.log(`   ⚠️ Could not find diagnosis & treatment link`);
    return null;
  } catch (error) {
    console.error(`   ❌ Error finding diagnosis URL:`, error.message);
    return null;
  }
}

// Enhanced function to extract tests from diagnosis content
function extractTestsFromDiagnosis(diagnosisText) {
  if (!diagnosisText || diagnosisText.length < 50) return [];

  const tests = [];
  const testKeywords = [
    "test may include:",
    "tests may include:",
    "testing may include:",
    "test might include:",
    "tests might include:",
    "testing might include:",
    "tests include:",
    "testing includes:",
    "test includes:",
    "tests and procedures:",
    "tests and exams:",
    "diagnostic tests:",
    "laboratory tests:",
    "imaging tests:",
    "blood tests:",
    "the following tests:",
    "these tests:",
    "such tests:",
  ];

  // Convert to lowercase for matching
  const lowerText = diagnosisText.toLowerCase();

  // Find if any test keywords exist
  let testStartIndex = -1;
  let matchedKeyword = "";

  for (const keyword of testKeywords) {
    const index = lowerText.indexOf(keyword);
    if (index !== -1) {
      testStartIndex = index + keyword.length;
      matchedKeyword = keyword;
      break;
    }
  }

  if (testStartIndex !== -1) {
    console.log(
      `   🔍 Found tests in diagnosis with keyword: "${matchedKeyword}"`
    );

    // Extract text after the keyword
    let testsText = diagnosisText.substring(testStartIndex);

    // Stop at next major section or end of reasonable test content
    const stopPatterns = [
      /treatment/i,
      /therapy/i,
      /medication/i,
      /management/i,
      /prevention/i,
      /outlook/i,
      /prognosis/i,
      /complications/i,
      /more information/i,
      /care at mayo clinic/i,
    ];

    for (const pattern of stopPatterns) {
      const match = testsText.match(pattern);
      if (match) {
        testsText = testsText.substring(0, match.index);
        break;
      }
    }

    // Split by common test separators
    const testItems = testsText
      .split(/[.;]\s*/)
      .map((item) => item.trim())
      .filter((item) => {
        // Filter for actual test names
        return (
          item.length > 5 &&
          item.length < 200 && // Not too long
          !item.toLowerCase().includes("your doctor") &&
          !item.toLowerCase().includes("healthcare") &&
          !item.toLowerCase().includes("the test") &&
          (item.toLowerCase().includes("test") ||
            item.toLowerCase().includes("scan") ||
            item.toLowerCase().includes("x-ray") ||
            item.toLowerCase().includes("mri") ||
            item.toLowerCase().includes("ct") ||
            item.toLowerCase().includes("ultrasound") ||
            item.toLowerCase().includes("blood") ||
            item.toLowerCase().includes("urine") ||
            item.toLowerCase().includes("biopsy") ||
            item.toLowerCase().includes("exam") ||
            item.toLowerCase().includes("imaging") ||
            item.toLowerCase().includes("endoscopy") ||
            item.toLowerCase().includes("ecg") ||
            item.toLowerCase().includes("ekg") ||
            item.toLowerCase().includes("electrocardiogram") ||
            item.toLowerCase().includes("mammogram") ||
            item.toLowerCase().includes("colonoscopy"))
        );
      })
      .slice(0, 8); // Limit number of tests

    tests.push(...testItems);
  }

  // Also look for standalone test mentions in the diagnosis
  const commonTests = [
    "mri",
    "ct scan",
    "x-ray",
    "ultrasound",
    "blood test",
    "urine test",
    "biopsy",
    "endoscopy",
    "colonoscopy",
    "mammogram",
    "ecg",
    "ekg",
    "electrocardiogram",
    "pet scan",
    "bone scan",
    "stress test",
  ];

  for (const testName of commonTests) {
    const regex = new RegExp(`\\b${testName}\\b`, "gi");
    if (
      regex.test(diagnosisText) &&
      !tests.some((t) => t.toLowerCase().includes(testName))
    ) {
      tests.push(testName.charAt(0).toUpperCase() + testName.slice(1));
    }
  }

  return tests;
}

async function scrapeDiagnosisTreatment(disease, originalUrl) {
  console.log(`\n🔍 Starting scrape for: ${disease}`);

  // First, find the actual diagnosis & treatment URL
  const diagnosisUrl = await findDiagnosisTreatmentUrl(originalUrl);

  if (!diagnosisUrl) {
    console.log(
      `   ⚠️ Could not find diagnosis & treatment URL for ${disease}`
    );
    return {
      disease,
      diagnosis: "NO_DIAGNOSIS_URL",
      tests: "NO_TESTS_URL",
      treatment: "NO_TREATMENT_URL",
      medications: "NO_MEDICATIONS_URL",
      original_url: originalUrl,
      diagnosis_url: "NOT_FOUND",
    };
  }

  console.log(`   📄 Scraping diagnosis & treatment from: ${diagnosisUrl}`);

  try {
    const { data } = await axios.get(diagnosisUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(data);

    let diagnosis = "";
    let tests = [];
    let treatment = [];
    let medications = [];

    // Mayo Clinic has a very specific structure - let's target it directly
    // Look for the main content area first
    const mainContentSelectors = [
      "main",
      ".main-content",
      "#main",
      ".content",
      ".page-content",
      '[role="main"]',
    ];

    let mainContent = null;
    for (const selector of mainContentSelectors) {
      mainContent = $(selector);
      if (mainContent.length) {
        console.log(`   ✅ Found main content with: ${selector}`);
        break;
      }
    }

    if (!mainContent || !mainContent.length) {
      mainContent = $("body");
      console.log(`   📍 Using body as main content`);
    }

    // Function to extract structured content (lists, paragraphs)
    function extractStructuredContent(element, $) {
      const items = [];

      // Get content until next major heading
      let nextSiblings = element.nextUntil("h1, h2, h3");
      if (!nextSiblings.length) {
        nextSiblings = element.parent().nextUntil("h1, h2, h3");
      }

      // Extract from lists first (more structured)
      nextSiblings.find("ul li, ol li").each((i, li) => {
        const text = $(li).text().trim();
        if (text.length > 10) {
          items.push(text);
        }
      });

      // If no lists, extract from paragraphs
      if (items.length === 0) {
        nextSiblings.filter("p").each((i, p) => {
          const text = $(p).text().trim();
          if (text.length > 20) {
            // Split long paragraphs by sentences that might be separate items
            const sentences = text
              .split(/[.!?]\s+/)
              .map((s) => s.trim())
              .filter((s) => s.length > 15);
            items.push(...sentences);
          }
        });
      }

      // If still no structured content, get all text and try to parse it
      if (items.length === 0) {
        const allText = nextSiblings.text().trim();
        if (allText.length > 50) {
          // Try to split by common separators
          const splitItems = allText
            .split(/[•·\n]\s*/)
            .map((item) => item.trim())
            .filter((item) => item.length > 15);
          items.push(...splitItems);
        }
      }

      return items.slice(0, 10); // Limit to 10 items max
    }

    // Mayo Clinic specific patterns for diagnosis
    const diagnosisSelectors = [
      'h2:contains("Diagnosis")',
      'h3:contains("Diagnosis")',
      'h2:contains("diagnosis")',
      'h3:contains("diagnosis")',
      ".diagnosis",
      "#diagnosis",
      '[id*="diagnosis"]',
      '[class*="diagnosis"]',
      'h2:contains("diagnosed")',
      'h3:contains("diagnosed")',
    ];

    // Extract diagnosis content (keep as single text block)
    for (const selector of diagnosisSelectors) {
      const element = mainContent.find(selector).first();
      if (element.length) {
        console.log(`   🎯 Found diagnosis heading with: ${selector}`);

        let content = "";
        let nextSiblings = element.nextUntil("h1, h2, h3");
        if (nextSiblings.length) {
          content = nextSiblings.text().trim();
        }

        if (!content) {
          let parentNext = element.parent().nextUntil("h1, h2, h3");
          if (parentNext.length) {
            content = parentNext.text().trim();
          }
        }

        if (!content) {
          let nextPs = element.parent().find("p").slice(0, 3);
          if (nextPs.length) {
            content = nextPs.text().trim();
          }
        }

        if (content && content.length > 50) {
          diagnosis = content;
          console.log(`   ✅ Extracted diagnosis (${content.length} chars)`);
          break;
        }
      }
    }

    // If still no diagnosis, try aggressive approach
    if (!diagnosis || diagnosis.length < 50) {
      console.log(`   🔄 Trying alternative diagnosis extraction...`);

      mainContent.find("p, div").each((i, el) => {
        const text = $(el).text().trim();
        if (
          text.length > 100 &&
          (text.toLowerCase().includes("diagnos") ||
            text.toLowerCase().includes("doctor") ||
            text.toLowerCase().includes("exam") ||
            text.toLowerCase().includes("evaluat"))
        ) {
          if (!diagnosis || diagnosis.length < text.length) {
            diagnosis = text;
          }
        }
      });
    }

    // Extract tests from diagnosis if present
    if (diagnosis) {
      const testsFromDiagnosis = extractTestsFromDiagnosis(diagnosis);
      if (testsFromDiagnosis.length > 0) {
        tests.push(...testsFromDiagnosis);
        console.log(
          `   📋 Extracted ${testsFromDiagnosis.length} tests from diagnosis`
        );
      }
    }

    // Enhanced selectors for tests (still try to find dedicated test sections)
    const testsSelectors = [
      'h2:contains("Tests")',
      'h3:contains("Tests")',
      'h2:contains("tests")',
      'h3:contains("tests")',
      'h2:contains("Testing")',
      'h3:contains("Testing")',
      'h2:contains("Screening")',
      'h3:contains("Screening")',
      'h2:contains("Exams")',
      'h3:contains("Exams")',
      ".tests",
      "#tests",
      '[id*="test"]',
      '[class*="test"]',
    ];

    // Extract tests content as structured list (only if we haven't found tests in diagnosis)
    if (tests.length === 0) {
      for (const selector of testsSelectors) {
        const element = mainContent.find(selector).first();
        if (element.length) {
          console.log(`   🎯 Found tests heading with: ${selector}`);

          const extractedTests = extractStructuredContent(element, $);
          if (extractedTests.length > 0) {
            tests = extractedTests;
            console.log(
              `   ✅ Extracted ${tests.length} test items from dedicated section`
            );
            break;
          }
        }
      }
    }

    // Enhanced selectors for treatment
    const treatmentSelectors = [
      'h2:contains("Treatment")',
      'h3:contains("Treatment")',
      'h2:contains("treatment")',
      'h3:contains("treatment")',
      'h2:contains("Therapy")',
      'h3:contains("Therapy")',
      'h2:contains("Management")',
      'h3:contains("Management")',
      'h2:contains("Care")',
      'h3:contains("Care")',
      ".treatment",
      "#treatment",
      '[id*="treatment"]',
      '[class*="treatment"]',
    ];

    // Extract treatment content as structured list
    for (const selector of treatmentSelectors) {
      const element = mainContent.find(selector).first();
      if (element.length) {
        console.log(`   🎯 Found treatment heading with: ${selector}`);

        const extractedTreatments = extractStructuredContent(element, $);
        if (extractedTreatments.length > 0) {
          treatment = extractedTreatments;
          console.log(`   ✅ Extracted ${treatment.length} treatment items`);
          break;
        }
      }
    }

    // Enhanced selectors for medications
    const medicationsSelectors = [
      'h2:contains("Medications")',
      'h3:contains("Medications")',
      'h2:contains("medications")',
      'h3:contains("medications")',
      'h2:contains("Drugs")',
      'h3:contains("Drugs")',
      'h2:contains("Medicine")',
      'h3:contains("Medicine")',
      'h2:contains("Alternative medicine")',
      'h3:contains("Alternative medicine")',
      ".medications",
      "#medications",
      '[id*="medication"]',
      '[class*="medication"]',
    ];

    // Extract medications content as structured list
    for (const selector of medicationsSelectors) {
      const element = mainContent.find(selector).first();
      if (element.length) {
        console.log(`   🎯 Found medications heading with: ${selector}`);

        const extractedMedications = extractStructuredContent(element, $);
        if (extractedMedications.length > 0) {
          medications = extractedMedications;
          console.log(`   ✅ Extracted ${medications.length} medication items`);
          break;
        }
      }
    }

    // Clean up the extracted text
    diagnosis = diagnosis
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .replace(/\t+/g, " ")
      .trim()
      .substring(0, 3000);

    // Join arrays with semicolons for CSV storage
    const testsString = tests
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter((item) => item.length > 5)
      .join("; ");

    const treatmentString = treatment
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter((item) => item.length > 5)
      .join("; ");

    const medicationsString = medications
      .map((item) => item.replace(/\s+/g, " ").trim())
      .filter((item) => item.length > 5)
      .join("; ");

    console.log(
      `   📊 Results: D:${diagnosis ? `✓(${diagnosis.length})` : "✗"} T:${
        testsString ? `✓(${tests.length} items)` : "✗"
      } Tr:${treatmentString ? `✓(${treatment.length} items)` : "✗"} M:${
        medicationsString ? `✓(${medications.length} items)` : "✗"
      }`
    );

    return {
      disease,
      diagnosis: diagnosis || "Information not found",
      tests: testsString || "Tests information not found",
      treatment: treatmentString || "Treatment information not found",
      medications: medicationsString || "Medications information not found",
      original_url: originalUrl,
      diagnosis_url: diagnosisUrl,
    };
  } catch (error) {
    console.error(`   ❌ Error scraping ${disease}:`, error.message);
    return {
      disease,
      diagnosis: "ERROR - " + error.message,
      tests: "ERROR - " + error.message,
      treatment: "ERROR - " + error.message,
      medications: "ERROR - " + error.message,
      original_url: originalUrl,
      diagnosis_url: diagnosisUrl,
    };
  }
}

async function loadDiseasesFromCsv() {
  try {
    const csvContent = fs.readFileSync(
      "../CSV/diseases_all_letters.csv",
      "utf8"
    );
    const lines = csvContent.split("\n").slice(1); // Skip header

    const diseases = [];
    const uniqueDiseases = new Map(); // Use Map to avoid duplicates

    for (const line of lines) {
      if (line.trim()) {
        const parts = line.split(",");
        if (parts.length >= 2) {
          const disease = parts[0].trim();
          const href = parts.slice(1).join(",").trim();

          // Only include actual disease pages (not navigation letters)
          if (
            disease &&
            href &&
            href.includes("/diseases-conditions/") &&
            !href.includes("?letter=") &&
            disease.length > 1 // Filter out single letters
          ) {
            // Use disease name as key to avoid duplicates
            uniqueDiseases.set(disease.toLowerCase(), { disease, href });
          }
        }
      }
    }

    const diseasesArray = Array.from(uniqueDiseases.values());
    console.log(`📋 Loaded ${diseasesArray.length} unique diseases from CSV`);

    // Sort alphabetically
    diseasesArray.sort((a, b) =>
      a.disease.toLowerCase().localeCompare(b.disease.toLowerCase())
    );

    return diseasesArray;
  } catch (error) {
    console.error("❌ Error reading CSV file:", error.message);
    return [];
  }
}

// Progress tracking functions
function saveProgressCheckpoint(results, currentIndex) {
  const checkpointData = {
    lastProcessedIndex: currentIndex,
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    results: results,
  };

  fs.writeFileSync(
    "scraping_checkpoint.json",
    JSON.stringify(checkpointData, null, 2)
  );
  console.log(`📝 Checkpoint saved at index ${currentIndex}`);
}

function loadProgressCheckpoint() {
  try {
    if (fs.existsSync("scraping_checkpoint.json")) {
      const checkpoint = JSON.parse(
        fs.readFileSync("scraping_checkpoint.json", "utf8")
      );
      console.log(`📋 Found checkpoint from ${checkpoint.timestamp}`);
      console.log(
        `   Previous progress: ${checkpoint.totalResults} diseases processed`
      );
      return checkpoint;
    }
  } catch (error) {
    console.log("⚠️ Could not load checkpoint, starting fresh");
  }
  return null;
}

// SINGLE Main execution - fixed to avoid duplicates
(async function main() {
  console.log("🔥 MAYO CLINIC SCRAPER STARTING...");
  console.log("🎯 Target: Extract diagnosis & treatment data for diseases");

  try {
    // Clear existing CSV file to avoid appending duplicates
    if (fs.existsSync("../CSV/diagnosis_treatment_data_full.csv")) {
      fs.unlinkSync("../CSV/diagnosis_treatment_data_full.csv");
      console.log("🧹 Cleared existing CSV file");
    }

    // Check for existing progress
    const checkpoint = loadProgressCheckpoint();
    let startIndex = 0;
    let existingResults = [];

    if (checkpoint) {
      console.log(
        `\n📋 Found checkpoint with ${checkpoint.totalResults} diseases processed`
      );
      const answer = "y"; // Auto-continue for full run
      if (answer.toLowerCase() === "y") {
        startIndex = checkpoint.lastProcessedIndex + 1;
        existingResults = checkpoint.results || [];
        console.log(`▶️ Resuming from disease ${startIndex + 1}`);
      } else {
        console.log(`🔄 Starting fresh...`);
      }
    }

    const diseases = await loadDiseasesFromCsv();

    if (diseases.length === 0) {
      console.log("❌ No valid diseases found in CSV.");
      console.log(
        "💡 Make sure ../CSV/diseases_all_letters.csv exists and contains data"
      );
      return;
    }

    console.log(`\n📊 Processing Summary:`);
    console.log(`   📋 Total diseases to process: ${diseases.length}`);
    console.log(`   🎯 Starting from index: ${startIndex}`);
    console.log(`   📈 Remaining to process: ${diseases.length - startIndex}`);

    const results = [...existingResults];
    let successCount = existingResults.filter(
      (r) => r.diagnosis !== "ERROR" && r.diagnosis !== "NO_DIAGNOSIS_URL"
    ).length;
    let errorCount = existingResults.filter(
      (r) => r.diagnosis === "ERROR" || r.diagnosis === "NO_DIAGNOSIS_URL"
    ).length;

    console.log(`\n🏃‍♂️ Starting processing...`);

    for (let i = startIndex; i < diseases.length; i++) {
      const { disease, href } = diseases[i];

      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 Processing ${i + 1}/${diseases.length}: ${disease}`);
      console.log(
        `📈 Progress: ${(((i + 1) / diseases.length) * 100).toFixed(1)}%`
      );
      console.log(
        `✅ Success so far: ${successCount} | ❌ Errors: ${errorCount}`
      );

      const result = await scrapeDiagnosisTreatment(disease, href);

      if (result) {
        results.push(result);
        if (
          result.diagnosis !== "ERROR" &&
          result.diagnosis !== "NO_DIAGNOSIS_URL"
        ) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      // Save checkpoint every 10 diseases (but don't save CSV yet)
      if ((i + 1) % 10 === 0) {
        saveProgressCheckpoint(results, i);
        console.log(
          `💾 Checkpoint saved (${results.length} diseases processed)`
        );
      }

      // Add delay between requests to be respectful
      if (i < diseases.length - 1) {
        console.log("⏳ Waiting 1 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // Final save - SINGLE WRITE OPERATION
    if (results.length > 0) {
      // Sort results alphabetically before final save
      const sortedResults = results.sort((a, b) =>
        a.disease.toLowerCase().localeCompare(b.disease.toLowerCase())
      );

      await csvWriter.writeRecords(sortedResults);
      saveJsonData(sortedResults);

      console.log(`\n🎉 MAYO CLINIC SCRAPING COMPLETED!`);
      console.log(`\n📊 Final Results:`);
      console.log(`   ✅ Successfully scraped: ${successCount}`);
      console.log(`   ❌ Errors/No URL: ${errorCount}`);
      console.log(`   📋 Total processed: ${results.length}`);
      console.log(
        `   📈 Success rate: ${((successCount / results.length) * 100).toFixed(
          1
        )}%`
      );
      console.log(
        `   💾 CSV saved to: ../CSV/diagnosis_treatment_data_full.csv`
      );
      console.log(`   💾 JSON saved to: scrapped-diseases.json`);

      // Clean up checkpoint file
      if (fs.existsSync("scraping_checkpoint.json")) {
        fs.unlinkSync("scraping_checkpoint.json");
        console.log(`🧹 Cleaned up checkpoint file`);
      }
    } else {
      console.log("❌ No data was scraped successfully.");
    }
  } catch (error) {
    console.error("💥 Fatal error:", error);
  }
})();
