const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

// Function to find diagnosis & treatment URL from symptoms-causes page
async function findDiagnosisTreatmentUrl(symptomsUrl) {
  console.log(`   🔍 Finding diagnosis URL for: ${symptomsUrl}`);

  try {
    // Get the symptoms page content
    const { data } = await axios.get(symptomsUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(data);

    // Look for "Diagnosis & treatment" tab/button
    const diagnosisSelectors = [
      // Exact text matches
      'a:contains("Diagnosis & treatment")',
      'a:contains("Diagnosis and treatment")',
      'button:contains("Diagnosis & treatment")',

      // Partial matches
      'a:contains("Diagnosis")',
      'button:contains("Diagnosis")',

      // By href pattern
      'a[href*="/diagnosis-treatment/"]',

      // Common Mayo Clinic navigation structures
      '.cmp-tabs a:contains("Diagnosis")',
      '.page-tabs a:contains("Diagnosis")',
      '.nav-tabs a:contains("Diagnosis")',
      'nav a:contains("Diagnosis")',
      '.section-nav a:contains("Diagnosis")',
    ];

    for (const selector of diagnosisSelectors) {
      const elements = $(selector);

      if (elements.length > 0) {
        console.log(
          `   🎯 Found ${elements.length} elements with selector: ${selector}`
        );

        // Check each element
        for (let i = 0; i < elements.length; i++) {
          const element = elements.eq(i);
          const href = element.attr("href");
          const text = element.text().trim();

          console.log(`   📝 Checking element: "${text}" -> ${href}`);

          if (
            href &&
            (text.toLowerCase().includes("diagnosis") ||
              text.toLowerCase().includes("treatment"))
          ) {
            // Make sure it's a full URL
            let fullUrl = href;
            if (!href.startsWith("http")) {
              fullUrl = `https://www.mayoclinic.org${href}`;
            }

            console.log(`   ✅ Found diagnosis URL: ${fullUrl}`);
            return { url: fullUrl, status: "FOUND_IN_PAGE" };
          }
        }
      }
    }

    console.log(`   ❌ No diagnosis URL found in page`);
    return { url: null, status: "NOT_FOUND" };
  } catch (error) {
    console.error(`   💥 Error accessing page: ${error.message}`);
    return { url: null, status: "ERROR" };
  }
}

// Function to process existing diseases CSV
async function processExistingDiseasesCSV() {
  console.log("🔥 MAYO CLINIC DIAGNOSIS URL FINDER STARTING...");
  console.log(
    "🎯 Goal: Find 'Diagnosis & treatment' URLs from existing symptoms pages"
  );

  try {
    // Clear the output file first to prevent duplicate entries
    if (fs.existsSync("../CSV/diseases_with_diagnosis_urls.csv")) {
      fs.unlinkSync("../CSV/diseases_with_diagnosis_urls.csv");
      console.log("🧹 Cleared existing output CSV file");
    }

    // Create CSV writer for the output with diagnosis URLs
    const csvWriter = createCsvWriter({
      path: "/Users/juanlu/Documents/Wye/scrapper/CSV/diseases_with_diagnosis_urls.csv",
      header: [
        { id: "disease", title: "Disease" },
        { id: "symptoms_href", title: "Symptoms_URL" },
        { id: "diagnosis_href", title: "Diagnosis_URL" },
        { id: "status", title: "Status" },
      ],
    });

    // Read the diseases_all_letters.csv file
    const csvContent = fs.readFileSync(
      "/Users/juanlu/Documents/Wye/scrapper/CSV/diseases_all_letters.csv",
      "utf8"
    );
    const lines = csvContent.split("\n").slice(1); // Skip header

    const diseases = [];
    for (const line of lines) {
      if (line.trim()) {
        const commaIndex = line.indexOf(",");
        if (commaIndex > 0) {
          const disease = line.substring(0, commaIndex).trim();
          const href = line.substring(commaIndex + 1).trim();

          if (disease && href) {
            diseases.push({ disease, href });
          }
        }
      }
    }

    console.log(`📋 Loaded ${diseases.length} diseases from CSV`);

    // Process each disease
    const processedDiseases = [];
    let successCount = 0;
    let notFoundCount = 0;
    let errorCount = 0;

    // Create a set to track already processed diseases (prevent duplicates)
    const processedDiseaseSet = new Set();

    for (let i = 0; i < diseases.length; i++) {
      const { disease, href } = diseases[i];

      // Skip if we've already processed this disease (by URL)
      const diseaseKey = href.toLowerCase();
      if (processedDiseaseSet.has(diseaseKey)) {
        console.log(`\n⚠️ Skipping duplicate disease URL: ${href}`);
        continue;
      }

      // Mark as processed
      processedDiseaseSet.add(diseaseKey);

      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 Processing ${i + 1}/${diseases.length}: ${disease}`);
      console.log(
        `📈 Progress: ${(((i + 1) / diseases.length) * 100).toFixed(1)}%`
      );
      console.log(
        `📊 Success: ${successCount} | Not Found: ${notFoundCount} | Errors: ${errorCount}`
      );

      // Find diagnosis URL for this disease
      const diagnosisResult = await findDiagnosisTreatmentUrl(href);

      const processedDisease = {
        disease,
        symptoms_href: href,
        diagnosis_href: diagnosisResult.url || "NOT_FOUND",
        status: diagnosisResult.status,
      };

      processedDiseases.push(processedDisease);

      // Update counters
      if (diagnosisResult.status === "ERROR") {
        errorCount++;
      } else if (diagnosisResult.url) {
        successCount++;
        console.log(`   ✅ SUCCESS: Found diagnosis URL`);
      } else {
        notFoundCount++;
        console.log(`   ❌ NOT FOUND`);
      }

      // Write checkpoint file (JSON) every 50 diseases (NOT the main CSV)
      if ((i + 1) % 50 === 0) {
        console.log(`💾 Saving checkpoint data...`);
        fs.writeFileSync(
          "diagnosis_finder_checkpoint.json",
          JSON.stringify(
            {
              timestamp: new Date().toISOString(),
              progress: i + 1,
              total: diseases.length,
              diseases: processedDiseases,
            },
            null,
            2
          )
        );
      }

      // Be respectful - wait between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Only write the CSV once at the very end
    console.log(
      `\n💾 Writing final CSV with ${processedDiseases.length} entries...`
    );
    await csvWriter.writeRecords(processedDiseases);

    console.log(`\n🎉 PROCESSING COMPLETED!`);
    console.log(`📊 FINAL RESULTS:`);
    console.log(`   📋 Total processed: ${processedDiseases.length}`);
    console.log(`   ✅ Found: ${successCount}`);
    console.log(`   ❌ Not found: ${notFoundCount}`);
    console.log(`   💥 Errors: ${errorCount}`);
    console.log(
      `   📈 Success rate: ${(
        (successCount / processedDiseases.length) *
        100
      ).toFixed(1)}%`
    );
    console.log(`💾 Data saved to: ../CSV/diseases_with_diagnosis_urls.csv`);

    // Save a backup JSON
    fs.writeFileSync(
      "diseases_with_diagnosis_complete.json",
      JSON.stringify(processedDiseases, null, 2)
    );
    console.log(`💾 Backup saved to: diseases_with_diagnosis_complete.json`);

    // Show some successful examples
    const successful = processedDiseases
      .filter((d) => d.diagnosis_href !== "NOT_FOUND")
      .slice(0, 3);
    if (successful.length > 0) {
      console.log(`\n📋 Sample successful finds:`);
      successful.forEach((d, i) => {
        console.log(`   ${i + 1}. ${d.disease}`);
        console.log(`      Diagnosis URL: ${d.diagnosis_href}`);
      });
    }
  } catch (error) {
    console.error("💥 Fatal error:", error);
  }
}

// Execute the processor
(function main() {
  processExistingDiseasesCSV();
})();
