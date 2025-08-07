import pandas as pd
import os
import glob
from datetime import datetime
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import TimeoutException, WebDriverException
import re
from bs4 import BeautifulSoup
import json

class MedicationScraper:
    def __init__(self):
        self.driver = None
        self.existing_data = {}
        self.cache_file = "scraping_cache.json"
        self.batch_size = 10
        
    def setup_driver(self):
        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-blink-features=AutomationControlled')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)
        chrome_options.add_argument('--disable-popup-blocking')
        chrome_options.add_argument('--disable-notifications')
        chrome_options.add_argument('--disable-images')
        chrome_options.add_argument('--disable-extensions')
        chrome_options.add_argument('--disable-plugins')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--disable-web-security')
        chrome_options.add_argument('--disable-features=VizDisplayCompositor')
        chrome_options.add_argument('--timeout=15000')
        chrome_options.add_argument('--page-load-strategy=eager')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--remote-debugging-port=9222')
        chrome_options.add_argument('--disable-css')
        chrome_options.add_argument('--disable-javascript')
        
        self.driver = webdriver.Chrome(options=chrome_options)
        self.driver.set_page_load_timeout(15)
        self.driver.set_script_timeout(15)
        self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    def is_driver_working(self):
        try:
            self.driver.current_url
            return True
        except:
            return False
    
    def pause_for_manual_intervention(self):
        print("🤖 Automatic mode - continuing automatically...")
        time.sleep(2)
        return True
        
    def restart_driver(self):
        try:
            if self.driver:
                self.driver.quit()
        except:
            pass
        time.sleep(3)
        self.setup_driver()
    
    def load_cache(self):
        if os.path.exists(self.cache_file):
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except:
                return {}
        return {}
    
    def save_cache(self, cache_data):
        with open(self.cache_file, 'w') as f:
            json.dump(cache_data, f)
    
    def load_existing_data(self):
        print("📊 LOADING EXISTING DATA")
        print("=" * 40)
        
        pattern = "medication_*.xlsx"
        files = glob.glob(pattern)
        
        if not files:
            print("❌ No existing medication files found")
            print("🆕 A new Excel file will be created")
            return {}, None
        
        files.sort(key=os.path.getmtime, reverse=True)
        latest_file = files[0]
        print(f"📁 Most recent file found: {latest_file}")
        
        try:
            df = pd.read_excel(latest_file)
            existing_data = {}
            
            for _, row in df.iterrows():
                medication_name = str(row['Name']).strip()
                if pd.notna(medication_name) and medication_name != 'nan':
                    existing_data[medication_name] = {
                        'brand_name': str(row['Brand Name']) if pd.notna(row['Brand Name']) else 'Not found',
                        'dosage': str(row['Dosage']) if pd.notna(row['Dosage']) else 'Not found',
                        'how_to_take': str(row['How to Take']) if pd.notna(row['How to Take']) else 'Not found',
                        'when_to_take': str(row['When to Take']) if pd.notna(row['When to Take']) else 'Not found'
                    }
            
            print(f"✅ Loaded {len(existing_data)} existing medications")
            return existing_data, latest_file
            
        except Exception as e:
            print(f"❌ Error cargando datos existentes: {e}")
            return {}, None
    
    def read_original_medications(self):
        print("\n📖 READING MEDICATIONS FROM ORIGINAL EXCEL")
        print("=" * 40)
        
        try:
            df = pd.read_excel('Analysis/main_diseases_analysis_final.xlsx')
            
            print(f"📋 Available columns: {list(df.columns)}")
            
            medication_column = None
            
            for col in df.columns:
                col_str = str(col).lower()
                if 'unique medications' in col_str or 'all unique' in col_str:
                    medication_column = col
                    break
            
            if medication_column is None:
                print("🔍 Searching in all Excel sheets...")
                xl_file = pd.ExcelFile('Analysis/main_diseases_analysis_final.xlsx')
                
                for sheet_name in xl_file.sheet_names:
                    print(f"📄 Checking sheet: {sheet_name}")
                    sheet_df = pd.read_excel('Analysis/main_diseases_analysis_final.xlsx', sheet_name=sheet_name)
                    
                    for col in sheet_df.columns:
                        col_str = str(col).lower()
                        if 'unique medications' in col_str or 'all unique' in col_str or 'medication' in col_str:
                            medication_column = col
                            print(f"✅ Column found in sheet '{sheet_name}': {col}")
                            df = sheet_df
                            break
                    if medication_column:
                        break
            
            if medication_column is None:
                print("❌ Medication column not found. Using the first column.")
                medication_column = df.columns[0]
            
            print(f"📋 Selected column: {medication_column}")
            
            medications = []
            for _, row in df.iterrows():
                medication = str(row[medication_column]).strip()
                if pd.notna(medication) and medication != 'nan':
                    medications.append(medication)
            
            print(f"📊 Total medications in original Excel: {len(medications)}")
            return medications
            
        except Exception as e:
            print(f"❌ Error leyendo Excel original: {e}")
            return []
    
    def identify_missing_medications(self, original_medications):
        print("\n🔍 IDENTIFYING MISSING MEDICATIONS")
        print("=" * 40)
        
        excluded_terms = [
            'ENHANCED SUMMARY', 'Total Unique Medications: 196', 
            'Diseases Analyzed: 10', 'Next Steps: Populate columns B-E with medication data',
            'INFORMATION', 'Purpose:', 'Source:', 'Enhancement:', 'MEDICATION NAME',
            'Total Unique Medications:', 'Diseases Analyzed:', 'Next Steps:'
        ]
        
        valid_original_medications = []
        for medication in original_medications:
            is_valid = True
            for excluded in excluded_terms:
                if excluded.lower() in medication.lower():
                    is_valid = False
                    break
            if is_valid and len(medication.strip()) > 2:
                valid_original_medications.append(medication)
        
        print(f"📊 Valid medications from original: {len(valid_original_medications)}")
        
        missing_medications = []
        for medication in valid_original_medications:
            if medication not in self.existing_data:
                missing_medications.append(medication)
        
        print(f"🆕 Missing medications: {len(missing_medications)}")
        print(f"✅ Already existing medications: {len(valid_original_medications) - len(missing_medications)}")
        
        if missing_medications:
            print("\n📋 Missing medications:")
            for i, med in enumerate(missing_medications[:10], 1):
                print(f"  {i}. {med}")
            if len(missing_medications) > 10:
                print(f"  ... and {len(missing_medications) - 10} more")
        
        return missing_medications
    
    def find_medication_link(self, medication_name):
        try:
            time.sleep(2)
            
            clean_name = medication_name.lower().strip()
            clean_name_no_spaces = clean_name.replace(' ', '')
            
            selectors = [
                "a[href*='/drugs/']",
                "a[href*='/drug/']", 
                "a[href*='/medication/']",
                "a[href*='/drugs.com/']",
                ".search-results a",
                ".drug-results a",
                "a[href*='drugs.com']",
                ".drug-link a",
                ".result-item a",
                "a[href*='/drugs/']"
            ]
            
            for selector in selectors:
                try:
                    links = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    
                    for link in links:
                        try:
                            link_text = link.text.lower().strip()
                            href = link.get_attribute('href').lower()
                            
                            if (clean_name in link_text or 
                                clean_name in href or
                                clean_name_no_spaces in href or
                                any(word in link_text for word in clean_name.split() if len(word) > 2)):
                                
                                exclude_terms = ['side effects', 'español', 'spanish', 'interactions', 'pregnancy', 'breastfeeding', 'overdose']
                                if not any(exclude in link_text for exclude in exclude_terms):
                                    print(f"✅ Found link: {link_text} -> {href}")
                                    return link
                        except Exception as e:
                            continue
                except Exception as e:
                    continue
            
            page_text = self.driver.page_source.lower()
            if clean_name in page_text:
                all_links = self.driver.find_elements(By.TAG_NAME, "a")
                for link in all_links:
                    try:
                        href = link.get_attribute('href')
                        link_text = link.text.lower().strip()
                        
                        if href and (clean_name in href.lower() or clean_name in link_text):
                            exclude_terms = ['side effects', 'español', 'spanish', 'interactions', 'pregnancy', 'breastfeeding', 'overdose']
                            if not any(exclude in href.lower() for exclude in exclude_terms):
                                print(f"✅ Found link via text search: {link_text} -> {href}")
                                return link
                    except:
                        continue
            
            print(f"❌ No suitable link found for {medication_name}")
            return None
            
        except Exception as e:
            print(f"❌ Error searching for link: {e}")
            return None
    
        def process_medication(self, medication_name):
        max_retries = 3
        for attempt in range(max_retries):
            try:
                print(f"🔍 Processing: {medication_name} (attempt {attempt + 1}/{max_retries})")
                
                if not self.is_driver_working():
                    print("🔄 Driver not working, restarting...")
                    try:
                        self.restart_driver()
                    except Exception as e:
                        print(f"❌ Error restarting driver: {e}")
                        print("⏸️  Manual intervention needed...")
                        if not self.pause_for_manual_intervention():
                            return
                        try:
                            self.setup_driver()
                        except Exception as e2:
                            print(f"❌ Critical error: {e2}")
                            return
                
                try:
                    self.driver.get("https://www.drugs.com")
                    time.sleep(2)
                except Exception as e:
                    print(f"❌ Error loading drugs.com: {e}")
                    if attempt < max_retries - 1:
                        print(f"🔄 Retrying... (attempt {attempt + 2}/{max_retries})")
                        time.sleep(3)
                        continue
                    else:
                        print(f"⚠️ Failed to load drugs.com after {max_retries} attempts")
                    return None
                
                try:
                    search_box = WebDriverWait(self.driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, "input[name='searchterm']"))
                    )
                except:
                    search_selectors = [
                        "input[type='text']",
                        "input[placeholder*='search']",
                        "input[placeholder*='Search']",
                        "#search",
                        ".search-input",
                        "input[name='q']",
                        "input[type='search']",
                        ".search-box input",
                        "#searchbox"
                    ]
                    
                    search_box = None
                    for selector in search_selectors:
                        try:
                            search_box = self.driver.find_element(By.CSS_SELECTOR, selector)
                            print(f"✅ Found search box with selector: {selector}")
                            break
                        except:
                            continue
                    
                    if not search_box:
                        print(f"❌ Search box not found for {medication_name}")
                        if attempt < max_retries - 1:
                            print(f"🔄 Retrying... (attempt {attempt + 2}/{max_retries})")
                            time.sleep(1)
                            continue
                        else:
                            print(f"⚠️ Failed to find search box after {max_retries} attempts")
                        return None
                
                search_box.clear()
                search_box.send_keys(medication_name)
                time.sleep(0.5)
                
                try:
                    search_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
                    self.driver.execute_script("arguments[0].click();", search_button)
                    print("✅ Search button clicked")
                except:
                    try:
                        search_button_selectors = [
                            "button[type='submit']",
                            "input[type='submit']",
                            ".search-button",
                            ".btn-search",
                            "button:contains('Search')",
                            "input[value*='Search']"
                        ]
                        
                        for selector in search_button_selectors:
                            try:
                                search_button = self.driver.find_element(By.CSS_SELECTOR, selector)
                                self.driver.execute_script("arguments[0].click();", search_button)
                                print(f"✅ Search button clicked with selector: {selector}")
                                break
                            except:
                                continue
                        else:
                            search_box.send_keys(Keys.RETURN)
                            print("✅ Search executed with Enter key")
                    except Exception as e:
                        print(f"⚠️ Error with search button: {e}")
                        search_box.send_keys(Keys.RETURN)
                        print("✅ Search executed with Enter key (fallback)")
                
                time.sleep(2)
                
                medication_link = self.find_medication_link(medication_name)
                if medication_link:
                    try:
                        if not self.is_driver_working():
                            print("🔄 Driver not working before clicking, restarting...")
                            self.restart_driver()
                            continue
                        
                        self.driver.execute_script("arguments[0].click();", medication_link)
                        time.sleep(3)
                        
                        info = self.extract_medication_info(self.driver.page_source)
                        
                        print(f"📊 Extracted data for {medication_name}:")
                        print(f"  Brand: {info['brand_name']}")
                        print(f"  Dosage: {info['dosage']}")
                        print(f"  How to Take: {info['how_to_take']}")
                        print(f"  When to Take: {info['when_to_take']}")
                        
                        return info
                    except Exception as e:
                        print(f"❌ Error clicking on link: {e}")
                        if attempt < max_retries - 1:
                            print(f"🔄 Retrying... (attempt {attempt + 2}/{max_retries})")
                            time.sleep(2)
                            continue
                        else:
                            print(f"⚠️ Failed to process {medication_name} after {max_retries} attempts")
                            return None
                else:
                    print(f"❌ No link found for {medication_name}")
                    if attempt < max_retries - 1:
                        print(f"🔄 Retrying... (attempt {attempt + 2}/{max_retries})")
                        time.sleep(2)
                        continue
                    else:
                        print(f"⚠️ Failed to find link after {max_retries} attempts")
                    return None
                    
            except Exception as e:
                print(f"❌ Error processing {medication_name}: {e}")
                if attempt < max_retries - 1:
                    print(f"🔄 Retrying... (attempt {attempt + 2}/{max_retries})")
                    time.sleep(2)
                    continue
                else:
                    print(f"⚠️ Failed to process {medication_name} after {max_retries} attempts")
                return None
        
        print(f"⚠️ Failed to process {medication_name} after {max_retries} attempts")
        return None
    
    def extract_medication_info(self, page_source):
        soup = BeautifulSoup(page_source, 'html.parser')
        
        brand_name = self.extract_brand_name(page_source)
        dosage = self.extract_dosage(page_source)
        how_to_take = self.extract_how_to_take(page_source)
        when_to_take = self.extract_when_to_take(page_source)
        
        return {
            'brand_name': brand_name,
            'dosage': dosage,
            'how_to_take': how_to_take,
            'when_to_take': when_to_take
        }
    
    def extract_brand_name(self, page_source):
        brand_patterns = [
            r'Brand name[s]?:\s*([^,\n]+)',
            r'Brand:\s*([^,\n]+)',
            r'<strong>Brand name[s]?:</strong>\s*([^<]+)',
            r'<td[^>]*>Brand name[s]?:</td>\s*<td[^>]*>([^<]+)</td>'
        ]
        
        for pattern in brand_patterns:
            match = re.search(pattern, page_source, re.IGNORECASE)
            if match:
                brand_name = self.clean_text(match.group(1))
                if brand_name and len(brand_name) < 100:
                    if not any(generic in brand_name.lower() for generic in ['generic', 'tablet', 'pill', 'capsule', 'liquid', 'injection']):
                        return brand_name
        
        common_brands = [
            'Bayer', 'Ecotrin', 'St. Joseph', 'Bufferin', 'Anacin', 'Excedrin',
            'Advil', 'Motrin', 'Aleve', 'Tylenol', 'Zantac', 'Prilosec',
            'Lipitor', 'Zocor', 'Crestor', 'Plavix', 'Zoloft', 'Prozac',
            'Xanax', 'Valium', 'Ativan', 'Klonopin', 'Ambien', 'Lunesta',
            'Vicodin', 'Percocet', 'OxyContin', 'Morphine', 'Fentanyl',
            'Adderall', 'Ritalin', 'Concerta', 'Vyvanse', 'Strattera',
            'Abilify', 'Seroquel', 'Risperdal', 'Zyprexa', 'Geodon',
            'Depakote', 'Lamictal', 'Tegretol', 'Trileptal', 'Keppra',
            'Eliquis', 'Xarelto', 'Pradaxa', 'Warfarin', 'Heparin',
            'Lovenox', 'Fragmin', 'Arixtra', 'Pradaxa', 'Xarelto',
            'Metformin', 'Glucophage', 'Januvia', 'Invokana', 'Farxiga',
            'Jardiance', 'Victoza', 'Trulicity', 'Ozempic', 'Wegovy',
            'Lantus', 'NovoLog', 'Humalog', 'Tresiba', 'Toujeo',
            'Lisinopril', 'Enalapril', 'Ramipril', 'Benazepril', 'Quinapril',
            'Amlodipine', 'Norvasc', 'Diltiazem', 'Verapamil', 'Nifedipine',
            'Metoprolol', 'Atenolol', 'Propranolol', 'Carvedilol', 'Nebivolol',
            'Losartan', 'Valsartan', 'Candesartan', 'Irbesartan', 'Olmesartan',
            'Furosemide', 'Lasix', 'Hydrochlorothiazide', 'HCTZ', 'Chlorthalidone',
            'Omeprazole', 'Prilosec', 'Esomeprazole', 'Nexium', 'Pantoprazole',
            'Lansoprazole', 'Prevacid', 'Rabeprazole', 'Aciphex', 'Dexilant',
            'Simvastatin', 'Zocor', 'Atorvastatin', 'Lipitor', 'Rosuvastatin',
            'Crestor', 'Pravastatin', 'Pravachol', 'Fluvastatin', 'Lescol',
            'Albuterol', 'Proventil', 'Ventolin', 'ProAir', 'Xopenex',
            'Fluticasone', 'Flonase', 'Nasonex', 'Rhinocort', 'Nasacort',
            'Montelukast', 'Singulair', 'Zafirlukast', 'Accolate', 'Zileuton',
            'Ipratropium', 'Atrovent', 'Tiotropium', 'Spiriva', 'Umeclidinium',
            'Incruse', 'Vilanterol', 'Breo', 'Formoterol', 'Perforomist',
            'Salmeterol', 'Serevent', 'Budesonide', 'Pulmicort', 'Ciclesonide',
            'Alvesco', 'Mometasone', 'Asmanex', 'Cromolyn', 'Intal'
        ]
        
        page_lower = page_source.lower()
        for brand in common_brands:
            if brand.lower() in page_lower:
                brand_context = re.search(rf'\b{brand}\b', page_source, re.IGNORECASE)
                if brand_context:
                    return brand
        
        alt_patterns = [
            r'Also known as:\s*([^,\n]+)',
            r'Alternative names?:\s*([^,\n]+)',
            r'Common brands?:\s*([^,\n]+)'
        ]
        
        for pattern in alt_patterns:
            match = re.search(pattern, page_source, re.IGNORECASE)
            if match:
                brand_name = self.clean_text(match.group(1))
                if brand_name and len(brand_name) < 100:
                    if not any(generic in brand_name.lower() for generic in ['generic', 'tablet', 'pill', 'capsule', 'liquid', 'injection']):
                        return brand_name
        
        generic_terms = ['aspirin', 'acetaminophen', 'ibuprofen', 'naproxen', 'metformin', 'lisinopril', 'amlodipine']
        page_lower = page_source.lower()
        for generic in generic_terms:
            if generic in page_lower:
                return "Generic"
        
        return "Not found"
    
    def extract_dosage(self, page_source):
        """Extract dosage information from the page"""
        # Look for dosage information in specific sections first
        dosage_sections = [
            'dosage',
            'strength',
            'available as',
            'form',
            'administration'
        ]
        
        page_lower = page_source.lower()
        
        # Search in dosage-related sections
        for section in dosage_sections:
            if section in page_lower:
                # Find the section and extract dosage info
                section_start = page_lower.find(section)
                section_end = min(section_start + 2000, len(page_lower))
                section_text = page_source[section_start:section_end]
                
                # Look for dosage patterns in this section
                dosage = self.find_dosage_in_text(section_text)
                if dosage != "Not found":
                    return dosage
        
        # If not found in sections, search the entire page
        return self.find_dosage_in_text(page_source)
    
    def find_dosage_in_text(self, text):
        """Find dosage information in text - focusing on administration form"""
        # Look for specific administration forms and types
        form_patterns = [
            # Oral forms
            r'(?:oral\s+)?(?:tablet|pill|capsule|liquid|suspension|syrup|solution|powder|granule)',
            r'(?:chewable|disintegrating|extended\s+release|effervescent|compounding)',
            r'(?:oral\s+)?(?:tablet|pill|capsule)(?:\s+extended\s+release)?',
            r'(?:oral\s+)?(?:liquid|suspension|syrup|solution)',
            r'(?:oral\s+)?(?:powder|granule|effervescent)',
            
            # Injection forms
            r'(?:injection|injectable|subcutaneous|intramuscular|intravenous)',
            r'(?:intravenous\s+solution|subcutaneous\s+injection)',
            
            # Inhalation forms
            r'(?:inhalation|inhaler|aerosol|nebulizer)',
            
            # Topical forms
            r'(?:topical|cream|ointment|gel|patch|lotion)',
            
            # Other forms
            r'(?:rectal\s+suppository|ophthalmic|otic|intranasal|nasal\s+spray)',
            
            # Generic patterns
            r'(?:tablet|capsule|pill|liquid|suspension|syrup|solution|powder|granule)',
            r'(?:injection|inhalation|topical|rectal|ophthalmic|otic|nasal)'
        ]
        
        forms = []
        for pattern in form_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                if isinstance(match, tuple):
                    match = match[0]
                cleaned = self.clean_text(match)
                if cleaned and len(cleaned) > 2:
                    # Avoid false positives
                    if not any(exclude in cleaned.lower() for exclude in ['ear', 'eye', 'nose', 'mouth', 'skin', 'head', 'hand', 'foot']):
                        forms.append(cleaned)
        
        if forms:
            # Standardize the form names
            return self.standardize_administration_form(forms[0])
        
        return "Not found"
    
    def standardize_administration_form(self, form):
        form_lower = form.lower().strip()
        
        mappings = {
            'tablet': 'Oral tablet',
            'pill': 'Oral tablet',
            'capsule': 'Oral capsule',
            'liquid': 'Oral liquid',
            'suspension': 'Oral suspension',
            'syrup': 'Oral syrup',
            'solution': 'Oral solution',
            'powder': 'Oral powder',
            'granule': 'Oral granule',
            'chewable': 'Chewable tablet',
            'disintegrating': 'Oral tablet, disintegrating',
            'extended release': 'Oral tablet, extended release',
            'effervescent': 'Oral tablet, effervescent',
            'compounding': 'Compounding powder',
            'injection': 'Injection',
            'injectable': 'Injection',
            'subcutaneous': 'Subcutaneous injection',
            'intramuscular': 'Intramuscular injection',
            'intravenous': 'Intravenous solution',
            'inhalation': 'Inhalation',
            'inhaler': 'Inhalation',
            'aerosol': 'Inhalation aerosol',
            'nebulizer': 'Inhalation nebulizer',
            'topical': 'Topical',
            'cream': 'Topical cream',
            'ointment': 'Topical ointment',
            'gel': 'Topical gel',
            'patch': 'Topical patch',
            'rectal suppository': 'Rectal suppository',
            'ophthalmic': 'Ophthalmic',
            'otic': 'Otic',
            'intranasal': 'Intranasal',
            'nasal spray': 'Nasal spray'
        }
        
        for key, value in mappings.items():
            if key in form_lower:
                return value
        
        if any(word in form_lower for word in ['tablet', 'pill', 'capsule']):
            if 'chewable' in form_lower:
                return 'Chewable tablet'
            elif 'disintegrating' in form_lower:
                return 'Oral tablet, disintegrating'
            elif 'extended' in form_lower or 'release' in form_lower:
                return 'Oral tablet, extended release'
            elif 'effervescent' in form_lower:
                return 'Oral tablet, effervescent'
            elif 'oral' in form_lower:
                return 'Oral tablet'
            else:
                return 'Oral tablet'
        elif any(word in form_lower for word in ['liquid', 'suspension', 'syrup', 'solution']):
            return 'Oral liquid'
        elif any(word in form_lower for word in ['powder', 'granule']):
            return 'Oral powder'
        elif any(word in form_lower for word in ['injection', 'injectable']):
            return 'Injection'
        elif any(word in form_lower for word in ['inhalation', 'inhaler', 'aerosol']):
            return 'Inhalation'
        elif any(word in form_lower for word in ['topical', 'cream', 'ointment', 'gel', 'patch']):
            return 'Topical'
        else:
            return form.capitalize()
        
        return "Not found"
    

    
    def extract_how_to_take(self, page_source):
        how_sections = [
            'how to take',
            'administration',
            'instructions',
            'directions',
            'how to use'
        ]
        
        page_lower = page_source.lower()
        
        for section in how_sections:
            if section in page_lower:
                section_start = page_lower.find(section)
                section_end = min(section_start + 1500, len(page_lower))
                section_text = page_source[section_start:section_end]
                
                how_to_take = self.find_how_to_take_in_text(section_text)
                if how_to_take != "Not found":
                    return how_to_take
        
        return self.find_how_to_take_in_text(page_source)
    
    def find_how_to_take_in_text(self, text):
        how_patterns = [
            r'(?:take|use)\s+(?:with|without)\s+(?:food|meals)',
            r'(?:take|use)\s+(?:on\s+)?(?:empty|full)\s+(?:stomach)',
            r'(?:with|without)\s+(?:food|meals)',
            r'(?:on\s+)?(?:empty|full)\s+(?:stomach)',
            r'(?:take|use)\s+(?:with|without)\s+(?:water)',
            r'(?:with|without)\s+(?:water)',
            r'(?:with\s+)?(?:a\s+)?(?:full\s+)?(?:glass\s+of\s+water)',
            r'swallow\s+(?:the\s+)?(?:tablet|capsule)\s+(?:whole|with\s+water)',
            r'swallow\s+(?:whole|with\s+water|with\s+food)',
            r'(?:take|use)\s+(?:orally|by\s+mouth)',
            r'(?:oral|injection|inhalation|topical)\s+(?:administration|use)',
            r'how\s+to\s+(?:take|use):\s*([^,\n]+)',
            r'instructions:\s*([^,\n]+)',
            r'directions:\s*([^,\n]+)'
        ]
        
        for pattern in how_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                for match in matches:
                    if isinstance(match, tuple):
                        match = match[0]
                    cleaned = self.clean_text(match)
                    if cleaned and len(cleaned) > 5:
                        return self.simplify_how_to_take(cleaned)
        
        if 'oral' in text.lower() or 'tablet' in text.lower() or 'capsule' in text.lower() or 'pill' in text.lower():
            return 'Oral'
        elif 'inhalation' in text.lower() or 'inhaler' in text.lower():
            return 'Inhalation'
        elif 'topical' in text.lower():
            return 'Topical'
        elif 'injection' in text.lower():
            injection_context = re.search(r'(?:take|use|administer|given)\s+(?:by\s+)?injection', text.lower())
            if injection_context:
                return 'Injection'
            else:
                return 'Oral'
        
        return "Not found"
    
    def simplify_how_to_take(self, text):
        text = text.lower().strip()
        
        mappings = {
            'with food': 'With food',
            'with meals': 'With food',
            'without food': 'Without food',
            'on empty stomach': 'On empty stomach',
            'with water': 'With water',
            'without water': 'Without water',
            'swallow whole': 'Swallow whole',
            'orally': 'Oral',
            'by mouth': 'Oral',
            'injection': 'Injection',
            'inhalation': 'Inhalation',
            'topical': 'Topical',
            'subcutaneous': 'Subcutaneous injection',
            'intramuscular': 'Intramuscular injection',
            'intravenous': 'Intravenous solution'
        }
        
        for key, value in mappings.items():
            if key in text:
                return value
        
        return text.capitalize()
    
    def extract_when_to_take(self, page_source):
        when_sections = [
            'when to take',
            'dosage',
            'administration',
            'instructions',
            'schedule',
            'timing'
        ]
        
        page_lower = page_source.lower()
        
        for section in when_sections:
            if section in page_lower:
                section_start = page_lower.find(section)
                section_end = min(section_start + 1500, len(page_lower))
                section_text = page_source[section_start:section_end]
                
                when_to_take = self.find_when_to_take_in_text(section_text)
                if when_to_take != "Not found":
                    return when_to_take
        
        return self.find_when_to_take_in_text(page_source)
    
    def find_when_to_take_in_text(self, text):
        when_patterns = [
            r'(?:take|use)\s+(?:every\s+)?(\d+\s+(?:hours?|days?|weeks?))',
            r'(?:take|use)\s+(?:once|twice|three\s+times|four\s+times)\s+(?:daily|per\s+day)',
            r'(?:take|use)\s+(\d+)\s+times?\s+(?:daily|per\s+day)',
            r'(?:take|use)\s+(?:in\s+)?(?:the\s+)?(?:morning|afternoon|evening|night|bedtime)',
            r'(?:take|use)\s+(?:with\s+)?(?:breakfast|lunch|dinner)',
            r'(?:take|use)\s+(?:before\s+)?(?:bed|sleep)',
            r'(?:take|use)\s+(?:as\s+)?(?:needed|required)',
            r'(?:take|use)\s+(?:when\s+)?(?:needed)',
            r'(?:take|use)\s+(?:at\s+)?(?:(\d{1,2}):(\d{2})\s*(?:AM|PM|am|pm)?)',
            r'(?:take|use)\s+(?:at\s+)?(?:(\d{1,2})\s*(?:AM|PM|am|pm))',
            r'(?:morning|afternoon|evening|night|bedtime)',
            r'(?:daily|regularly)',
            r'(?:every\s+\d+\s+(?:hours?|days?|weeks?))',
            r'(?:once|twice|three\s+times|four\s+times)\s+(?:daily|per\s+day)'
        ]
        
        for pattern in when_patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            if matches:
                for match in matches:
                    if isinstance(match, tuple):
                        match = match[0]
                    cleaned = self.clean_text(match)
                    if cleaned and len(cleaned) > 3:
                        return self.standardize_when_to_take(cleaned)
        
        return "Not found"
    
    def standardize_when_to_take(self, when_to_take):
        if not when_to_take or when_to_take == "Not found":
            return "Not found"
        
        text = when_to_take.lower().strip()
        
        mappings = {
            'morning': 'Morning',
            'afternoon': 'Afternoon', 
            'evening': 'Evening',
            'night': 'Night',
            'bedtime': 'Bedtime',
            'bed': 'Bedtime',
            'breakfast': 'With breakfast',
            'lunch': 'With lunch',
            'dinner': 'With dinner',
            'food': 'With food',
            'meals': 'With meals',
            'empty stomach': 'On empty stomach',
            'as needed': 'As needed',
            'when needed': 'As needed',
            'daily': 'Daily',
            'regularly': 'Regularly'
        }
        
        for key, value in mappings.items():
            if key in text:
                return value
        
        frequency_patterns = [
            (r'every (\d+) hours?', r'Every \1 hours'),
            (r'every (\d+) days?', r'Every \1 days'),
            (r'every (\d+) weeks?', r'Every \1 weeks'),
            (r'(\d+) times? daily', r'\1 times daily'),
            (r'(\d+) times? per day', r'\1 times daily'),
            (r'once daily', 'Once daily'),
            (r'twice daily', 'Twice daily'),
            (r'three times daily', 'Three times daily'),
            (r'four times daily', 'Four times daily'),
            (r'once a day', 'Once daily'),
            (r'twice a day', 'Twice daily'),
            (r'three times a day', 'Three times daily'),
            (r'four times a day', 'Four times daily'),
            (r'(\d+) times a day', r'\1 times daily'),
            (r'(\d+) times per day', r'\1 times daily')
        ]
        
        for pattern, replacement in frequency_patterns:
            if re.search(pattern, text):
                return re.sub(pattern, replacement, text, flags=re.IGNORECASE)
        
        return when_to_take.strip().capitalize()
    
    def clean_text(self, text):
        if not text:
            return ""
        
        text = re.sub(r'<[^>]+>', '', text)
        text = re.sub(r'&quot;', '', text)
        text = re.sub(r'&amp;', '&', text)
        text = re.sub(r'&lt;', '<', text)
        text = re.sub(r'&gt;', '>', text)
        text = re.sub(r'&nbsp;', ' ', text)
        text = re.sub(r'window\.\w+', '', text)
        text = re.sub(r'get\s*\(\s*\)', '', text)
        text = re.sub(r'function\s*\([^)]*\)', '', text)
        text = re.sub(r'var\s+\w+', '', text)
        text = re.sub(r'console\.\w+', '', text)
        text = re.sub(r'&quot;get&quot;', '', text)
        text = re.sub(r'get\s*\(\s*\)', '', text)
        text = re.sub(r'window\.sup_platform', '', text)
        text = re.sub(r'\s+', ' ', text)
        text = text.strip()
        
        if len(text) < 3 or text.lower() in ['get', 'window', 'function', 'var']:
            return ""
        
        return text
    
    def clean_and_format_data(self, data):
        cleaned_data = {}
        
        for medication, info in data.items():
            brand_name = info['brand_name']
            if brand_name != "Not found":
                brand_name = re.sub(r'\([^)]*\)', '', brand_name)
                brand_name = brand_name.split(',')[0].strip()
                brand_name = brand_name.capitalize()
                if len(brand_name) > 50:
                    brand_name = brand_name[:50]
                if any(generic in brand_name.lower() for generic in ['generic', 'tablet', 'pill', 'capsule', 'liquid', 'injection', 'oral', 'pain']):
                    brand_name = "Generic"
            
            dosage = info['dosage']
            if dosage != "Not found" and dosage:
                dosage = re.sub(r'(side effects|drugs|guide|form:|forms:|drug information)', '', dosage, flags=re.IGNORECASE)
                dosage = dosage.strip()
                if dosage and len(dosage) > 3:
                    dosage = re.sub(r'\s+', ' ', dosage)
                    if ';' in dosage:
                        parts = dosage.split(';')
                        unique_parts = list(dict.fromkeys([part.strip() for part in parts]))
                        dosage = '; '.join(unique_parts)
                    dosage = re.sub(r'(\b\w+\b)(?:\s*[;,]\s*\1)+', r'\1', dosage)
                    dosage = re.sub(r'(\b\w+\b)(?:\s+\1)+', r'\1', dosage)
                else:
                    dosage = "Not found"
            
            how_to_take = info['how_to_take']
            if how_to_take != "Not found" and how_to_take:
                how_to_take = self.simplify_instructions(how_to_take)
                if how_to_take and how_to_take != "Not found":
                    how_to_take = how_to_take.capitalize()
                else:
                    how_to_take = "Not found"
            
            when_to_take = info['when_to_take']
            if when_to_take != "Not found" and when_to_take:
                when_to_take = re.sub(r'\s+', ' ', when_to_take.strip())
                when_to_take = self.standardize_when_to_take(when_to_take)
            else:
                when_to_take = "Not found"
            
            cleaned_data[medication] = {
                'brand_name': brand_name,
                'dosage': dosage,
                'how_to_take': how_to_take,
                'when_to_take': when_to_take
            }
        
        return cleaned_data
    

    
    def simplify_instructions(self, text):
        if not text or text == "Not found":
            return "Not found"
        
        text = text.lower().strip()
        
        mappings = {
            'with food': 'With food',
            'with meals': 'With food',
            'without food': 'Without food',
            'on empty stomach': 'On empty stomach',
            'with water': 'With water',
            'with plenty of water': 'With water',
            'without water': 'Without water',
            'orally': 'Oral',
            'by mouth': 'Oral',
            'swallow whole': 'Swallow whole',
            'with a full glass of water': 'With water',
            'take with food': 'With food',
            'take without food': 'Without food',
            'take on empty stomach': 'On empty stomach',
            'take by mouth': 'Oral',
            'take orally': 'Oral',
            'before meals': 'Before meals',
            'after meals': 'After meals',
            'swallow the tablet': 'Swallow whole',
            'swallow the capsule': 'Swallow whole',
            'take with a full glass of water': 'With water',
            'take with plenty of water': 'With water',
            'with food or water': 'With food',
            'take with food or water': 'With food',
            'on full stomach': 'With food',
            'take on full stomach': 'With food',
            'swallow the tablet whole': 'Swallow whole',
            'swallow the capsule whole': 'Swallow whole',
            'take with meals': 'With food',
            'take without meals': 'Without food',
            'take with water': 'With water',
            'take without water': 'Without water',
            'injection': 'Injection',
            'injectable': 'Injection',
            'subcutaneous': 'Injection',
            'intramuscular': 'Injection',
            'intravenous': 'Injection',
            'inhalation': 'Inhalation',
            'inhale': 'Inhalation',
            'inhaler': 'Inhalation',
            'aerosol': 'Inhalation',
            'topical': 'Topical',
            'apply': 'Topical',
            'cream': 'Topical',
            'ointment': 'Topical'
        }
        
        for key, value in mappings.items():
            if key in text:
                return value
        
        if 'with food' in text or 'with meals' in text:
            return 'With food'
        elif 'without food' in text:
            return 'Without food'
        elif 'with water' in text:
            return 'With water'
        elif 'without water' in text:
            return 'Without water'
        elif 'empty stomach' in text:
            return 'On empty stomach'
        elif 'orally' in text or 'by mouth' in text:
            return 'Oral'
        elif 'swallow' in text:
            return 'Swallow whole'
        elif 'injection' in text or 'injectable' in text:
            return 'Injection'
        elif 'inhalation' in text or 'inhale' in text or 'inhaler' in text:
            return 'Inhalation'
        elif 'topical' in text or 'apply' in text:
            return 'Topical'
        
        valid_instruction_keywords = [
            'with', 'without', 'food', 'water', 'meal', 'stomach', 'empty', 'full',
            'swallow', 'take', 'before', 'after', 'during', 'whole'
        ]
        
        form_keywords = [
            'oral', 'injection', 'inhalation', 'topical', 'tablet', 'capsule', 'mouth'
        ]
        
        text_lower = text.lower()
        has_valid_keywords = any(keyword in text_lower for keyword in valid_instruction_keywords)
        has_form_keywords = any(keyword in text_lower for keyword in form_keywords)
        
        if has_valid_keywords and not has_form_keywords and len(text) > 5:
            return text.capitalize()
        else:
            return "Not found"
    
    def update_excel(self, new_data, existing_file):
        print("\n📊 UPDATING EXCEL")
        print("=" * 40)
        
        try:
            if existing_file:
                df = pd.read_excel(existing_file)
                
                new_rows = []
                for medication, data in new_data.items():
                    new_rows.append({
                        'Name': medication,
                        'Brand Name': data['brand_name'],
                        'Dosage': data['dosage'],
                        'How to Take': data['how_to_take'],
                        'When to Take': data['when_to_take']
                    })
                
                new_df = pd.DataFrame(new_rows)
                updated_df = pd.concat([df, new_df], ignore_index=True)
                updated_df.to_excel(existing_file, index=False)
                
                print(f"✅ Excel updated: {existing_file}")
                print(f"📊 New medications added: {len(new_data)}")
                print(f"📊 Total medications in file: {len(updated_df)}")
                
                return existing_file
            else:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                new_filename = f"medication_data_{timestamp}.xlsx"
                
                new_rows = []
                for medication, data in new_data.items():
                    new_rows.append({
                        'Name': medication,
                        'Brand Name': data['brand_name'],
                        'Dosage': data['dosage'],
                        'How to Take': data['how_to_take'],
                        'When to Take': data['when_to_take']
                    })
                
                new_df = pd.DataFrame(new_rows)
                new_df.to_excel(new_filename, index=False)
                
                print(f"✅ New Excel created: {new_filename}")
                print(f"📊 Medications added: {len(new_data)}")
                
                return new_filename
            
        except Exception as e:
            print(f"❌ Error updating Excel: {e}")
            return None
    
    def update_how_to_take_only(self, cache, existing_file):
        print("🔧 UPDATING HOW TO TAKE COLUMN")
        print("=" * 50)
        
        try:
            df = pd.read_excel(existing_file)
            print(f"📊 Total medications: {len(df)}")
            
            print("\n📈 CURRENT HOW TO TAKE STATISTICS:")
            how_to_take_counts = df['How to Take'].value_counts()
            print(how_to_take_counts.head(10))
            
            print("\n🔧 IMPROVING HOW TO TAKE COLUMN...")
            improved_count = 0
            
            for index, row in df.iterrows():
                medication = row['Name']
                if medication in cache:
                    original = row['How to Take']
                    improved = self.simplify_instructions(original)
                    
                    if improved != original:
                        print(f"✅ {medication}: '{original}' → '{improved}'")
                        df.at[index, 'How to Take'] = improved
                        improved_count += 1
            
            print(f"\n📊 Improved {improved_count} entries")
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            new_filename = f"medication_data_improved_{timestamp}.xlsx"
            df.to_excel(new_filename, index=False)
            
            print(f"✅ Improved file saved: {new_filename}")
            
            print("\n📈 NEW HOW TO TAKE STATISTICS:")
            new_how_to_take_counts = df['How to Take'].value_counts()
            print(new_how_to_take_counts.head(10))
            
            print("\n🎯 MOST COMMON PATTERNS:")
            patterns = {
                'With food': 0,
                'With water': 0,
                'On empty stomach': 0,
                'Oral': 0,
                'Injection': 0,
                'Inhalation': 0,
                'Topical': 0,
                'Swallow whole': 0,
                'Not found': 0
            }
            
            for value in df['How to Take']:
                if value in patterns:
                    patterns[value] += 1
            
            for pattern, count in patterns.items():
                if count > 0:
                    percentage = (count / len(df)) * 100
                    print(f"  {pattern}: {count} ({percentage:.1f}%)")
                    
        except Exception as e:
            print(f"❌ Error updating How to Take column: {e}")
    
    def run(self):
        print("🚀 STARTING INTELLIGENT SCRAPING")
        print("=" * 50)
        
        try:
            self.existing_data, existing_file = self.load_existing_data()
            original_medications = self.read_original_medications()
            missing_medications = self.identify_missing_medications(original_medications)
            
            if missing_medications:
                print(f"\n🚀 PROCESSING ALL {len(missing_medications)} MEDICATIONS")
                print(f"📊 Total medications to process: {len(missing_medications)}")
            
            cache = self.load_cache()
            
            if not missing_medications and cache:
                print("\n✅ All medications already processed. Updating 'How to Take' column with improved cleaning...")
                self.update_how_to_take_only(cache, existing_file)
                return
            elif not missing_medications:
                print("\n✅ No missing medications. All medications are already in our results.")
                return
            
            cache = self.load_cache()
            self.setup_driver()
            
            scraped_data = {}
            total_missing = len(missing_medications)
            
            print(f"\n📊 Processing {total_missing} missing medications in batches of {self.batch_size}...")
            
            for batch_start in range(0, total_missing, self.batch_size):
                batch_end = min(batch_start + self.batch_size, total_missing)
                batch_medications = missing_medications[batch_start:batch_end]
                
                print(f"\n🔄 BATCH {batch_start//self.batch_size + 1}: Processing medications {batch_start + 1}-{batch_end}")
                print("=" * 60)
                
                for i, medication in enumerate(batch_medications, 1):
                    global_index = batch_start + i
                    print(f"\n📊 Processing {global_index}/{total_missing}: {medication}")
                    
                    if medication in cache:
                        print(f"✅ {medication}: Using cached data")
                        scraped_data[medication] = cache[medication]
                        continue
                    
                    try:
                        result = self.process_medication(medication)
                        if result:
                            scraped_data[medication] = result
                            cache[medication] = result
                            print(f"✅ {medication}: {result['brand_name']} | {result['dosage']} | {result['how_to_take']} | {result['when_to_take']}")
                        else:
                            print(f"❌ {medication}: Could not process")
                    except Exception as e:
                        print(f"❌ Error processing {medication}: {e}")
                        time.sleep(1)
                        if attempt == max_retries - 1:
                            print(f"⚠️ Skipping {medication} after {max_retries} failed attempts")
                            continue
                        else:
                            print(f"🔄 Retrying {medication}... (attempt {attempt + 2}/{max_retries})")
                            time.sleep(2)
                            continue
                
                print(f"\n🔄 Restarting driver after batch {batch_start//self.batch_size + 1}...")
                
                try:
                    self.restart_driver()
                except Exception as e:
                    print(f"⚠️ Error restarting driver: {e}")
                    print("🔄 Attempting automatic restart...")
                    try:
                        if self.driver:
                            self.driver.quit()
                    except:
                        pass
                    time.sleep(3)
                    try:
                        self.setup_driver()
                    except Exception as e2:
                        print(f"❌ Critical error setting up driver: {e2}")
                        print("🔄 Trying one more time...")
                        time.sleep(5)
                        try:
                            self.setup_driver()
                        except Exception as e3:
                            print(f"❌ Final error setting up driver: {e3}")
                            print("🛑 Stopping script due to driver issues")
                            break
                
                if scraped_data:
                    cleaned_data = self.clean_and_format_data(scraped_data)
                    self.save_cache(cache)
                    print(f"💾 Progress saved after batch {batch_start//self.batch_size + 1}")
                
                print("🤖 Batch completed. Continuing automatically...")
                time.sleep(1)
            
            if self.driver:
                self.driver.quit()
            
            if scraped_data:
                cleaned_data = self.clean_and_format_data(scraped_data)
                self.save_cache(cache)
                updated_file = self.update_excel(cleaned_data, existing_file)
                
                print(f"\n🎉 SCRAPING COMPLETED!")
                print(f"📁 File updated: {updated_file}")
                print(f"📊 Medications processed: {len(scraped_data)}")
                
                when_to_take_found = sum(1 for data in cleaned_data.values() if data['when_to_take'] != 'Not found')
                print(f"📈 When to Take found: {when_to_take_found} ({when_to_take_found/len(cleaned_data)*100:.1f}%)")
            else:
                print("\n❌ No new medications processed")
            
        except Exception as e:
            print(f"❌ Error in scraping: {e}")
            if self.driver:
                self.driver.quit()

def main():
    scraper = MedicationScraper()
    scraper.run()

if __name__ == "__main__":
    main() 