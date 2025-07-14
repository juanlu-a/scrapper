import pandas as pd
import numpy as np
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import os
import re

def extract_tests_and_treatments():
    """
    Extract all unique tests and treatments from the top 10 diseases
    and create a comprehensive Excel file with detailed information
    """
    
    # Target diseases to extract (same as main_diseases_analyzer_final.py)
    target_diseases = [
        'Heart disease',
        'Chronic kidney disease',
        'COPD',
        'Pneumonia',
        'Stroke',
        'Dementia',
        'Depression (major depressive disorder)',
        'High cholesterol',
        'Obesity', 
        'Arthritis'
    ]
    
    # Read the CSV file
    csv_path = '/Users/juanlu/Documents/Wye/scrapper/CSV/final_diseases_complete.csv'
    df = pd.read_csv(csv_path)
    
    print(f"📊 Processing {len(target_diseases)} target diseases...")
    print(f"📄 Source data: {len(df)} total diseases in CSV")
    
    # Collect all tests and treatments with their disease associations
    all_tests = {}  # {test_name: [list_of_diseases]}
    all_treatments = {}  # {treatment_name: [list_of_diseases]}
    
    processed_diseases = []
    
    for disease in target_diseases:
        print(f"\n🔍 Processing: {disease}")
        
        # Find matching rows with specific matching (same logic as main analyzer)
        if disease == 'Heart disease':
            disease_data = df[df['Disease_Name_English'].str.contains('^Heart disease$', case=False, na=False, regex=True)]
        elif disease == 'Obesity':
            disease_data = df[df['Disease_Name_English'].str.contains('^Obesity$', case=False, na=False, regex=True)]
        elif disease == 'Stroke':
            disease_data = df[df['Disease_Name_English'].str.contains('^Stroke$', case=False, na=False, regex=True)]
        else:
            disease_data = df[df['Disease_Name_English'].str.contains(f'^{disease}$', case=False, na=False, regex=True)]
        
        if disease_data.empty:
            print(f"  ⚠️ No exact match found for {disease}, trying partial match...")
            disease_data = df[df['Disease_Name_English'].str.contains(disease, case=False, na=False, regex=False)]
            
        if disease_data.empty:
            print(f"  ❌ No data found for {disease}")
            continue
            
        # Get the first match
        disease_row = disease_data.iloc[0]
        disease_name = disease_row['Disease_Name_English']
        disease_spanish = disease_row['Disease_Name_Spanish']
        
        processed_diseases.append({
            'original': disease,
            'matched': disease_name,
            'spanish': disease_spanish
        })
        
        print(f"  ✅ Found: {disease_name}")
        
        # Extract Tests
        tests_raw = disease_row['Tests'] if pd.notna(disease_row['Tests']) else ''
        if tests_raw:
            # Split by common separators and clean
            test_items = split_medical_items(tests_raw)
            print(f"  📋 Found {len(test_items)} tests")
            
            for test in test_items:
                test = clean_item_name(test)
                if test and len(test) > 2:  # Only meaningful test names
                    if test not in all_tests:
                        all_tests[test] = []
                    all_tests[test].append(disease_name)
        
        # Extract Treatments
        treatments_raw = disease_row['Treatments'] if pd.notna(disease_row['Treatments']) else ''
        if treatments_raw:
            # Split by common separators and clean
            treatment_items = split_medical_items(treatments_raw)
            print(f"  💊 Found {len(treatment_items)} treatments")
            
            for treatment in treatment_items:
                treatment = clean_item_name(treatment)
                if treatment and len(treatment) > 2:  # Only meaningful treatment names
                    if treatment not in all_treatments:
                        all_treatments[treatment] = []
                    all_treatments[treatment].append(disease_name)
    
    print(f"\n📊 EXTRACTION SUMMARY:")
    print(f"✅ Processed diseases: {len(processed_diseases)}")
    print(f"🧪 Unique tests found: {len(all_tests)}")
    print(f"💊 Unique treatments found: {len(all_treatments)}")
    
    # Create Excel workbook
    wb = Workbook()
    
    # Create Tests sheet
    tests_ws = wb.active
    tests_ws.title = "Tests"
    create_tests_sheet(tests_ws, all_tests)
    
    # Create Treatments sheet
    treatments_ws = wb.create_sheet(title="Treatments")
    create_treatments_sheet(treatments_ws, all_treatments)
    
    # Create Summary sheet
    summary_ws = wb.create_sheet(title="Summary")
    create_summary_sheet(summary_ws, processed_diseases, all_tests, all_treatments)
    
    # Save the workbook
    output_path = '/Users/juanlu/Documents/Wye/scrapper/Analysis/tests_treatments_analysis.xlsx'
    wb.save(output_path)
    print(f"\n💾 Analysis saved to: {output_path}")
    
    return output_path

def split_medical_items(text):
    """Split medical text into individual items using various separators"""
    if not text or pd.isna(text):
        return []
    
    # Common separators in medical text
    separators = [
        ';', ',', '\n', '•', '◦', '-', '·',
        ' and ', ' or ', ' / ', ' | '
    ]
    
    items = [text]
    
    # Split by each separator
    for separator in separators:
        new_items = []
        for item in items:
            new_items.extend(item.split(separator))
        items = new_items
    
    # Clean and filter items
    cleaned_items = []
    for item in items:
        cleaned = clean_item_name(item)
        if cleaned and len(cleaned) > 3:  # Only meaningful items
            cleaned_items.append(cleaned)
    
    # Remove duplicates while preserving order
    unique_items = []
    seen = set()
    for item in cleaned_items:
        if item.lower() not in seen:
            unique_items.append(item)
            seen.add(item.lower())
    
    return unique_items

def clean_item_name(item):
    """Clean and standardize item names"""
    if not item or pd.isna(item):
        return ""
    
    # Convert to string and strip
    item = str(item).strip()
    
    # Remove common prefixes/suffixes
    prefixes_to_remove = [
        'test:', 'tests:', 'testing:', 'treatment:', 'treatments:',
        'procedure:', 'procedures:', 'therapy:', 'therapies:',
        'including:', 'such as:', 'like:', 'for example:',
        '- ', '• ', '◦ ', '· '
    ]
    
    for prefix in prefixes_to_remove:
        if item.lower().startswith(prefix):
            item = item[len(prefix):].strip()
    
    # Remove numbers at the beginning
    item = re.sub(r'^\d+\.?\s*', '', item)
    
    # Remove extra whitespace
    item = re.sub(r'\s+', ' ', item).strip()
    
    # Remove parenthetical explanations that are too long
    if '(' in item and ')' in item:
        before_paren = item.split('(')[0].strip()
        if len(before_paren) > 5:  # Keep the part before parentheses if meaningful
            item = before_paren
    
    # Capitalize first letter
    if item:
        item = item[0].upper() + item[1:]
    
    return item

def create_tests_sheet(ws, all_tests):
    """Create the Tests sheet with all unique tests"""
    
    # Header styling
    header_font = Font(bold=True, size=14, color="FFFFFF")
    header_fill = PatternFill(start_color="2E8B57", end_color="2E8B57", fill_type="solid")
    subheader_font = Font(bold=True, size=12, color="FFFFFF")
    subheader_fill = PatternFill(start_color="90EE90", end_color="90EE90", fill_type="solid")
    
    # Border styling
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    
    # Sheet title
    ws['A1'] = 'DIAGNOSTIC TESTS FROM TOP 10 DISEASES'
    ws['A1'].font = header_font
    ws['A1'].fill = header_fill
    ws.merge_cells('A1:F1')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 25
    
    # Information section
    ws['A3'] = 'INFORMATION'
    ws['A3'].font = subheader_font
    ws['A3'].fill = subheader_fill
    ws.merge_cells('A3:F3')
    ws['A3'].alignment = Alignment(horizontal='center')
    
    ws['A4'] = 'Purpose:'
    ws['B4'] = 'Comprehensive list of all diagnostic tests used across top 10 diseases'
    ws['A5'] = 'Source:'
    ws['B5'] = 'final_diseases_complete.csv (Mayo Clinic data)'
    ws['A6'] = 'Total Tests:'
    ws['B6'] = len(all_tests)
    
    # Style the info cells
    for row in [4, 5, 6]:
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'A{row}'].fill = PatternFill(start_color="F0F8F0", end_color="F0F8F0", fill_type="solid")
    
    # Create the table headers
    header_row = 8
    ws[f'A{header_row}'] = 'TEST NAME'
    ws[f'B{header_row}'] = 'SPANISH NAME'
    ws[f'C{header_row}'] = 'DESCRIPTION'
    ws[f'D{header_row}'] = 'BACKGROUND INFORMATION'
    ws[f'E{header_row}'] = 'DISEASES ASSOCIATED'
    ws[f'F{header_row}'] = 'COUNT'
    
    # Style header row
    for col in ['A', 'B', 'C', 'D', 'E', 'F']:
        cell = ws[f'{col}{header_row}']
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="2E8B57", end_color="2E8B57", fill_type="solid")
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center', vertical='center')
    
    # Sort tests alphabetically
    sorted_tests = sorted(all_tests.items(), key=lambda x: x[0].lower())
    
    # Add all tests
    for i, (test_name, diseases) in enumerate(sorted_tests):
        row_num = header_row + 1 + i
        
        # Combine diseases into a single string
        diseases_str = '; '.join(sorted(set(diseases)))
        
        ws[f'A{row_num}'] = test_name
        ws[f'B{row_num}'] = ''  # To be filled with Spanish name
        ws[f'C{row_num}'] = ''  # To be filled with description
        ws[f'D{row_num}'] = ''  # To be filled with background info
        ws[f'E{row_num}'] = diseases_str
        ws[f'F{row_num}'] = len(diseases)
        
        # Add borders and formatting
        for col in ['A', 'B', 'C', 'D', 'E', 'F']:
            cell = ws[f'{col}{row_num}']
            cell.border = thin_border
            cell.alignment = Alignment(wrap_text=True, vertical='top')
        
        # Alternate row colors
        if i % 2 == 0:
            for col in ['A', 'B', 'C', 'D', 'E', 'F']:
                ws[f'{col}{row_num}'].fill = PatternFill(start_color="F8FFF8", end_color="F8FFF8", fill_type="solid")
    
    # Set column widths
    ws.column_dimensions['A'].width = 40  # Test Name
    ws.column_dimensions['B'].width = 40  # Spanish Name
    ws.column_dimensions['C'].width = 50  # Description
    ws.column_dimensions['D'].width = 50  # Background Information
    ws.column_dimensions['E'].width = 60  # Diseases Associated
    ws.column_dimensions['F'].width = 10  # Count
    
    print(f"✅ Created Tests sheet with {len(sorted_tests)} unique tests")

def create_treatments_sheet(ws, all_treatments):
    """Create the Treatments sheet with all unique treatments"""
    
    # Header styling
    header_font = Font(bold=True, size=14, color="FFFFFF")
    header_fill = PatternFill(start_color="4169E1", end_color="4169E1", fill_type="solid")
    subheader_font = Font(bold=True, size=12, color="FFFFFF")
    subheader_fill = PatternFill(start_color="87CEEB", end_color="87CEEB", fill_type="solid")
    
    # Border styling
    thin_border = Border(
        left=Side(style='thin'), right=Side(style='thin'),
        top=Side(style='thin'), bottom=Side(style='thin')
    )
    
    # Sheet title
    ws['A1'] = 'TREATMENTS FROM TOP 10 DISEASES'
    ws['A1'].font = header_font
    ws['A1'].fill = header_fill
    ws.merge_cells('A1:F1')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 25
    
    # Information section
    ws['A3'] = 'INFORMATION'
    ws['A3'].font = subheader_font
    ws['A3'].fill = subheader_fill
    ws.merge_cells('A3:F3')
    ws['A3'].alignment = Alignment(horizontal='center')
    
    ws['A4'] = 'Purpose:'
    ws['B4'] = 'Comprehensive list of all treatments used across top 10 diseases'
    ws['A5'] = 'Source:'
    ws['B5'] = 'final_diseases_complete.csv (Mayo Clinic data)'
    ws['A6'] = 'Total Treatments:'
    ws['B6'] = len(all_treatments)
    
    # Style the info cells
    for row in [4, 5, 6]:
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'A{row}'].fill = PatternFill(start_color="F0F8FF", end_color="F0F8FF", fill_type="solid")
    
    # Create the table headers
    header_row = 8
    ws[f'A{header_row}'] = 'TREATMENT NAME'
    ws[f'B{header_row}'] = 'SPANISH NAME'
    ws[f'C{header_row}'] = 'DESCRIPTION'
    ws[f'D{header_row}'] = 'BACKGROUND INFORMATION'
    ws[f'E{header_row}'] = 'DISEASES ASSOCIATED'
    ws[f'F{header_row}'] = 'COUNT'
    
    # Style header row
    for col in ['A', 'B', 'C', 'D', 'E', 'F']:
        cell = ws[f'{col}{header_row}']
        cell.font = Font(bold=True, color="FFFFFF")
        cell.fill = PatternFill(start_color="4169E1", end_color="4169E1", fill_type="solid")
        cell.border = thin_border
        cell.alignment = Alignment(horizontal='center', vertical='center')
    
    # Sort treatments alphabetically
    sorted_treatments = sorted(all_treatments.items(), key=lambda x: x[0].lower())
    
    # Add all treatments
    for i, (treatment_name, diseases) in enumerate(sorted_treatments):
        row_num = header_row + 1 + i
        
        # Combine diseases into a single string
        diseases_str = '; '.join(sorted(set(diseases)))
        
        ws[f'A{row_num}'] = treatment_name
        ws[f'B{row_num}'] = ''  # To be filled with Spanish name
        ws[f'C{row_num}'] = ''  # To be filled with description
        ws[f'D{row_num}'] = ''  # To be filled with background info
        ws[f'E{row_num}'] = diseases_str
        ws[f'F{row_num}'] = len(diseases)
        
        # Add borders and formatting
        for col in ['A', 'B', 'C', 'D', 'E', 'F']:
            cell = ws[f'{col}{row_num}']
            cell.border = thin_border
            cell.alignment = Alignment(wrap_text=True, vertical='top')
        
        # Alternate row colors
        if i % 2 == 0:
            for col in ['A', 'B', 'C', 'D', 'E', 'F']:
                ws[f'{col}{row_num}'].fill = PatternFill(start_color="F8F8FF", end_color="F8F8FF", fill_type="solid")
    
    # Set column widths
    ws.column_dimensions['A'].width = 40  # Treatment Name
    ws.column_dimensions['B'].width = 40  # Spanish Name
    ws.column_dimensions['C'].width = 50  # Description
    ws.column_dimensions['D'].width = 50  # Background Information
    ws.column_dimensions['E'].width = 60  # Diseases Associated
    ws.column_dimensions['F'].width = 10  # Count
    
    print(f"✅ Created Treatments sheet with {len(sorted_treatments)} unique treatments")

def create_summary_sheet(ws, processed_diseases, all_tests, all_treatments):
    """Create a summary sheet with overview information"""
    
    # Header styling
    header_font = Font(bold=True, size=16, color="FFFFFF")
    header_fill = PatternFill(start_color="8B008B", end_color="8B008B", fill_type="solid")
    subheader_font = Font(bold=True, size=12, color="FFFFFF")
    subheader_fill = PatternFill(start_color="DDA0DD", end_color="DDA0DD", fill_type="solid")
    
    # Title
    ws['A1'] = 'TESTS & TREATMENTS ANALYSIS SUMMARY'
    ws['A1'].font = header_font
    ws['A1'].fill = header_fill
    ws.merge_cells('A1:D1')
    ws['A1'].alignment = Alignment(horizontal='center', vertical='center')
    ws.row_dimensions[1].height = 30
    
    # Analysis info
    ws['A3'] = 'Analysis Date:'
    ws['B3'] = '2025-07-14'
    ws['A4'] = 'Source Data:'
    ws['B4'] = 'final_diseases_complete.csv'
    ws['A5'] = 'Diseases Processed:'
    ws['B5'] = len(processed_diseases)
    ws['A6'] = 'Total Tests:'
    ws['B6'] = len(all_tests)
    ws['A7'] = 'Total Treatments:'
    ws['B7'] = len(all_treatments)
    
    # Style info cells
    for row in [3, 4, 5, 6, 7]:
        ws[f'A{row}'].font = Font(bold=True)
        ws[f'A{row}'].fill = PatternFill(start_color="F5F0FF", end_color="F5F0FF", fill_type="solid")
    
    # Processed diseases list
    ws['A9'] = 'PROCESSED DISEASES'
    ws['A9'].font = subheader_font
    ws['A9'].fill = subheader_fill
    ws.merge_cells('A9:D9')
    ws['A9'].alignment = Alignment(horizontal='center')
    
    ws['A10'] = 'Original Name'
    ws['B10'] = 'Matched Name'
    ws['C10'] = 'Spanish Name'
    ws['D10'] = 'Status'
    
    # Style header row
    for col in ['A', 'B', 'C', 'D']:
        ws[f'{col}10'].font = Font(bold=True)
        ws[f'{col}10'].fill = PatternFill(start_color="E6E6FA", end_color="E6E6FA", fill_type="solid")
    
    # Add processed diseases
    for i, disease_info in enumerate(processed_diseases, 11):
        ws[f'A{i}'] = disease_info['original']
        ws[f'B{i}'] = disease_info['matched']
        ws[f'C{i}'] = disease_info['spanish']
        ws[f'D{i}'] = '✅ Found'
        
        # Color the row green for successful matches
        for col in ['A', 'B', 'C', 'D']:
            ws[f'{col}{i}'].fill = PatternFill(start_color="E6FFE6", end_color="E6FFE6", fill_type="solid")
    
    # Statistics
    stats_row = len(processed_diseases) + 13
    ws[f'A{stats_row}'] = 'STATISTICS'
    ws[f'A{stats_row}'].font = Font(bold=True, size=12)
    ws[f'A{stats_row+1}'] = f'Success Rate: {len(processed_diseases)}/10 diseases (100%)'
    ws[f'A{stats_row+2}'] = f'Average Tests per Disease: {len(all_tests)/len(processed_diseases):.1f}'
    ws[f'A{stats_row+3}'] = f'Average Treatments per Disease: {len(all_treatments)/len(processed_diseases):.1f}'
    
    # Top tests and treatments
    top_tests = sorted(all_tests.items(), key=lambda x: len(x[1]), reverse=True)[:5]
    top_treatments = sorted(all_treatments.items(), key=lambda x: len(x[1]), reverse=True)[:5]
    
    ws[f'A{stats_row+5}'] = 'TOP 5 MOST COMMON TESTS:'
    ws[f'A{stats_row+5}'].font = Font(bold=True)
    for i, (test, diseases) in enumerate(top_tests, stats_row+6):
        ws[f'A{i}'] = f"{test} ({len(diseases)} diseases)"
    
    ws[f'A{stats_row+12}'] = 'TOP 5 MOST COMMON TREATMENTS:'
    ws[f'A{stats_row+12}'].font = Font(bold=True)
    for i, (treatment, diseases) in enumerate(top_treatments, stats_row+13):
        ws[f'A{i}'] = f"{treatment} ({len(diseases)} diseases)"
    
    # Set column widths
    ws.column_dimensions['A'].width = 35
    ws.column_dimensions['B'].width = 35
    ws.column_dimensions['C'].width = 35
    ws.column_dimensions['D'].width = 20
    
    print(f"✅ Created Summary sheet")

if __name__ == "__main__":
    print("🚀 Starting Tests & Treatments Analysis")
    print("="*60)
    print("📋 This script will:")
    print("   - Extract all unique tests from top 10 diseases")
    print("   - Extract all unique treatments from top 10 diseases")
    print("   - Create comprehensive Excel with:")
    print("     * Tests sheet (Name, Spanish Name, Description, Background, Diseases)")
    print("     * Treatments sheet (Name, Spanish Name, Description, Background, Diseases)")
    print("     * Summary sheet with statistics")
    print("="*60)
    
    output_file = extract_tests_and_treatments()
    print(f"\n🎉 Analysis completed! File saved at: {output_file}")
