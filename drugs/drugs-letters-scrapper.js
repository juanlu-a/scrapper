const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

const csvWriter = createCsvWriter({
  path: `../CSV/drugs_all_letters.csv`,
  header: [
    { id: "drug", title: "Drug" },
    { id: "href", title: "URL" },
    { id: "letter", title: "Letter" },
  ],
});

async function scrapeDrugsForLetter(letter) {
  const url = `https://www.drugs.com/alpha/${letter.toLowerCase()}.html`;
  console.log(`\n🔍 Scraping drugs for letter ${letter.toUpperCase()}: ${url}`);

  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
        "Accept-Encoding": "gzip, deflate, br",
        Connection: "keep-alive",
        "Upgrade-Insecure-Requests": "1",
      },
    });

    const $ = cheerio.load(data);
    const drugs = [];

    const drugSelectors = [
      ".ddc-list-column-2 a",
      ".ddc-list a",
      ".contentBox a",
      "ul.ddc-list-unstyled a",
      'div[class*="list"] a',
      'a[href*=".html"]',
    ];

    let foundValidDrugs = false;

    for (const selector of drugSelectors) {
      const drugLinks = $(selector);

      if (drugLinks.length > 0) {
        console.log(
          `   Testing selector "${selector}" - found ${drugLinks.length} links`
        );

        const tempDrugs = [];
        drugLinks.each((i, element) => {
          const $link = $(element);
          const drugName = $link.text().trim();
          let href = $link.attr("href");

          // Clean and validate drug entries
          if (
            drugName &&
            href &&
            drugName.length > 1 &&
            // Exclude navigation and footer links
            !drugName.toLowerCase().includes("home") &&
            !drugName.toLowerCase().includes("about") &&
            !drugName.toLowerCase().includes("contact") &&
            !drugName.toLowerCase().includes("privacy") &&
            !drugName.toLowerCase().includes("terms") &&
            !drugName.toLowerCase().includes("sitemap") &&
            !drugName.toLowerCase().includes("subscribe") &&
            !drugName.toLowerCase().includes("newsletter") &&
            !drugName.toLowerCase().includes("follow") &&
            !drugName.toLowerCase().includes("facebook") &&
            !drugName.toLowerCase().includes("twitter") &&
            !drugName.toLowerCase().includes("instagram") &&
            !drugName.toLowerCase().includes("download") &&
            !drugName.toLowerCase().includes("app store") &&
            !drugName.toLowerCase().includes("google play") &&
            !drugName.toLowerCase().includes("next") &&
            !drugName.toLowerCase().includes("previous") &&
            !drugName.toLowerCase().includes("page") &&
            !drugName.includes("»") &&
            !drugName.includes("«") &&
            !drugName.includes("...") &&
            href.includes(".html") &&
            (href.includes("/drug/") ||
              href.includes("/mtm/") ||
              href.includes("/pro/") ||
              href.includes("/cons/") ||
              href.includes("/monograph/") ||
              href.includes("/npc/") ||
              href.includes("/npp/") ||
              // Also include direct drug pages (drugs.com/drugname.html)
              href.match(/drugs\.com\/[a-z0-9-]+\.html$/))
          ) {
            if (href.startsWith("/")) {
              href = "https://www.drugs.com" + href;
            }

            tempDrugs.push({
              drug: drugName,
              href: href,
              letter: letter.toUpperCase(),
            });
          }
        });

        // If we found a good number of drugs with this selector, use it
        if (tempDrugs.length > 5) {
          drugs.push(...tempDrugs);
          foundValidDrugs = true;
          console.log(
            `   ✅ Using selector "${selector}" - found ${tempDrugs.length} valid drugs`
          );
          break;
        }
      }
    }

    if (!foundValidDrugs || drugs.length === 0) {
      console.log(
        `   ⚠️ No valid drugs found for letter ${letter.toUpperCase()}`
      );
      console.log(`   🔍 Debugging - showing first 10 links on page:`);

      $("a").each((i, el) => {
        if (i < 10) {
          const text = $(el).text().trim();
          const href = $(el).attr("href");
          if (text && href) {
            console.log(`     "${text}" -> ${href}`);
          }
        }
      });
      return [];
    }

    const uniqueDrugs = drugs.filter(
      (drug, index, self) =>
        index ===
        self.findIndex(
          (d) =>
            d.drug.toLowerCase() === drug.drug.toLowerCase() &&
            d.href === drug.href
        )
    );

    console.log(
      `   ✅ Found ${
        uniqueDrugs.length
      } unique drugs for letter ${letter.toUpperCase()}`
    );

    // Show first few drugs as sample
    if (uniqueDrugs.length > 0) {
      console.log(`   📋 Sample drugs:`);
      uniqueDrugs.slice(0, 3).forEach((drug) => {
        console.log(`     - ${drug.drug}`);
      });
    }

    return uniqueDrugs;
  } catch (error) {
    console.error(`   ❌ Error scraping letter ${letter}:`, error.message);
    return [];
  }
}

async function scrapeAllDrugs() {
  const allDrugs = [];
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

  console.log("🚀 Starting drugs.com scraper...");
  console.log(`📋 Will scrape ${letters.length} letters`);

  let totalFound = 0;
  let totalErrors = 0;

  for (let i = 0; i < letters.length; i++) {
    const letter = letters[i];
    console.log(`\n${"=".repeat(50)}`);
    console.log(`📍 Processing letter ${i + 1}/${letters.length}: ${letter}`);
    console.log(
      `📊 Progress: ${(((i + 1) / letters.length) * 100).toFixed(1)}%`
    );

    const drugsForLetter = await scrapeDrugsForLetter(letter);

    if (drugsForLetter.length > 0) {
      allDrugs.push(...drugsForLetter);
      totalFound += drugsForLetter.length;
      console.log(
        `   ✅ Added ${drugsForLetter.length} drugs (Total: ${totalFound})`
      );
    } else {
      totalErrors++;
      console.log(`   ❌ No drugs found for letter ${letter}`);
    }

    // DOS
    if (i < letters.length - 1) {
      console.log(`⏳ Waiting 3 seconds before next letter...`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }
  }

  console.log(`\n${"=".repeat(50)}`);
  console.log(`📊 Final Statistics:`);
  console.log(
    `   ✅ Successfully processed: ${letters.length - totalErrors}/${
      letters.length
    } letters`
  );
  console.log(`   ❌ Failed letters: ${totalErrors}`);
  console.log(`   📋 Total drugs found: ${totalFound}`);

  return allDrugs.sort((a, b) => {
    if (a.letter !== b.letter) {
      return a.letter.localeCompare(b.letter);
    }
    return a.drug.toLowerCase().localeCompare(b.drug.toLowerCase());
  });
}

(async function main() {
  console.log("🔥 DRUGS.COM SCRAPER STARTING...");
  console.log("🎯 Target: Extract all drug names and URLs by letter");

  try {
    if (fs.existsSync("../CSV/drugs_all_letters.csv")) {
      fs.unlinkSync("../CSV/drugs_all_letters.csv");
      console.log("🧹 Cleared existing CSV file");
    }

    const allDrugs = await scrapeAllDrugs();

    if (allDrugs.length > 0) {
      const sortedDrugs = allDrugs.sort((a, b) => {
        if (a.letter !== b.letter) {
          return a.letter.localeCompare(b.letter);
        }
        return a.drug.toLowerCase().localeCompare(b.drug.toLowerCase());
      });

      await csvWriter.writeRecords(sortedDrugs);

      console.log(`\n🎉 SCRAPING COMPLETED SUCCESSFULLY!`);
      console.log(`📊 Final Results:`);
      console.log(`   📋 Total drugs found: ${sortedDrugs.length}`);
      console.log(
        `   💾 Data saved to: ../CSV/drugs_all_letters.csv (alphabetically sorted)`
      );

      const letterBreakdown = {};
      sortedDrugs.forEach((drug) => {
        letterBreakdown[drug.letter] = (letterBreakdown[drug.letter] || 0) + 1;
      });

      console.log(`\n📈 Final breakdown by letter:`);
      Object.entries(letterBreakdown)
        .sort(([a], [b]) => a.localeCompare(b))
        .forEach(([letter, count]) => {
          console.log(`   ${letter}: ${count} drugs`);
        });

      console.log(`\n📋 Sample drugs from each letter:`);
      const seenLetters = new Set();
      sortedDrugs.forEach((drug) => {
        if (!seenLetters.has(drug.letter) && seenLetters.size < 5) {
          console.log(`   ${drug.letter}: ${drug.drug}`);
          seenLetters.add(drug.letter);
        }
      });

      if (fs.existsSync("drugs_scraping_checkpoint.json")) {
        fs.unlinkSync("drugs_scraping_checkpoint.json");
        console.log(`🧹 Cleaned up checkpoint file`);
      }
    } else {
      console.log("❌ No drugs were scraped successfully.");
      console.log("💡 Suggestions:");
      console.log("   - Check internet connection");
      console.log("   - Verify drugs.com website structure hasn't changed");
      console.log("   - Run with fewer letters for testing");
    }
  } catch (error) {
    console.error("💥 Fatal error:", error);
  }
})();
