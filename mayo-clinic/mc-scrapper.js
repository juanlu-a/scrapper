const axios = require("axios");
const cheerio = require("cheerio");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const fs = require("fs");

// Load environment variables
require('dotenv').config({ path: '../.env' });

// LLM Configuration
const { GoogleGenerativeAI } = require("@google/generative-ai");
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

const csvWriter = createCsvWriter({
  path: `../CSV/final_diseases_complete.csv`,
  header: [
    { id: "disease_name_english", title: "Disease_Name_English" },
    { id: "disease_name_spanish", title: "Disease_Name_Spanish" },
    { id: "diagnosis", title: "Diagnosis" },
    { id: "treatments", title: "Treatments" },
    { id: "tests", title: "Tests" },
    { id: "medications_drugs", title: "Medications_Drugs" },
  ],
});

// Spanish translations for disease names (we'll add more as needed)
const diseaseTranslations = {
  "Abdominal aortic aneurysm": "aneurisma aórtico abdominal",
  "Absence seizure": "crisis de ausencia", 
  "Acanthosis nigricans": "acantosis nigricans",
  "Achalasia": "acalasia",
  "Achilles tendinitis": "tendinitis de aquiles",
  "Achilles tendon rupture": "ruptura del tendón de aquiles",
  "ACL injury": "lesión del ligamento cruzado anterior",
  "Acne": "acné",
  "Acoustic neuroma": "neuroma acústico",
  "Acromegaly": "Acromegalia",
  "Actinic keratosis": "Queratosis actínica",
  "Acute coronary syndrome": "síndrome coronario agudo",
  "Acute flaccid myelitis (AFM)": "Mielitis flácida aguda (AFM)",
  "Acute kidney injury": "lesión renal aguda",
  "Acute liver failure": "insuficiencia hepática aguda",
  "Acute lymphocytic leukemia": "leucemia linfocítica aguda",
  "Acute myelogenous leukemia": "leucemia mielógena aguda",
  "Acute sinusitis": "Sinusitis aguda",
  "Addison's disease": "enfermedad de addison",
  "Heart disease": "enfermedad cardíaca",
  "Chronic kidney disease": "enfermedad renal crónica",
  "COPD": "EPOC",
  "Pneumonia": "neumonía",
  "Stroke": "accidente cerebrovascular",
  "Dementia": "demencia",
  "Depression (major depressive disorder)": "depresión (trastorno depresivo mayor)",
  "High cholesterol": "colesterol alto",
  "Obesity": "obesidad",
  "Arthritis": "artritis"
};

// Function to extract comprehensive diagnosis content
// LLM-powered extraction function
async function scrapeDisease(disease, symptomsUrl, diagnosisUrl) {
  console.log(`\n🔍 Scraping: ${disease}`);
  console.log(`   📍 Diagnosis URL: ${diagnosisUrl}`);

  if (!diagnosisUrl || diagnosisUrl === "NOT_FOUND") {
    console.log(`   ⚠️ No diagnosis URL available`);
    return {
      disease_name_english: disease,
      disease_name_spanish: diseaseTranslations[disease] || disease,
      diagnosis: "NO_DIAGNOSIS_URL",
      tests: "NO_DIAGNOSIS_URL", 
      treatments: "NO_DIAGNOSIS_URL",
      medications_drugs: "NO_DIAGNOSIS_URL",
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

    // Extract all content using LLM
    const pageContent = mainContent.text();
    const extractedInfo = await extractMedicalInfoWithLLM(pageContent, disease);

    return {
      disease_name_english: disease,
      disease_name_spanish: diseaseTranslations[disease] || disease,
      diagnosis: extractedInfo.diagnosis,
      tests: extractedInfo.tests,
      treatments: extractedInfo.treatments,
      medications_drugs: extractedInfo.medications,
    };

    // All extraction is now handled by LLM - no manual parsing needed
  } catch (error) {
    console.error(`   ❌ Error scraping ${disease}: ${error.message}`);
    return {
      disease_name_english: disease,
      disease_name_spanish: diseaseTranslations[disease] || disease,
      diagnosis: "ERROR - " + error.message,
      tests: "ERROR - " + error.message,
      treatments: "ERROR - " + error.message,
      medications_drugs: "ERROR - " + error.message,
    };
  }
}

// LLM-powered extraction function
async function extractMedicalInfoWithLLM(pageContent, diseaseName) {
  console.log(`   🤖 Using LLM to extract medical information...`);
  
  try {
    // Clean and limit content to avoid token limits
    const cleanContent = pageContent.replace(/\s+/g, ' ').substring(0, 8000);
    
    const prompt = `
You are a medical information extraction expert. Extract structured information from this Mayo Clinic page about "${diseaseName}".

PAGE CONTENT:
${cleanContent}

Please extract the following information in this EXACT format:

DIAGNOSIS: [A concise summary of how this condition is diagnosed, including key diagnostic criteria and methods]
TESTS: [List diagnostic tests separated by semicolons, e.g., "Blood test; MRI scan; Biopsy"]
TREATMENTS: [List treatment options separated by semicolons, e.g., "Medication; Surgery; Physical therapy"]
MEDICATIONS: [List specific medications mentioned separated by semicolons, e.g., "Aspirin; Metformin; Lisinopril"]

Guidelines:
- Be concise but comprehensive
- Use semicolons to separate multiple items
- If no information is found for a section, write "Information not found"
- Focus on factual medical information only
- Avoid repeating the same information in multiple sections
- For DIAGNOSIS: focus on diagnostic methods and criteria
- For TESTS: include specific diagnostic tests, procedures, and examinations
- For TREATMENTS: include therapies, procedures, and interventions
- For MEDICATIONS: include specific drug names, not general categories
`;

    const result = await model.generateContent(prompt);
    const response = result.response.text();
    
    // Parse the LLM response
    const extractedInfo = {
      diagnosis: "",
      tests: "",
      treatments: "",
      medications: ""
    };
    
    const lines = response.split('\n');
    let currentSection = null;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      if (trimmedLine.startsWith('DIAGNOSIS:')) {
        extractedInfo.diagnosis = trimmedLine.replace('DIAGNOSIS:', '').trim();
        currentSection = 'diagnosis';
      } else if (trimmedLine.startsWith('TESTS:')) {
        extractedInfo.tests = trimmedLine.replace('TESTS:', '').trim();
        currentSection = 'tests';
      } else if (trimmedLine.startsWith('TREATMENTS:')) {
        extractedInfo.treatments = trimmedLine.replace('TREATMENTS:', '').trim();
        currentSection = 'treatments';
      } else if (trimmedLine.startsWith('MEDICATIONS:')) {
        extractedInfo.medications = trimmedLine.replace('MEDICATIONS:', '').trim();
        currentSection = 'medications';
      } else if (currentSection && trimmedLine && !trimmedLine.startsWith('PAGE CONTENT:')) {
        // Continue previous section if line doesn't start with a section header
        extractedInfo[currentSection] += ' ' + trimmedLine;
      }
    }
    
    // Clean up the extracted information
    Object.keys(extractedInfo).forEach(key => {
      extractedInfo[key] = extractedInfo[key].trim();
      if (!extractedInfo[key] || extractedInfo[key].toLowerCase().includes('not found')) {
        extractedInfo[key] = "Information not found";
      }
    });
    
    console.log(`   ✅ LLM extraction completed`);
    console.log(`   📊 LLM Results: Diagnosis(${extractedInfo.diagnosis.length}chars) Tests(${extractedInfo.tests.split(';').length}) Treatments(${extractedInfo.treatments.split(';').length}) Meds(${extractedInfo.medications.split(';').length})`);
    
    return extractedInfo;
    
  } catch (error) {
    console.error(`   ❌ LLM extraction failed: ${error.message}`);
    return {
      diagnosis: "LLM extraction failed",
      tests: "LLM extraction failed",
      treatments: "LLM extraction failed",
      medications: "LLM extraction failed"
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
    console.log(`💾 Data saved to: ../CSV/final_diseases_complete.csv`);

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
