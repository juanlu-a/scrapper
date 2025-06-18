const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

function convertToDiagnosisTreatmentUrl(symptomsUrl) {
  if (!symptomsUrl.includes("/symptoms-causes/")) {
    return symptomsUrl; // Return unchanged if not a symptoms URL
  }

  return symptomsUrl
    .replace("/symptoms-causes/", "/diagnosis-treatment/")
    .replace("/syc-", "/drc-");
}

async function updateCsvUrls() {
  try {
    console.log("📋 Reading original CSV file...");
    const csvContent = fs.readFileSync(
      "./CSV/diseases_all_letters.csv",
      "utf8"
    );
    const lines = csvContent.split("\n");

    const updatedRows = [];

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      if (i === 0) {
        // Keep header as is
        updatedRows.push({ disease: "Disease", href: "Href" });
        continue;
      }

      // Parse the line
      const parts = line.split(",");
      if (parts.length >= 2) {
        const disease = parts[0].trim();
        const href = parts.slice(1).join(",").trim();

        // Only process actual disease pages with symptoms-causes URLs
        if (
          disease &&
          href &&
          href.includes("/symptoms-causes/") &&
          href.includes("/syc-")
        ) {
          const newHref = convertToDiagnosisTreatmentUrl(href);
          updatedRows.push({ disease, href: newHref });
          console.log(`✅ Updated: ${disease}`);
        } else if (disease && href && !href.includes("?letter=")) {
          // Keep other disease URLs unchanged
          updatedRows.push({ disease, href });
        }
      }
    }

    console.log(`📊 Found ${updatedRows.length - 1} disease entries to update`);

    // Write updated CSV
    const csvWriter = createCsvWriter({
      path: "./CSV/diseases_diagnosis_treatment.csv",
      header: [
        { id: "disease", title: "Disease" },
        { id: "href", title: "Href" },
      ],
    });

    await csvWriter.writeRecords(updatedRows);
    console.log("✅ Created new CSV file: diseases_diagnosis_treatment.csv");
    console.log(
      "🔗 URLs have been converted from /symptoms-causes/ to /diagnosis-treatment/"
    );

    return updatedRows.length - 1; // Subtract 1 for header
  } catch (error) {
    console.error("❌ Error updating CSV:", error.message);
    return 0;
  }
}

// Run the update
(async function main() {
  console.log("🚀 Starting CSV URL update...");
  const count = await updateCsvUrls();
  console.log(`🎉 Successfully updated ${count} disease URLs!`);
})();
