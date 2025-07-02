# Main Diseases Analysis

This project extracts and analyzes data for 8 main diseases from the medical database and generates a comprehensive Excel report.

## Final Output

- **File**: `Analysis/main_diseases_analysis_final.xlsx`
- **Structure**: One sheet per disease with diagnosis, treatments, tests, and complete medication information

## Main Diseases Analyzed

1. Heart Disease
2. Cancer 
3. Stroke
4. Diabetes
5. Chronic Kidney Disease
6. Alzheimer's Disease
7. Chronic Obstructive Pulmonary Disease (COPD)
8. Influenza and Pneumonia

## Files

### Final Scripts
- `main_diseases_analyzer_final.py` - Main script to generate the Excel analysis
- `verify_all_medications.py` - Script to verify all medications are included
- `final_analysis_summary.py` - Script to display summary statistics

### Data Sources
- `CSV/final_diseases_complete.csv` - Disease data with diagnosis, treatments, and tests
- `Analysis/drug_data_analysis.xlsx` - Comprehensive drug database with detailed information

### Output
- `Analysis/main_diseases_analysis_final.xlsx` - Final Excel file with complete analysis

## Usage

```bash
python main_diseases_analyzer_final.py
```

This will generate the Excel file with one sheet per disease, containing:
- Disease overview
- Diagnosis information
- Treatment options
- Tests and procedures
- Complete medication table with "What is", "Side Effects", and disease tags

## Verification

To verify the analysis:

```bash
python verify_all_medications.py
python final_analysis_summary.py
```

## Key Features

- **Complete medication coverage**: All medications from the database are included for each disease
- **Detailed drug information**: Each medication includes description, side effects, and disease association
- **Formatted for readability**: Proper text wrapping and column sizing
- **Comprehensive coverage**: 8 major diseases with full medical information
