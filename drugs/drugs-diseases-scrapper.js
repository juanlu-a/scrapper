const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

// Create CSV writers for different outputs
const diseasesWriter = createCsvWriter({
  path: "../CSV/diseases_all_letters.csv",
  header: [
    { id: "disease", title: "Disease" },
    { id: "href", title: "URL" },
    { id: "letter", title: "Letter" },
  ],
});

const diseasesDrugsWriter = createCsvWriter({
  path: "../CSV/diseases_drugs_families.csv",
  header: [
    { id: "disease", title: "Disease" },
    { id: "drug_family", title: "Drug_Family" },
    { id: "drug_name", title: "Drug_Name" },
    { id: "drug_url", title: "Drug_URL" },
    { id: "disease_url", title: "Disease_URL" },
  ],
});

// Global tracking to prevent duplicates
const globalDiseases = new Set();
const globalDiseasesDrugs = new Set();

// Function to scrape diseases for a specific letter
async function scrapeDiseasesForLetter(letter) {
  const url = `https://www.drugs.com/condition/${letter.toLowerCase()}.html`;
  console.log(
    `\n🔍 Scraping diseases for letter ${letter.toUpperCase()}: ${url}`
  );

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        Connection: "keep-alive",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const diseases = [];

    // Various selectors for disease links
    const diseaseSelectors = [
      '.ddc-list-column-2 a[href*="/condition/"]',
      '.ddc-list a[href*="/condition/"]',
      '.contentBox a[href*="/condition/"]',
      'ul.ddc-list-unstyled a[href*="/condition/"]',
      'a[href*="/condition/"][href$=".html"]',
      '.ddc-media-list a[href*="/condition/"]',
    ];

    let foundValidDiseases = false;

    // Collect ALL disease links first, then deduplicate
    const allDiseaseLinks = new Map(); // Use Map to avoid duplicates by href

    for (const selector of diseaseSelectors) {
      const diseaseLinks = $(selector);

      if (diseaseLinks.length > 0) {
        console.log(
          `   🎯 Testing selector "${selector}" - found ${diseaseLinks.length} links`
        );

        diseaseLinks.each((i, element) => {
          const $link = $(element);
          const diseaseName = $link.text().trim();
          let href = $link.attr("href");

          if (
            diseaseName &&
            href &&
            diseaseName.length > 1 &&
            diseaseName.length < 100 &&
            // Filter out navigation and non-disease links
            !diseaseName.toLowerCase().includes("home") &&
            !diseaseName.toLowerCase().includes("about") &&
            !diseaseName.toLowerCase().includes("contact") &&
            !diseaseName.toLowerCase().includes("privacy") &&
            !diseaseName.toLowerCase().includes("terms") &&
            !diseaseName.toLowerCase().includes("next") &&
            !diseaseName.toLowerCase().includes("previous") &&
            !diseaseName.toLowerCase().includes("page") &&
            !diseaseName.includes("»") &&
            !diseaseName.includes("«") &&
            !diseaseName.includes("...") &&
            href.includes("/condition/") &&
            href.includes(".html")
          ) {
            // Make sure it's a full URL
            if (href.startsWith("/")) {
              href = "https://www.drugs.com" + href;
            }

            // Use href as key to avoid URL duplicates within this letter
            if (!allDiseaseLinks.has(href)) {
              allDiseaseLinks.set(href, {
                disease: diseaseName,
                href: href,
                letter: letter.toUpperCase(),
              });
            }
          }
        });

        // If we found valid links with this selector, we're done
        if (allDiseaseLinks.size > 0) {
          foundValidDiseases = true;
          console.log(
            `   ✅ Using selector "${selector}" - found ${allDiseaseLinks.size} unique disease links`
          );
          break;
        }
      }
    }

    // Now filter against global tracking and add new diseases
    const tempDiseases = [];
    for (const [href, diseaseData] of allDiseaseLinks) {
      const diseaseKey = diseaseData.disease.toLowerCase().trim();

      if (!globalDiseases.has(diseaseKey)) {
        // Add to global tracking
        globalDiseases.add(diseaseKey);
        tempDiseases.push(diseaseData);
        console.log(`   ✅ NEW disease added: ${diseaseData.disease}`);
      } else {
        console.log(`   🔄 SKIPPING duplicate: ${diseaseData.disease}`);
      }
    }

    if (tempDiseases.length > 0) {
      diseases.push(...tempDiseases);
    }

    if (!foundValidDiseases) {
      console.log(
        `   ⚠️ No NEW diseases found for letter ${letter.toUpperCase()}`
      );

      // Debug: Show what links we did find
      const allConditionLinks = $('a[href*="/condition/"]');
      console.log(
        `   🔍 Debug: Found ${allConditionLinks.length} total condition links`
      );
      if (allConditionLinks.length > 0) {
        allConditionLinks.slice(0, 3).each((i, el) => {
          const $el = $(el);
          console.log(
            `     Sample link: "${$el.text().trim()}" -> ${$el.attr("href")}`
          );
        });
      }
    }

    console.log(
      `   📊 Letter ${letter.toUpperCase()} summary: ${
        diseases.length
      } NEW diseases`
    );
    console.log(
      `   🌐 Global total: ${globalDiseases.size} unique diseases tracked`
    );

    return diseases;
  } catch (error) {
    console.error(`   ❌ Error scraping letter ${letter}:`, error.message);
    return [];
  }
}

// Function to scrape drug families and drugs for a specific disease
async function scrapeDrugsForDisease(disease, diseaseUrl) {
  console.log(`\n🔍 Scraping drugs for disease: ${disease}`);
  console.log(`   📄 URL: ${diseaseUrl}`);

  try {
    const { data } = await axios.get(diseaseUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 15000,
    });

    const $ = cheerio.load(data);
    const diseasesDrugs = [];

    // Look for drug family sections
    const familySelectors = [
      ".ddc-media-list",
      ".drug-class-list",
      ".contentBox",
      ".ddc-list-column-2",
      'div[class*="drug"]',
      'div[class*="class"]',
    ];

    let foundDrugFamilies = false;

    // Try to find drug families/categories
    familySelectors.forEach((selector) => {
      const familySections = $(selector);

      familySections.each((i, section) => {
        const $section = $(section);

        // Look for family/category headers
        const familyHeader = $section
          .find("h3, h4, h5, .ddc-media-object-title, .drug-class-title")
          .first();
        const familyName = familyHeader.text().trim();

        if (familyName && familyName.length > 3 && familyName.length < 100) {
          console.log(`   📋 Found drug family: ${familyName}`);

          // Find drugs in this family
          const drugLinks = $section.find(
            'a[href*="/mtm/"], a[href*="/pro/"], a[href*="/cons/"], a[href*="/drug/"]'
          );

          drugLinks.each((j, drugElement) => {
            const $drug = $(drugElement);
            const drugName = $drug.text().trim();
            let drugHref = $drug.attr("href");

            if (drugName && drugHref && drugName.length > 1) {
              // Make sure it's a full URL
              if (drugHref.startsWith("/")) {
                drugHref = "https://www.drugs.com" + drugHref;
              }

              // Create unique key for this disease-drug combination
              const key = `${disease.toLowerCase()}|${drugName.toLowerCase()}|${familyName.toLowerCase()}`;

              if (!globalDiseasesDrugs.has(key)) {
                globalDiseasesDrugs.add(key);

                diseasesDrugs.push({
                  disease: disease,
                  drug_family: familyName,
                  drug_name: drugName,
                  drug_url: drugHref,
                  disease_url: diseaseUrl,
                });

                console.log(`     ✅ Added drug: ${drugName} (${familyName})`);
                foundDrugFamilies = true;
              }
            }
          });
        }
      });
    });

    // If no families found, look for direct drug links
    if (!foundDrugFamilies) {
      console.log(
        `   🔄 No drug families found, looking for direct drug links...`
      );

      const directDrugLinks = $(
        'a[href*="/mtm/"], a[href*="/pro/"], a[href*="/cons/"], a[href*="/drug/"]'
      );

      directDrugLinks.each((i, element) => {
        const $drug = $(element);
        const drugName = $drug.text().trim();
        let drugHref = $drug.attr("href");

        if (
          drugName &&
          drugHref &&
          drugName.length > 1 &&
          drugName.length < 50
        ) {
          // Make sure it's a full URL
          if (drugHref.startsWith("/")) {
            drugHref = "https://www.drugs.com" + drugHref;
          }

          // Create unique key for this disease-drug combination
          const key = `${disease.toLowerCase()}|${drugName.toLowerCase()}|general`;

          if (!globalDiseasesDrugs.has(key)) {
            globalDiseasesDrugs.add(key);

            diseasesDrugs.push({
              disease: disease,
              drug_family: "General/Unspecified",
              drug_name: drugName,
              drug_url: drugHref,
              disease_url: diseaseUrl,
            });

            console.log(`     ✅ Added drug: ${drugName} (General)`);
            foundDrugFamilies = true;
          }
        }
      });
    }

    if (!foundDrugFamilies) {
      console.log(`   ⚠️ No drugs found for disease: ${disease}`);
    }

    console.log(
      `   📊 Found ${diseasesDrugs.length} drug entries for ${disease}`
    );
    return diseasesDrugs;
  } catch (error) {
    console.error(`   ❌ Error scraping drugs for ${disease}:`, error.message);
    return [];
  }
}

// Main function to scrape all diseases by letters
async function scrapeAllDiseases() {
  const allDiseases = []; // Keep for returning to main function
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  console.log("🚀 Starting diseases scraper...");
  console.log(`📋 Will scrape ${letters.length} letters for diseases`);

  // Clear existing CSV files
  if (fs.existsSync("../CSV/diseases_all_letters.csv")) {
    fs.unlinkSync("../CSV/diseases_all_letters.csv");
    console.log("🧹 Cleared existing diseases CSV file");
  }

  // Clear global tracking
  globalDiseases.clear();
  console.log("🧹 Cleared global disease tracking");

  let totalFound = 0;

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    console.log(`\n${"=".repeat(80)}`);
    console.log(`📍 Processing letter ${i + 1}/${letters.length}: ${letter}`);
    console.log(
      `📈 Progress: ${(((i + 1) / letters.length) * 100).toFixed(1)}%`
    );
    console.log(`📊 Global diseases tracked: ${globalDiseases.size}`);

    const diseasesForLetter = await scrapeDiseasesForLetter(letter);

    if (diseasesForLetter.length > 0) {
      // Write NEW diseases to CSV immediately to avoid ABABCABCD pattern
      await diseasesWriter.writeRecords(diseasesForLetter);

      // Keep track for returning (but these are already deduplicated)
      allDiseases.push(...diseasesForLetter);
      totalFound += diseasesForLetter.length;
      console.log(
        `   ✅ Added ${diseasesForLetter.length} NEW diseases to CSV (Running total: ${totalFound})`
      );
    } else {
      console.log(`   ⚠️ No NEW diseases found for letter ${letter}`);
    }

    // Respectful delay
    if (i < letters.length - 1) {
      console.log(`   ⏳ Waiting 2 seconds...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  return allDiseases;
}

// Main function to scrape drugs for all diseases
async function scrapeDrugsForAllDiseases(diseases) {
  console.log(`\n🔥 Starting drug scraping for ${diseases.length} diseases...`);

  // Deduplicate diseases by URL to avoid processing same condition multiple times
  const uniqueDiseasesMap = new Map();
  diseases.forEach(({ disease, href, letter }) => {
    if (!uniqueDiseasesMap.has(href)) {
      uniqueDiseasesMap.set(href, { disease, href, letter });
    }
  });

  const uniqueDiseases = Array.from(uniqueDiseasesMap.values());

  console.log(`📊 Original diseases: ${diseases.length}`);
  console.log(`📊 Unique diseases (by URL): ${uniqueDiseases.length}`);
  console.log(
    `🔗 Eliminated ${diseases.length - uniqueDiseases.length} duplicate URLs`
  );

  // Clear existing CSV file
  if (fs.existsSync("../CSV/diseases_drugs_families.csv")) {
    fs.unlinkSync("../CSV/diseases_drugs_families.csv");
    console.log("🧹 Cleared existing diseases-drugs CSV file");
  }

  // Clear global tracking
  globalDiseasesDrugs.clear();

  const allDiseasesDrugs = [];
  let successCount = 0;
  let errorCount = 0;

  for (let i = 0; i < uniqueDiseases.length; i++) {
    const { disease, href } = uniqueDiseases[i];

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📋 Processing ${i + 1}/${uniqueDiseases.length}: ${disease}`);
    console.log(
      `📈 Progress: ${(((i + 1) / uniqueDiseases.length) * 100).toFixed(1)}%`
    );
    console.log(`📊 Success: ${successCount} | Errors: ${errorCount}`);

    const diseasesDrugs = await scrapeDrugsForDisease(disease, href);

    if (diseasesDrugs.length > 0) {
      allDiseasesDrugs.push(...diseasesDrugs);
      successCount++;
      console.log(`   ✅ SUCCESS: Found ${diseasesDrugs.length} drug entries`);
    } else {
      errorCount++;
      console.log(`   ❌ No drugs found for disease`);
    }

    // Save progress every 25 diseases
    if ((i + 1) % 25 === 0) {
      console.log(`💾 Saving checkpoint at disease ${i + 1}...`);
      await diseasesDrugsWriter.writeRecords(allDiseasesDrugs);
      // Clear the array after saving to prevent memory issues
      allDiseasesDrugs.length = 0;
    }

    // Respectful delay
    await new Promise((resolve) => setTimeout(resolve, 1500));
  }

  // Final save of remaining diseases-drugs data
  if (allDiseasesDrugs.length > 0) {
    await diseasesDrugsWriter.writeRecords(allDiseasesDrugs);
  }

  return { uniqueDiseases, allDiseasesDrugs };
}

// Main execution function
(async function main() {
  console.log("🔥 DRUGS.COM DISEASES & DRUG FAMILIES SCRAPER STARTING...");
  console.log(
    "🎯 Goal: Extract diseases, drug families, and drug relationships"
  );

  try {
    // Step 1: Scrape all diseases by letters
    console.log("\n📍 STEP 1: Scraping diseases by letters...");
    const allDiseases = await scrapeAllDiseases();

    if (allDiseases.length === 0) {
      throw new Error(
        "No diseases found! Check network connection or website structure."
      );
    }

    // Save diseases to CSV (already done incrementally in scrapeAllDiseases)
    console.log(`\n✅ STEP 1 COMPLETED!`);
    console.log(`📊 Found ${allDiseases.length} unique diseases`);
    console.log(`💾 Diseases saved to: ../CSV/diseases_all_letters.csv`);

    // Step 2: Scrape drugs and families for each disease
    console.log("\n📍 STEP 2: Scraping drugs and families for each disease...");
    const { uniqueDiseases, allDiseasesDrugs } =
      await scrapeDrugsForAllDiseases(allDiseases);

    // Since we save incrementally, we need to read the final CSV to get actual count
    let finalCount = 0;
    if (fs.existsSync("../CSV/diseases_drugs_families.csv")) {
      const csvContent = fs.readFileSync(
        "../CSV/diseases_drugs_families.csv",
        "utf8"
      );
      const lines = csvContent.split("\n").filter((line) => line.trim() !== "");
      finalCount = Math.max(0, lines.length - 1); // Subtract header row
    }

    console.log(`\n🎉 SCRAPING COMPLETED SUCCESSFULLY!`);
    console.log(`📊 FINAL RESULTS:`);
    console.log(`   📋 Total diseases scraped: ${allDiseases.length}`);
    console.log(`   📋 Unique diseases processed: ${uniqueDiseases.length}`);
    console.log(`   💊 Total disease-drug relationships: ${finalCount}`);
    console.log(`   💾 Diseases data: ../CSV/diseases_all_letters.csv`);
    console.log(`   💾 Disease-drugs data: ../CSV/diseases_drugs_families.csv`);

    // Show some statistics (if we have recent data in allDiseasesDrugs)
    if (finalCount > 0) {
      console.log(`\n📈 STATISTICS:`);
      console.log(
        `   🔗 Average drugs per disease: ${(
          finalCount / uniqueDiseases.length
        ).toFixed(2)}`
      );

      // For detailed stats, we'd need to read the CSV again
      console.log(
        `   📊 For detailed drug family statistics, check the CSV file`
      );
    }

    console.log(
      `\n🎯 Next step: Run drugs-diseases-analyze.js to create Excel analysis!`
    );
  } catch (error) {
    console.error("💥 Fatal error:", error);
    console.error(error.stack);
  }
})();
