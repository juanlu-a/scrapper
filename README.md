# Medical Data Scraper & Analyzer

A comprehensive medical data scraping and analysis tool that extracts disease and medication information from various sources and generates structured Excel reports.

## 🎯 Complete Data Pipeline

### Step 0: Generate Source Data (Periodic)

```bash
# Mayo Clinic Disease Data Collection
node mayo-clinic/mc-letters-scrapper.js    # Extract disease URLs
node mayo-clinic/mc-url-converter.js       # Get diagnosis URLs
node mayo-clinic/mc-scrapper.js            # Scrape disease data
node mayo-clinic/mc-analyze-data.js        # Generate analysis (optional)
```

**Purpose**: Creates `CSV/final_diseases_complete.csv` with comprehensive disease data.

**Output**: Source CSV file with 1000+ diseases ready for Python processing.

### Step 1: Generate Excel Structure

```bash
cd py-code-for-main-diseases
python main_diseases_analyzer_final.py
```

**Purpose**: Creates the Excel file with 10 main diseases and 327 unique medications structure.

**Output**: `Analysis/main_diseases_analysis_final.xlsx` with complete structure and Disease Tag column populated.

### Step 2: Populate Medication Data

```bash
cd py-code-for-main-diseases
python production_scraper_LLM.py
```

**Purpose**: Scrapes drugs.com using Gemini AI to populate medication details (What Is, Side Effects, etc.).

**Built-in Monitoring**: Real-time progress tracking, error reporting, and auto-recovery included.

## 📊 Final Output Structure

The system generates a comprehensive Excel file with:

### Disease Sheets (10 sheets)

- Heart disease
- Chronic kidney disease
- COPD
- Pneumonia
- Stroke
- Dementia
- Depression (major depressive disorder)
- High cholesterol
- Obesity
- Arthritis

**Structure**: Each disease sheet contains diagnosis, treatments, tests, and a simple list of related medications (names only). Detailed medication information is consolidated in the "All Unique Medications" sheet.

### All Unique Medications Sheet

**6-Column Structure:**
| Column | Content | Source |
|--------|---------|---------|
| A | **MEDICATION NAME** | Disease data extraction |
| B | **WHAT IS** | Scraped from drugs.com + Gemini AI |
| C | **SIDE EFFECTS** | Scraped from drugs.com + Gemini AI |
| D | **CALL A DOCTOR IF** | Scraped from drugs.com + Gemini AI |
| E | **GO TO ER IF** | Scraped from drugs.com + Gemini AI |
| F | **DISEASE TAG** | Auto-populated during Excel generation |

## 🏗️ System Architecture

### Core Files (Production)

```
py-code-for-main-diseases/
├── main_diseases_analyzer_final.py    # Excel structure generator
└── production_scraper_LLM.py          # Gemini AI-powered scraper with built-in monitoring
```

### Data Dependencies

```
CSV/
└── final_diseases_complete.csv        # Source disease data

Analysis/
└── main_diseases_analysis_final.xlsx  # Generated output
```

## 🔧 Technology Stack

- **Python 3.9+** with virtual environment
- **OpenPyxl**: Excel file manipulation
- **Selenium WebDriver**: Web scraping automation
- **Google Gemini AI**: LLM for content processing and categorization
- **Pandas**: Data processing and analysis

## 📋 Required Packages

```bash
pip install openpyxl selenium google-generativeai pandas
```

## 🚀 Quick Start

1. **Setup Environment**:

   ```bash
   cd /Users/juanlu/Documents/Wye/scrapper
   # Ensure virtual environment is activated
   ```

1. **Generate Disease Data** (if needed):

   ```bash
   # Run Mayo Clinic scraper sequence
   node mayo-clinic/mc-letters-scrapper.js
   node mayo-clinic/mc-url-converter.js
   node mayo-clinic/mc-scrapper.js
   ```

1. **Generate Excel Structure**:

   ```bash
   python py-code-for-main-diseases/main_diseases_analyzer_final.py
   ```

1. **Run Full Scraper**:
   ```bash
   python py-code-for-main-diseases/production_scraper_LLM.py
   ```
   (Includes built-in progress monitoring and error reporting)

## 📈 Performance Stats

- **Total Medications**: 327 unique medications
- **Processing Speed**: ~6 seconds per medication
- **Success Rate**: 95%+ with error handling
- **Estimated Runtime**: ~33 minutes for full scraping
- **API**: Google Gemini 1.5 Flash for optimal speed/cost

## 🔍 Key Features

### Disease-Medication Mapping

- Automatic association of medications with diseases
- Multi-disease medication tracking
- Disease Tag column for easy filtering

### LLM-Powered Content Processing

- Intelligent categorization of side effects
- Extraction of "What Is" descriptions
- Structured output with consistent formatting

### Robust Scraping

- Anti-detection measures for drugs.com
- Retry mechanisms and error handling
- Progress tracking and recovery capabilities

## 🏥 Mayo Clinic Data Collection

The Mayo Clinic scraper collects the initial disease data that feeds into the main analysis:

### Mayo Clinic Workflow (Proven & Reliable)

1. **Extract Disease URLs**:

   ```bash
   node mayo-clinic/mc-letters-scrapper.js
   ```

   Retrieves disease URLs from all Mayo Clinic letter pages (A-Z).

2. **Get Diagnosis & Treatment URLs**:

   ```bash
   node mayo-clinic/mc-url-converter.js
   ```

   Converts symptoms URLs to proper diagnosis & treatment URLs.

3. **Scrape Disease Data**:

   ```bash
   node mayo-clinic/mc-scrapper.js
   ```

   Collects comprehensive disease data (diagnosis, treatments, tests, medications).

4. **Analyze Data** (Optional):
   ```bash
   node mayo-clinic/mc-analyze-data.js
   ```
   Generates statistics and saves data to Excel format in `Analysis/` directory.

**Output**: Creates `CSV/final_diseases_complete.csv` - Ready for Python analysis

**Features:**

- ✅ **Proven reliability**: Extracts 1000+ diseases successfully
- ✅ **Comprehensive data**: Diagnosis, treatments, tests, medications
- ✅ **Robust scraping**: Handles Mayo Clinic's complex URL structure
- ✅ **Error recovery**: Continues processing despite individual failures

## 📁 Legacy Files (Deprecated)

The following directories contain older scraping scripts that are no longer needed:

- `drugs/` - Basic drugs.com scraper (superseded by LLM version)

## 🛠️ Manual Fallback

For any medications that fail automated scraping, use:
`Analysis/drugs_com_manual_guide.txt` - Contains direct URLs for manual data collection.

## 📄 Notes

- The system uses Google Gemini API for intelligent content processing
- All output is structured for easy analysis and reporting
- Disease associations are automatically tracked and populated
- The scraper includes comprehensive error handling and retry logic
