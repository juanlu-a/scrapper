const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

const csvWriter = createCsvWriter({
  path: `../CSV/drugs_information_full.csv`,
  header: [
    { id: "drug", title: "Drug" },
    { id: "what_is", title: "What Is" },
    { id: "side_effects", title: "Side Effects" },
    { id: "original_url", title: "Original URL" },
  ],
});

async function loadDrugsFromCsv() {
  try {
    const csvContent = fs.readFileSync("../CSV/drugs_all_letters.csv", "utf8");
    const lines = csvContent.split("\n").slice(1); // Skip header

    const drugs = [];

    for (const line of lines) {
      if (line.trim()) {
        // Split by comma and handle the 3-column format: Drug,URL,Letter
        const parts = line.split(",");
        if (parts.length >= 3) {
          const drug = parts[0].trim();
          const url = parts.slice(1, -1).join(",").trim();
          const letter = parts[parts.length - 1].trim();

          if (
            drug &&
            url &&
            drug.length > 1 &&
            url.startsWith("https://www.drugs.com") &&
            url.includes(".html")
          ) {
            drugs.push({ drug, url, letter });
          }
        }
      }
    }

    // Remove any remaining duplicates (just in case)
    const uniqueDrugs = drugs.filter(
      (drug, index, self) =>
        index ===
        self.findIndex((d) => d.drug.toLowerCase() === drug.drug.toLowerCase())
    );

    console.log(`📋 Loaded ${uniqueDrugs.length} drugs from CSV`);

    const letterBreakdown = {};
    uniqueDrugs.forEach((drug) => {
      letterBreakdown[drug.letter] = (letterBreakdown[drug.letter] || 0) + 1;
    });

    console.log("📊 Drugs by letter:");
    Object.entries(letterBreakdown)
      .sort(([a], [b]) => a.localeCompare(b))
      .forEach(([letter, count]) => {
        console.log(`   ${letter}: ${count} drugs`);
      });

    console.log("\n🔍 Sample drugs (first 5):");
    uniqueDrugs.slice(0, 5).forEach((item, index) => {
      console.log(
        `   ${index + 1}. ${item.drug} (${item.letter}) -> ${item.url}`
      );
    });

    return uniqueDrugs;
  } catch (error) {
    console.error("❌ Error reading CSV file:", error.message);
    return [];
  }
}

async function scrapeDrugInformation(drug, url) {
  console.log(`\n🔍 Scraping: ${drug}`);
  console.log(`   URL: ${url}`);

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

    let whatIs = "";
    let sideEffects = "";

    const whatIsSelectors = [
      'h2:contains("What is")',
      'h3:contains("What is")',
      'h1:contains("What is")',
      ".drug-summary",
      ".description",
      ".overview",
      ".drug-overview",
      "#overview",
      ".content-summary",
      "p:first-of-type",
    ];

    for (const selector of whatIsSelectors) {
      const element = $(selector);
      if (element.length) {
        if (selector.includes('contains("What is")')) {
          let content = element
            .nextUntil("h1, h2, h3, h4, h5, h6")
            .text()
            .trim();
          if (!content) {
            content = element.next("p, div").text().trim();
          }
          if (!content) {
            content = element.parent().nextAll("p, div").first().text().trim();
          }
          if (content && content.length > 30) {
            whatIs = content;
            break;
          }
        } else {
          const content = element.text().trim();
          if (content && content.length > 30) {
            whatIs = content;
            break;
          }
        }
      }
    }

    if (!whatIs) {
      $("p").each((i, el) => {
        const text = $(el).text().trim();
        if (
          text.length > 50 &&
          !text.toLowerCase().includes("this page was last") &&
          !text.toLowerCase().includes("advertisement") &&
          !text.toLowerCase().includes("cookie") &&
          !text.toLowerCase().includes("privacy")
        ) {
          whatIs = text;
          return false;
        }
      });
    }

    const sideEffectsSelectors = [
      'h2:contains("Side effects")',
      'h3:contains("Side effects")',
      'h2:contains("side effects")',
      'h3:contains("side effects")',
      'h2:contains("Adverse")',
      'h3:contains("Adverse")',
      'h2:contains("adverse")',
      'h3:contains("adverse")',
      ".side-effects",
      ".adverse-effects",
      "#side-effects",
      ".warnings",
    ];

    for (const selector of sideEffectsSelectors) {
      const element = $(selector);
      if (element.length) {
        let content = element.nextUntil("h1, h2, h3").text().trim();
        if (!content) {
          content = element.next("p, div, ul").text().trim();
        }
        if (!content) {
          content = element
            .parent()
            .nextAll("p, div, ul")
            .first()
            .text()
            .trim();
        }
        if (content && content.length > 15) {
          sideEffects = content;
          break;
        }
      }
    }

    whatIs = whatIs
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .replace(/\t+/g, " ")
      .trim()
      .substring(0, 2000);

    sideEffects = sideEffects
      .replace(/\s+/g, " ")
      .replace(/\n+/g, " ")
      .replace(/\t+/g, " ")
      .trim()
      .substring(0, 2000);

    console.log(
      `   ✅ What is: ${
        whatIs ? `Found (${whatIs.length} chars)` : "Not found"
      }`
    );
    console.log(
      `   ✅ Side effects: ${
        sideEffects ? `Found (${sideEffects.length} chars)` : "Not found"
      }`
    );

    return {
      drug,
      what_is: whatIs || "Information not found",
      side_effects: sideEffects || "Side effects not found",
      original_url: url,
    };
  } catch (error) {
    console.error(`   ❌ Error scraping ${drug}:`, error.message);
    return {
      drug,
      what_is: "ERROR - " + error.message,
      side_effects: "ERROR - " + error.message,
      original_url: url,
    };
  }
}

function saveJsonData(results) {
  const jsonData = {};

  results.forEach((result) => {
    if (result && result.drug) {
      jsonData[result.drug] = {
        drug: result.drug,
        what_is: result.what_is || "",
        side_effects: result.side_effects || "",
        original_url: result.original_url || "",
      };
    }
  });

  try {
    fs.writeFileSync(
      "../CSV/drugs-information.json",
      JSON.stringify(jsonData, null, 2)
    );
    console.log(
      `✅ JSON data saved to ../CSV/drugs-information.json (${
        Object.keys(jsonData).length
      } drugs)`
    );
  } catch (error) {
    console.error("❌ Error saving JSON data:", error.message);
  }
}

function saveProgressCheckpoint(results, currentIndex) {
  const checkpointData = {
    lastProcessedIndex: currentIndex,
    timestamp: new Date().toISOString(),
    totalResults: results.length,
    results: results,
  };

  fs.writeFileSync(
    "drug_info_checkpoint.json",
    JSON.stringify(checkpointData, null, 2)
  );
  console.log(`📝 Checkpoint saved at index ${currentIndex}`);
}

function loadProgressCheckpoint() {
  try {
    if (fs.existsSync("drug_info_checkpoint.json")) {
      const checkpoint = JSON.parse(
        fs.readFileSync("drug_info_checkpoint.json", "utf8")
      );
      console.log(`📋 Found checkpoint from ${checkpoint.timestamp}`);
      console.log(
        `   Previous progress: ${checkpoint.totalResults} drugs processed`
      );
      return checkpoint;
    }
  } catch (error) {
    console.log("⚠️ Could not load checkpoint, starting fresh");
  }
  return null;
}

(async function main() {
  console.log("🚀 DRUG INFORMATION SCRAPER STARTING...");
  console.log("🎯 Extracting 'What is' and 'Side Effects' for each drug");

  const checkpoint = loadProgressCheckpoint();
  let startIndex = 0;
  let existingResults = [];

  if (checkpoint) {
    console.log(
      `\n📋 Found previous checkpoint with ${checkpoint.totalResults} drugs processed`
    );
    console.log(`⏳ Do you want to resume from where you left off? (y/n)`);
    const answer = "y";
    if (answer.toLowerCase() === "y") {
      startIndex = checkpoint.lastProcessedIndex + 1;
      existingResults = checkpoint.results || [];
      console.log(`▶️ Resuming from drug ${startIndex + 1}`);
    } else {
      console.log(`🔄 Starting fresh...`);
    }
  }

  const drugs = await loadDrugsFromCsv();

  if (drugs.length === 0) {
    console.log("❌ No valid drugs found in CSV.");
    console.log(
      "💡 Make sure ../CSV/drugs_all_letters.csv exists and contains data"
    );
    return;
  }

  console.log(`\n📊 Processing Summary:`);
  console.log(`   📋 Total drugs in CSV: ${drugs.length}`);
  console.log(`   🎯 Starting from index: ${startIndex}`);
  console.log(`   📈 Remaining to process: ${drugs.length - startIndex}`);

  const results = [...existingResults];
  let successCount = existingResults.filter(
    (r) =>
      r.what_is !== "ERROR" &&
      !r.what_is.startsWith("ERROR -") &&
      r.what_is !== "Information not found"
  ).length;
  let errorCount = existingResults.filter(
    (r) => r.what_is === "ERROR" || r.what_is.startsWith("ERROR -")
  ).length;

  console.log(`\n🏃‍♂️ Starting processing...`);

  for (let i = startIndex; i < drugs.length; i++) {
    const { drug, url } = drugs[i];

    console.log(`\n${"=".repeat(60)}`);
    console.log(`📋 Processing ${i + 1}/${drugs.length}: ${drug}`);
    console.log(`📈 Progress: ${(((i + 1) / drugs.length) * 100).toFixed(1)}%`);
    console.log(
      `✅ Success so far: ${successCount} | ❌ Errors: ${errorCount}`
    );

    const result = await scrapeDrugInformation(drug, url);

    if (result) {
      results.push(result);
      if (
        result.what_is !== "ERROR" &&
        !result.what_is.startsWith("ERROR -") &&
        result.what_is !== "Information not found"
      ) {
        successCount++;
      } else {
        errorCount++;
      }
    }

    // Save checkpoint every 10 drugs
    if ((i + 1) % 10 === 0) {
      saveProgressCheckpoint(results, i);

      // Also save partial CSV and JSON
      await csvWriter.writeRecords(results);
      saveJsonData(results);
      console.log(
        `💾 Partial results saved (${results.length} drugs processed)`
      );
    }

    // DOS
    if (i < drugs.length - 1) {
      console.log("⏳ Waiting 2 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }
  }

  if (results.length > 0) {
    await csvWriter.writeRecords(results);
    saveJsonData(results);

    console.log(`\n🎉 DRUG INFORMATION SCRAPING COMPLETED!`);
    console.log(`\n📊 Final Results:`);
    console.log(`   ✅ Successfully scraped: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);
    console.log(`   📋 Total processed: ${results.length}`);
    console.log(
      `   📈 Success rate: ${((successCount / results.length) * 100).toFixed(
        1
      )}%`
    );
    console.log(`   💾 CSV saved to: ../CSV/drugs_information_full.csv`);
    console.log(`   💾 JSON saved to: ../CSV/drugs-information.json`);

    if (fs.existsSync("drug_info_checkpoint.json")) {
      fs.unlinkSync("drug_info_checkpoint.json");
      console.log(`🧹 Cleaned up checkpoint file`);
    }
  } else {
    console.log("❌ No drug information was scraped successfully.");
  }
})();
