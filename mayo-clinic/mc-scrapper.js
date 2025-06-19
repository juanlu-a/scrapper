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

function extractTextFromSection(section, $) {
  if (!section.length) return "";

  // Get all text content, including nested elements
  let text = section.text().trim();

  // Also try to get structured content (paragraphs, lists)
  const structuredText = section
    .find("p, li, div:not(:has(p)):not(:has(li))")
    .map((i, el) => $(el).text().trim())
    .get()
    .filter((t) => t.length > 10)
    .join(" | ");

  return structuredText || text;
}

// New function to parse content into arrays
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

// New function to save JSON data
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
    console.error("Error saving JSON data:", error.message);
  }
}

async function findDiagnosisTreatmentUrl(originalUrl) {
  console.log(`Looking for diagnosis & treatment link in: ${originalUrl}`);

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
          console.log(`Found diagnosis & treatment URL: ${href}`);
          return href;
        }
      }
    }

    console.log(`Could not find diagnosis & treatment link`);
    return null;
  } catch (error) {
    console.error(`Error finding diagnosis URL:`, error.message);
    return null;
  }
}

async function scrapeDiagnosisTreatment(disease, originalUrl) {
  console.log(`\n Starting scrape for: ${disease}`);

  // First, find the actual diagnosis & treatment URL
  const diagnosisUrl = await findDiagnosisTreatmentUrl(originalUrl);

  if (!diagnosisUrl) {
    console.log(`Could not find diagnosis & treatment URL for ${disease}`);
    return {
      disease,
      diagnosis: "NO_DIAGNOSIS_URL",
      tests: "NO_DIAGNOSIS_URL",
      treatment: "NO_DIAGNOSIS_URL",
      medications: "NO_DIAGNOSIS_URL",
      original_url: originalUrl,
      diagnosis_url: "NOT_FOUND",
    };
  }

  console.log(`\n Scraping diagnosis & treatment from: ${diagnosisUrl}`);

  try {
    const { data } = await axios.get(diagnosisUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
    });
    const $ = cheerio.load(data);

    const result = {
      disease,
      diagnosis: "",
      tests: "",
      treatment: "",
      medications: "",
      original_url: originalUrl,
      diagnosis_url: diagnosisUrl,
    };

    const possibleContainers = [
      ".main-content",
      ".content",
      "#main",
      ".article-body",
      ".page-content",
      "main",
      '[role="main"]',
      ".primary-content",
    ];

    let mainContent = null;
    for (const selector of possibleContainers) {
      mainContent = $(selector);
      if (mainContent.length) {
        break;
      }
    }

    if (!mainContent || !mainContent.length) {
      mainContent = $("body");
    }

    const headings = mainContent.find("h1, h2, h3, h4, h5, h6");

    // Extract content based on headings
    headings.each((i, heading) => {
      const $heading = $(heading);
      const headingText = $heading.text().toLowerCase().trim();

      // Get content until the next heading
      const nextHeading = $heading.nextAll("h1, h2, h3, h4, h5, h6").first();
      let sectionContent;

      if (nextHeading.length) {
        sectionContent = $heading.nextUntil(nextHeading);
      } else {
        sectionContent = $heading.nextAll();
      }

      // Check for different section types
      if (headingText.includes("diagnosis") && !headingText.includes("test")) {
        result.diagnosis = extractTextFromSection(sectionContent, $);
      }

      if (headingText.includes("test") || headingText.includes("exam")) {
        result.tests = extractTextFromSection(sectionContent, $);
      }

      if (
        headingText.includes("treatment") ||
        headingText.includes("therapy") ||
        headingText.includes("manage")
      ) {
        result.treatment = extractTextFromSection(sectionContent, $);
      }

      if (
        headingText.includes("medication") ||
        headingText.includes("drug") ||
        headingText.includes("medicine")
      ) {
        result.medications = extractTextFromSection(sectionContent, $);
      }
    });

    // Clean up the text
    Object.keys(result).forEach((key) => {
      if (
        typeof result[key] === "string" &&
        key !== "original_url" &&
        key !== "diagnosis_url"
      ) {
        result[key] = result[key]
          .replace(/\s+/g, " ")
          .replace(/\|+/g, " | ")
          .trim()
          .substring(0, 2000);
      }
    });

    console.log(
      `Results for ${disease}: D:${result.diagnosis ? "✓" : "✗"} T:${
        result.tests ? "✓" : "✗"
      } Tr:${result.treatment ? "✓" : "✗"} M:${result.medications ? "✓" : "✗"}`
    );

    return result;
  } catch (error) {
    console.error(`Error scraping ${disease}:`, error.message);
    return {
      disease,
      diagnosis: "ERROR",
      tests: "ERROR",
      treatment: "ERROR",
      medications: "ERROR",
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
            diseases.push({ disease, href });
          }
        }
      }
    }

    console.log(`Loaded ${diseases.length} valid diseases from CSV`);
    return diseases; // Process ALL diseases now
  } catch (error) {
    console.error("Error reading CSV file:", error.message);
    return [];
  }
}

// Progress tracking function
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
  console.log(`Checkpoint saved at index ${currentIndex}`);
}

// Load progress if exists
function loadProgressCheckpoint() {
  try {
    if (fs.existsSync("scraping_checkpoint.json")) {
      const checkpoint = JSON.parse(
        fs.readFileSync("scraping_checkpoint.json", "utf8")
      );
      console.log(`Found checkpoint from ${checkpoint.timestamp}`);
      console.log(
        `Previous progress: ${checkpoint.totalResults} diseases processed`
      );
      return checkpoint;
    }
  } catch (error) {
    console.log("⚠️ Could not load checkpoint, starting fresh");
  }
  return null;
}

(async function main() {
  console.log("Starting FULL diagnosis & treatment scraper...");
  console.log("PRODUCTION MODE: Processing ALL diseases");

  // Check for existing progress
  const checkpoint = loadProgressCheckpoint();
  let startIndex = 0;
  let existingResults = [];

  if (checkpoint) {
    const answer = "y"; // Auto-continue for full run
    if (answer.toLowerCase() === "y") {
      startIndex = checkpoint.lastProcessedIndex + 1;
      existingResults = checkpoint.results || [];
      console.log(`Resuming from disease ${startIndex + 1}`);
    }
  }

  const diseases = await loadDiseasesFromCsv();

  if (diseases.length === 0) {
    console.log("No valid diseases found.");
    return;
  }

  console.log(`Total diseases to process: ${diseases.length}`);
  console.log(`Starting from index: ${startIndex}`);

  const results = [...existingResults];
  let successCount = existingResults.filter(
    (r) => r.diagnosis !== "ERROR" && r.diagnosis !== "NO_DIAGNOSIS_URL"
  ).length;
  let errorCount = existingResults.filter(
    (r) => r.diagnosis === "ERROR" || r.diagnosis === "NO_DIAGNOSIS_URL"
  ).length;

  for (let i = startIndex; i < diseases.length; i++) {
    const { disease, href } = diseases[i];

    console.log(`\n Processing ${i + 1}/${diseases.length}: ${disease}`);
    console.log(`Progress: ${(((i + 1) / diseases.length) * 100).toFixed(1)}%`);

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

    // Save checkpoint every 10 diseases
    if ((i + 1) % 10 === 0) {
      saveProgressCheckpoint(results, i);

      // Also save partial CSV and JSON
      await csvWriter.writeRecords(results);
      saveJsonData(results);
      console.log(`Partial results saved to CSV and JSON files`);
    }

    // DOS
    if (i < diseases.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 second delay
    }
  }

  // Final save
  if (results.length > 0) {
    await csvWriter.writeRecords(results);
    saveJsonData(results);
    console.log(`\nFULL SCRAPING COMPLETED!`);
    console.log(`\nFinal Results:`);
    console.log(`\nSuccessfully scraped: ${successCount}`);
    console.log(`\nErrors/No URL: ${errorCount}`);
    console.log(`\nTotal processed: ${results.length}`);
    console.log(
      `\nSuccess rate: ${((successCount / results.length) * 100).toFixed(1)}%`
    );
    console.log(`   💾 CSV saved to: diagnosis_treatment_data_full.csv`);
    console.log(`   💾 JSON saved to: scrapped-diseases.json`);

    // Clean up checkpoint file
    if (fs.existsSync("scraping_checkpoint.json")) {
      fs.unlinkSync("scraping_checkpoint.json");
      console.log(`🧹 Cleaned up checkpoint file`);
    }
  } else {
    console.log("No data was scraped successfully.");
  }
})();
