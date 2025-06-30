const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

// Create CSV writer for the output
const csvWriter = createCsvWriter({
  path: "/Users/juanlu/Documents/Wye/scrapper/CSV/diseases_all_letters.csv",
  header: [
    { id: "disease", title: "Disease" },
    { id: "href", title: "Href" },
  ],
});

// Base URL for Mayo Clinic diseases index
const BASE_URL = "https://www.mayoclinic.org/diseases-conditions/index";

// All available letters and special characters
const LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "M",
  "N",
  "O",
  "P",
  "Q",
  "R",
  "S",
  "T",
  "U",
  "V",
  "W",
  "X",
  "Y",
  "Z",
  "#",
];

// Function to scrape diseases for a specific letter
async function scrapeDiseasesByLetter(letter) {
  console.log(`🔍 Scraping diseases for letter: ${letter}`);

  try {
    const url =
      letter === "#"
        ? `${BASE_URL}?letter=%23`
        : `${BASE_URL}?letter=${letter}`;

    console.log(`   📄 Fetching: ${url}`);

    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
      },
      timeout: 10000,
    });

    const $ = cheerio.load(data);
    const diseases = [];

    // Enhanced selectors for Mayo Clinic disease listings
    const diseaseSelectors = [
      'a[href*="/diseases-conditions/"][href*="/symptoms-causes/"]',
      'a[href*="/diseases-conditions/"]',
      ".cmp-contentlist__item a",
      ".index-list a",
      ".disease-list a",
      ".conditions-list a",
      ".directory-list a",
      'ul li a[href*="/diseases-conditions/"]',
      '.cmp-list a[href*="/diseases-conditions/"]',
    ];

    let foundDiseases = false;

    for (const selector of diseaseSelectors) {
      const links = $(selector);

      if (links.length > 0) {
        console.log(
          `   ✅ Testing selector "${selector}" - found ${links.length} links`
        );

        const tempDiseases = [];

        links.each((i, element) => {
          const $link = $(element);
          const href = $link.attr("href");
          const text = $link.text().trim();

          if (href && text && href.includes("/diseases-conditions/")) {
            // Make sure it's a full URL
            const fullUrl = href.startsWith("http")
              ? href
              : `https://www.mayoclinic.org${href}`;

            // Enhanced filtering for actual disease pages
            if (
              text.length > 1 &&
              text.length < 100 && // Avoid very long navigation texts
              !href.includes("?letter=") &&
              !text.toLowerCase().includes("view all") &&
              !text.toLowerCase().includes("see all") &&
              !text.toLowerCase().includes("more") &&
              !text.toLowerCase().includes("conditions index") &&
              !text.toLowerCase().includes("diseases index") &&
              !text.toLowerCase().includes("mayo clinic") &&
              !text.toLowerCase().includes("contact") &&
              !text.toLowerCase().includes("about") &&
              !text.toLowerCase().includes("home") &&
              !text.toLowerCase().includes("search") &&
              // Filter out navigation elements
              !text.match(/^[A-Z]$/) && // Single letters
              !text.match(/^\d+$/) && // Pure numbers
              // Ensure it's likely a condition name
              (href.includes("/symptoms-causes/") ||
                href.includes("/diagnosis-treatment/") ||
                href.match(/diseases-conditions\/[a-z0-9-]+\/?$/))
            ) {
              // Prefer symptoms-causes URLs, but normalize to symptoms-causes format
              let normalizedUrl = fullUrl;
              if (fullUrl.includes("/diagnosis-treatment/")) {
                normalizedUrl = fullUrl.replace(
                  "/diagnosis-treatment/",
                  "/symptoms-causes/"
                );
              }

              tempDiseases.push({
                disease: text,
                href: normalizedUrl,
              });
            }
          }
        });

        // If we found a good number of diseases with this selector, use it
        if (tempDiseases.length > 5) {
          diseases.push(...tempDiseases);
          foundDiseases = true;
          console.log(
            `   ✅ Using selector "${selector}" - found ${tempDiseases.length} valid diseases`
          );
          break;
        }
      }
    }

    if (!foundDiseases) {
      console.log(
        `   ⚠️ No diseases found for letter ${letter} - trying alternative approach`
      );

      // Alternative approach: look for any disease condition links
      $("a").each((i, element) => {
        const $link = $(element);
        const href = $link.attr("href");
        const text = $link.text().trim();

        if (
          href &&
          text &&
          href.includes("/diseases-conditions/") &&
          text.length > 2 &&
          text.length < 80 &&
          !href.includes("?letter=")
        ) {
          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.mayoclinic.org${href}`;

          // Check if it's not already added and looks like a disease
          if (
            !diseases.some(
              (d) =>
                d.href === fullUrl ||
                d.disease.toLowerCase() === text.toLowerCase()
            )
          ) {
            diseases.push({
              disease: text,
              href: fullUrl,
            });
          }
        }
      });
    }

    // Remove duplicates based on disease name (case insensitive)
    const uniqueDiseases = [];
    const seenDiseases = new Set();

    diseases.forEach((disease) => {
      const key = disease.disease.toLowerCase().trim();
      if (!seenDiseases.has(key) && key.length > 1) {
        seenDiseases.add(key);
        uniqueDiseases.push(disease);
      }
    });

    console.log(
      `   📊 Found ${uniqueDiseases.length} unique diseases for letter ${letter}`
    );

    // Show sample diseases
    if (uniqueDiseases.length > 0) {
      console.log(`   📋 Sample diseases:`);
      uniqueDiseases.slice(0, 3).forEach((disease, index) => {
        console.log(`     ${index + 1}. ${disease.disease}`);
      });
    }

    return uniqueDiseases;
  } catch (error) {
    console.error(`   ❌ Error scraping letter ${letter}:`, error.message);
    return [];
  }
}

// Main function to scrape all letters
async function scrapeAllLetters() {
  console.log("🔥 MAYO CLINIC LETTERS SCRAPER STARTING...");
  console.log("🎯 Target: Create clean diseases_all_letters.csv");

  const allDiseases = [];
  let totalDiseases = 0;

  try {
    // Clear existing CSV file
    if (fs.existsSync("../CSV/diseases_all_letters.csv")) {
      fs.unlinkSync("../CSV/diseases_all_letters.csv");
      console.log("🧹 Cleared existing CSV file");
    }

    // Process each letter
    for (let i = 0; i < LETTERS.length; i++) {
      const letter = LETTERS[i];

      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 Processing ${i + 1}/${LETTERS.length}: Letter ${letter}`);
      console.log(
        `📈 Progress: ${(((i + 1) / LETTERS.length) * 100).toFixed(1)}%`
      );

      const diseases = await scrapeDiseasesByLetter(letter);
      allDiseases.push(...diseases);

      const newDiseases = diseases.length;
      totalDiseases += newDiseases;

      console.log(`   ✅ Added ${newDiseases} diseases`);
      console.log(`   📊 Total diseases so far: ${totalDiseases}`);

      // Add delay between requests to be respectful
      if (i < LETTERS.length - 1) {
        console.log("   ⏳ Waiting 2 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Remove global duplicates based on href and disease name
    console.log(`\n🔄 Removing duplicates...`);
    const uniqueDiseases = [];
    const seenUrls = new Set();
    const seenNames = new Set();

    allDiseases.forEach((disease) => {
      const nameKey = disease.disease.toLowerCase().trim();
      const urlKey = disease.href.toLowerCase();

      if (!seenUrls.has(urlKey) && !seenNames.has(nameKey)) {
        seenUrls.add(urlKey);
        seenNames.add(nameKey);
        uniqueDiseases.push(disease);
      }
    });

    console.log(`📊 DEDUPLICATION SUMMARY:`);
    console.log(`   📋 Total entries collected: ${allDiseases.length}`);
    console.log(`   🔗 Unique entries: ${uniqueDiseases.length}`);
    console.log(
      `   🔄 Duplicates removed: ${allDiseases.length - uniqueDiseases.length}`
    );

    // Sort alphabetically by disease name
    const sortedDiseases = uniqueDiseases.sort((a, b) =>
      a.disease.toLowerCase().localeCompare(b.disease.toLowerCase())
    );

    // Write to CSV
    await csvWriter.writeRecords(sortedDiseases);

    console.log(`\n🎉 SCRAPING COMPLETED!`);
    console.log(`💾 Data saved to: ../CSV/diseases_all_letters.csv`);
    console.log(`📄 Total unique records: ${sortedDiseases.length}`);

    // Show sample of results
    console.log(`\n📋 Sample entries (first 10):`);
    sortedDiseases.slice(0, 10).forEach((disease, index) => {
      console.log(`   ${index + 1}. ${disease.disease}`);
    });

    // Create a backup JSON file as well
    fs.writeFileSync(
      "diseases_all_letters_backup.json",
      JSON.stringify(sortedDiseases, null, 2)
    );
    console.log(`💾 Backup saved to: diseases_all_letters_backup.json`);

    // Show letter distribution
    console.log(`\n📈 Distribution by first letter:`);
    const letterDistribution = {};
    sortedDiseases.forEach((disease) => {
      const firstLetter = disease.disease.charAt(0).toUpperCase();
      letterDistribution[firstLetter] =
        (letterDistribution[firstLetter] || 0) + 1;
    });

    Object.entries(letterDistribution)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([letter, count]) => {
        console.log(`   ${letter}: ${count} diseases`);
      });
  } catch (error) {
    console.error("💥 Fatal error:", error);
  }
}

// Execute the scraper
(function main() {
  scrapeAllLetters();
})();
