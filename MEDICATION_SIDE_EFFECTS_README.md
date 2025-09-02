# Medication Side Effects Scraper

This script scrapes side effects information for medications from [MedlinePlus](https://medlineplus.gov/druginformation.html) and adds a "Side Effects" column to your existing medication data Excel file.

## Features

- 🔍 **Intelligent Search**: Searches MedlinePlus for each medication using both brand and generic names
- 🤖 **AI-Powered Extraction**: Uses Google's Gemini LLM to extract and summarize side effects information
- 💾 **Smart Caching**: Caches results to avoid re-processing medications
- 📊 **Progress Tracking**: Shows progress with visual indicators and saves incremental backups
- 🔄 **Resume Capability**: Can resume from where it left off if interrupted
- 📁 **Excel Integration**: Preserves original Excel structure while adding the new column

## Prerequisites

1. **Python 3.8+**
2. **Google Chrome browser**
3. **Google Gemini API key** (Get one from [Google AI Studio](https://makersuite.google.com/app/apikey))

## Setup

### 1. Install Python Dependencies

```bash

# Or install individually:
pip install pandas selenium beautifulsoup4 openpyxl tqdm colorama google-generativeai python-dotenv
```

### 2. Install Chrome Driver

**macOS:**

```bash
brew install chromedriver
```

**Other platforms:**

- Download from [ChromeDriver](https://chromedriver.chromium.org/)
- Make sure it's in your PATH

### 3. Configure Environment

Create a `.env` file in the project root:

```bash
GOOGLE_GEMINI_API_KEY=your_api_key_here
```

### 4. Test Setup

Run the test script to verify everything is working:

```bash
python test_setup.py
```

## Usage

### Basic Usage

```bash
python py-code-for-main-diseases/medication_scraper_side_effects.py
```

### Configuration

Edit the `main()` function in the script to customize:

```python
# Configuration options
excel_file_path = "/path/to/your/medication_data.xlsx"  # Input Excel file
output_file_path = None  # Auto-generated or specify custom path
headless = False  # Set to True for headless browser mode
```

## How It Works

1. **Load Medication Data**: Reads the Excel file and extracts medication names
2. **Search MedlinePlus**: For each medication, searches the MedlinePlus drug database
3. **Extract Information**: Uses AI to extract side effects from the webpage content
4. **Cache Results**: Stores results to avoid re-processing
5. **Update Excel**: Adds the "Side Effects" column to your data
6. **Save Results**: Creates a new Excel file with the side effects information

## Output

The script creates:

- **Main output file**: `medication_data_with_side_effects_YYYYMMDD_HHMMSS.xlsx`
- **Progress backups**: `medication_side_effects_progress_YYYYMMDD_HHMMSS.xlsx`
- **Cache file**: `side_effects_cache.json` (for resuming interrupted runs)

## Side Effects Format

The AI extracts side effects in this format:

```
COMMON SIDE EFFECTS: [most frequent side effects]
SERIOUS SIDE EFFECTS: [severe side effects if mentioned]
RARE SIDE EFFECTS: [uncommon side effects if mentioned]
```

## Troubleshooting

### Common Issues

1. **Chrome driver not found**

   ```bash
   # Install chromedriver
   brew install chromedriver  # macOS
   ```

2. **API key errors**

   - Verify your `.env` file exists and contains the correct API key
   - Check that your Google Gemini API key is valid

3. **Selenium errors**

   - Make sure Chrome browser is installed and up to date
   - Try running with `headless=False` to see what's happening

4. **Excel file errors**
   - Verify the file path is correct
   - Make sure the Excel file is not open in another application

### Performance Tips

- **Headless mode**: Set `headless=True` for faster processing
- **Batch processing**: The script processes in batches and saves progress regularly
- **Resume capability**: If interrupted, restart the script to resume from cache

## Error Handling

The script includes robust error handling:

- Network timeouts are handled gracefully
- Failed medications are marked with error messages
- Progress is saved regularly to prevent data loss
- Cache prevents re-processing completed medications

## Files Structure

```
scrapper/
├── py-code-for-main-diseases/
│   └── medication_scraper_side_effects.py  # Main scraper script
├── Analysis/
│   └── medication_data_20250820_141750.xlsx  # Input data
├── requirements.txt                         # Python dependencies
├── test_setup.py                           # Setup test script
├── .env                                    # Environment variables
└── side_effects_cache.json                # Cache file (auto-generated)
```

## Safety Features

- **Rate limiting**: Random delays between requests to avoid overwhelming servers
- **Caching**: Prevents redundant API calls and web scraping
- **Progress saving**: Regular backups prevent data loss
- **Error isolation**: One failed medication doesn't stop the entire process

## Support

If you encounter issues:

1. Run `python test_setup.py` to verify your setup
2. Check the console output for specific error messages
3. Verify all prerequisites are installed correctly
4. Make sure your Google Gemini API key is valid and has quota remaining
