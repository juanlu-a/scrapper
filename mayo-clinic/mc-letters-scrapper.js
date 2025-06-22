const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

// Create CSV writer for the output
const csvWriter = createCsvWriter({
  path: "../CSV/diseases_all_letters.csv",
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
    });

    const $ = cheerio.load(data);
    const diseases = [];

    // First, add the letter index link itself
    diseases.push({
      disease: letter,
      href: url,
    });

    // Find disease links - Mayo Clinic typically uses specific selectors for disease listings
    const diseaseSelectors = [
      'a[href*="/diseases-conditions/"]',
      ".index-list a",
      ".disease-list a",
      ".conditions-list a",
      ".directory-list a",
      'ul li a[href*="/diseases-conditions/"]',
    ];

    let foundDiseases = false;

    for (const selector of diseaseSelectors) {
      const links = $(selector);

      if (links.length > 0) {
        console.log(
          `   ✅ Found ${links.length} links with selector: ${selector}`
        );

        links.each((i, element) => {
          const $link = $(element);
          const href = $link.attr("href");
          const text = $link.text().trim();

          if (href && text && href.includes("/diseases-conditions/")) {
            // Make sure it's a full URL
            const fullUrl = href.startsWith("http")
              ? href
              : `https://www.mayoclinic.org${href}`;

            // Filter out navigation elements and ensure it's an actual disease page
            if (
              (text.length > 1 &&
                !href.includes("?letter=") &&
                !text.toLowerCase().includes("view all") &&
                !text.toLowerCase().includes("see all") &&
                !text.toLowerCase().includes("more") &&
                href.includes("/symptoms-causes/")) ||
              href.includes("/diagnosis-treatment/") ||
              href.match(/syc-\d+$/)
            ) {
              diseases.push({
                disease: text,
                href: fullUrl,
              });
            }
          }
        });

        foundDiseases = true;
        break; // Use the first selector that finds results
      }
    }

    if (!foundDiseases) {
      console.log(
        `   ⚠️ No diseases found for letter ${letter} - trying alternative approach`
      );

      // Alternative approach: look for any links containing disease-related terms
      $("a").each((i, element) => {
        const $link = $(element);
        const href = $link.attr("href");
        const text = $link.text().trim();

        if (
          href &&
          text &&
          href.includes("/diseases-conditions/") &&
          text.length > 2
        ) {
          const fullUrl = href.startsWith("http")
            ? href
            : `https://www.mayoclinic.org${href}`;

          if (
            !href.includes("?letter=") &&
            !diseases.some((d) => d.href === fullUrl)
          ) {
            diseases.push({
              disease: text,
              href: fullUrl,
            });
          }
        }
      });
    }

    console.log(
      `   📊 Found ${diseases.length - 1} diseases for letter ${letter}`
    );
    return diseases;
  } catch (error) {
    console.error(`   ❌ Error scraping letter ${letter}:`, error.message);

    // Return at least the letter index link
    return [
      {
        disease: letter,
        href:
          letter === "#"
            ? `${BASE_URL}?letter=%23`
            : `${BASE_URL}?letter=${letter}`,
      },
    ];
  }
}

// Main function to scrape all letters
async function scrapeAllLetters() {
  console.log("🔥 MAYO CLINIC LETTERS SCRAPER STARTING...");
  console.log("🎯 Target: Recreate diseases_all_letters.csv with current data");

  const allDiseases = [];
  let totalDiseases = 0;

  try {
    // First, add the main index pages and language options
    const mainEntries = [
      {
        disease: "English",
        href: "https://www.mayoclinic.org/diseases-conditions/index",
      },
      {
        disease: "Español",
        href: "https://www.mayoclinic.org/es/diseases-conditions/index",
      },
      {
        disease: "العربية",
        href: "https://www.mayoclinic.org/ar/diseases-conditions/index",
      },
      {
        disease: "简体中文",
        href: "https://www.mayoclinic.org/zh-hans/diseases-conditions/index",
      },
    ];

    allDiseases.push(...mainEntries);

    // Process each letter
    for (let i = 0; i < LETTERS.length; i++) {
      const letter = LETTERS[i];

      console.log(`\n${"=".repeat(60)}`);
      console.log(`📋 Processing ${i + 1}/${LETTERS.length}: Letter ${letter}`);
      console.log(`📈 Progress: ${((i / LETTERS.length) * 100).toFixed(1)}%`);

      const diseases = await scrapeDiseasesByLetter(letter);
      allDiseases.push(...diseases);

      const newDiseases = diseases.length - 1; // Subtract 1 for the letter index link
      totalDiseases += newDiseases;

      console.log(
        `   ✅ Added ${diseases.length} entries (${newDiseases} diseases)`
      );
      console.log(`   📊 Total diseases so far: ${totalDiseases}`);

      // Add delay between requests to be respectful
      if (i < LETTERS.length - 1) {
        console.log("   ⏳ Waiting 2 seconds...");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    // Remove duplicates based on href
    const uniqueDiseases = [];
    const seenUrls = new Set();

    allDiseases.forEach((disease) => {
      if (!seenUrls.has(disease.href)) {
        seenUrls.add(disease.href);
        uniqueDiseases.push(disease);
      }
    });

    console.log(`\n📊 SCRAPING SUMMARY:`);
    console.log(`   📋 Total entries collected: ${allDiseases.length}`);
    console.log(`   🔗 Unique entries: ${uniqueDiseases.length}`);
    console.log(`   🏥 Estimated diseases: ${totalDiseases}`);
    console.log(
      `   🔄 Duplicates removed: ${allDiseases.length - uniqueDiseases.length}`
    );

    // Sort alphabetically by disease name, but keep main entries at top
    const mainEntriesFiltered = uniqueDiseases.filter((d) =>
      ["English", "Español", "العربية", "简体中文"].includes(d.disease)
    );

    const letterEntries = uniqueDiseases.filter((d) =>
      LETTERS.includes(d.disease)
    );

    const diseaseEntries = uniqueDiseases
      .filter(
        (d) =>
          !["English", "Español", "العربية", "简体中文"].includes(d.disease) &&
          !LETTERS.includes(d.disease)
      )
      .sort((a, b) =>
        a.disease.toLowerCase().localeCompare(b.disease.toLowerCase())
      );

    const sortedDiseases = [
      ...mainEntriesFiltered,
      ...letterEntries,
      ...diseaseEntries,
    ];

    // Write to CSV
    await csvWriter.writeRecords(sortedDiseases);

    console.log(`\n🎉 SCRAPING COMPLETED!`);
    console.log(`💾 Data saved to: ../CSV/diseases_all_letters_new.csv`);
    console.log(`📄 Total records: ${sortedDiseases.length}`);

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
  } catch (error) {
    console.error("💥 Fatal error:", error);
  }
}

// Execute the scraper
(function main() {
  scrapeAllLetters();
})();
