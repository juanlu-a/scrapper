**_ SCRAPPER MAYO CLINIC AND DRUGS _**

## 🔐 Setup & Configuration

### Environment Variables

Before running the LLM-powered scripts, set up your environment variables:

1. Copy `.env.example` to `.env`:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your Google Gemini API key:

   ```bash
   GOOGLE_GEMINI_API_KEY=your_actual_api_key_here
   ```

3. Get your API key from: [Google AI Studio](https://aistudio.google.com/app/apikey)

**⚠️ Security Note**: Never commit your `.env` file to version control. The `.gitignore` file is configured to protect it.

## 🏥 Mayo Clinic Data Collection

**Mayo Clinic**

1. Run `mc-letters-scrapper.js`, this retrieve the hrefs of each disease.
2. Run `mc-url-converter.js`, that gets the diagnosis & treatment href from the disease.
3. Run `mc-scrapper.js`, which gets the wanted data.

## 🤖 LLM-Powered Medication Analysis

**Python LLM Scripts** (in `py-code-for-main-diseases/`):

1. **`main_diseases_analyzer_final.py`** - Generates Excel structure from disease data
2. **`production_scraper_LLM.py`** - AI-powered medication data extraction with:
   - Google Gemini AI processing
   - Structured categorization into 4 columns:
     - **WHAT IS** (medication description)
     - **SIDE EFFECTS**
     - **CALL A DOCTOR IF**
     - **GO TO ER IF**
   - Automatic error recovery and retry logic
   - Progress tracking and resume capability

**Required packages:**

```bash
pip install python-dotenv selenium google-generativeai openpyxl pandas
```

Note: Json for checkpoints are created, can be deleted.
