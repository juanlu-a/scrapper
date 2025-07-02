# Main Diseases Analysis - Node.js Implementation

This is a Node.js implementation of the Python disease analysis system. It provides the same functionality for extracting and analyzing data for main diseases from the medical database and generating comprehensive Excel reports.

## 🚀 Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run complete analysis
npm run full-analysis

# Or run individual scripts
npm run analyze-main-diseases    # Generate Excel file
npm run verify-medications       # Verify medication completeness
npm run summary                  # Display analysis summary
```

## 📁 Node.js Files

### Main Scripts

- `main-diseases-analyzer-final.js` - Main analysis script (equivalent to Python version)
- `verify-all-medications.js` - Medication verification script
- `final-analysis-summary.js` - Summary display script

### Features

- **ExcelJS Integration**: Professional Excel file generation
- **CSV Parsing**: Efficient data loading with csv-parser
- **Asynchronous Processing**: Promise-based architecture
- **Error Handling**: Comprehensive error management
- **Modular Design**: Reusable class-based structure

## 🔧 Dependencies

The Node.js implementation uses:

- **exceljs**: Excel file creation and manipulation
- **csv-parser**: CSV file parsing
- **fs**: File system operations
- **path**: File path utilities

## 📊 Output

Generates the same output as the Python version:

- `Analysis/main_diseases_analysis_final.xlsx` - Complete Excel analysis
- 11 sheets total (1 summary + 10 disease sheets)
- 327+ medications with detailed information

## 🎯 Target Diseases

1. Heart Disease
2. Chronic Kidney Disease
3. COPD
4. Pneumonia
5. Stroke
6. Dementia
7. Depression (major depressive disorder)
8. High Cholesterol
9. Obesity
10. Arthritis

## 💊 Medication Data

Each disease sheet includes:

- Complete medication list
- Detailed descriptions ("What is")
- Comprehensive side effects
- Disease tags and associations
- Professional formatting

## 🔍 Verification

The verification script ensures:

- All medications from database are included
- Proper data mapping between sources
- Complete Excel file structure
- Accurate medication counts

## 📱 Usage Examples

### Generate Analysis

```bash
node main-diseases-analyzer-final.js
```

### Verify Results

```bash
node verify-all-medications.js
```

### View Summary

```bash
node final-analysis-summary.js
```

### Run Complete Workflow

```bash
npm run full-analysis
```

## 🔄 Comparison with Python Version

| Feature          | Python          | Node.js       |
| ---------------- | --------------- | ------------- |
| Excel Generation | ✅ openpyxl     | ✅ exceljs    |
| CSV Parsing      | ✅ pandas       | ✅ csv-parser |
| Data Processing  | ✅ numpy/pandas | ✅ native JS  |
| Async Support    | ✅              | ✅ promises   |
| Styling          | ✅              | ✅            |
| Performance      | Fast            | Fast          |

## 🛠️ Development

### Class Structure

```javascript
// Main analyzer
const analyzer = new MainDiseasesAnalyzer();
await analyzer.loadData();
await analyzer.createAnalysis();

// Verification
const verifier = new MedicationVerifier();
await verifier.runVerification();

// Summary
const summary = new FinalAnalysisSummary();
await summary.displaySummary();
```

### Error Handling

All scripts include comprehensive error handling:

- File existence checks
- Data validation
- Graceful failure handling
- Informative error messages

## 📈 Performance

- Asynchronous data loading
- Efficient memory usage
- Fast Excel generation
- Optimized text processing

## 🎨 Output Quality

The Node.js version produces identical output to Python:

- Professional Excel formatting
- Consistent styling and colors
- Proper text wrapping and sizing
- Complete data integration

## 🔗 Integration

Can be integrated into:

- Web applications
- API endpoints
- Automated workflows
- CI/CD pipelines

Perfect for teams that prefer JavaScript/Node.js over Python!
