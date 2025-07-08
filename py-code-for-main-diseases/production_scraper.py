#!/usr/bin/env python3
"""
Production Scraper for Side Effects
Scrapes side effects for all unique medications from main_diseases_analysis_final.xlsx using Drugs.com
"""

import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException, WebDriverException
import time
import logging
import sys
import os

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('scraper.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

class DrugsSideEffectsScraper:
    def __init__(self, excel_path, headless=True):
        self.excel_path = excel_path
        self.headless = headless
        self.driver = None
        self.wait = None
        self.processed_count = 0
        self.success_count = 0
        self.failed_medications = []
        
    def setup_driver(self):
        """Initialize Chrome driver with options"""
        chrome_options = Options()
        if self.headless:
            chrome_options.add_argument('--headless')
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        chrome_options.add_argument('--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36')
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            self.wait = WebDriverWait(self.driver, 10)
            logging.info("Chrome driver initialized successfully")
        except Exception as e:
            logging.error(f"Failed to initialize Chrome driver: {e}")
            raise
    
    def close_driver(self):
        """Close the Chrome driver"""
        if self.driver:
            self.driver.quit()
            logging.info("Chrome driver closed")
    
    def load_medications(self):
        """Load unique medications from Excel file"""
        try:
            # Read the "All Unique Medications" sheet
            df = pd.read_excel(self.excel_path, sheet_name="All Unique Medications")
            medications = df['Medication'].dropna().unique().tolist()
            logging.info(f"Loaded {len(medications)} unique medications")
            return medications
        except Exception as e:
            logging.error(f"Error loading medications: {e}")
            return []
    
    def search_medication(self, medication):
        """Search for a medication on Drugs.com"""
        try:
            # Navigate to Drugs.com
            self.driver.get("https://www.drugs.com")
            time.sleep(2)
            
            # Find and interact with search box
            search_box = self.wait.until(
                EC.presence_of_element_located((By.NAME, "q"))
            )
            search_box.clear()
            search_box.send_keys(medication)
            
            # Click search button
            search_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit']")
            search_button.click()
            
            time.sleep(3)
            return True
            
        except Exception as e:
            logging.error(f"Error searching for {medication}: {e}")
            return False
    
    def click_main_result(self, medication):
        """Click on the main search result"""
        try:
            # Try multiple selectors for search results
            result_selectors = [
                "a.ddc-media-object",
                ".ddc-search-results a",
                "h3 a",
                ".search-results a",
                "a[href*='/drugs/']"
            ]
            
            main_result = None
            for selector in result_selectors:
                try:
                    results = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if results:
                        # Filter for drug-related results
                        for result in results:
                            href = result.get_attribute('href')
                            if href and '/drugs/' in href and '/professional/' not in href:
                                main_result = result
                                break
                        if main_result:
                            break
                except:
                    continue
            
            if main_result:
                self.driver.execute_script("arguments[0].click();", main_result)
                time.sleep(3)
                logging.info(f"Clicked main result for {medication}")
                return True
            else:
                logging.warning(f"No main result found for {medication}")
                return False
                
        except Exception as e:
            logging.error(f"Error clicking main result for {medication}: {e}")
            return False
    
    def navigate_to_side_effects(self, medication):
        """Navigate to the side effects tab"""
        try:
            # Try to find and click the side effects tab
            side_effects_selectors = [
                "a[href*='side-effects']",
                "a[data-more='side-effects']",
                "a:contains('Side Effects')",
                ".ddc-tabs a[href*='side-effects']",
                "nav a[href*='side-effects']"
            ]
            
            side_effects_tab = None
            for selector in side_effects_selectors:
                try:
                    if ':contains(' in selector:
                        # Use XPath for text-based selection
                        xpath = f"//a[contains(text(), 'Side Effects')]"
                        elements = self.driver.find_elements(By.XPATH, xpath)
                        if elements:
                            side_effects_tab = elements[0]
                            break
                    else:
                        elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                        if elements:
                            side_effects_tab = elements[0]
                            break
                except:
                    continue
            
            if side_effects_tab:
                self.driver.execute_script("arguments[0].click();", side_effects_tab)
                time.sleep(3)
                logging.info(f"Navigated to side effects tab for {medication}")
                return True
            else:
                logging.warning(f"No side effects tab found for {medication}")
                return False
                
        except Exception as e:
            logging.error(f"Error navigating to side effects for {medication}: {e}")
            return False
    
    def extract_side_effects(self, medication):
        """Extract side effects content from the page"""
        try:
            # Wait for page to load
            time.sleep(2)
            
            # Try different selectors for side effects content
            content_selectors = [
                ".ddc-content",
                ".drug-content",
                ".content",
                "main",
                "#content",
                ".page-content"
            ]
            
            side_effects_text = ""
            for selector in content_selectors:
                try:
                    elements = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    if elements:
                        side_effects_text = elements[0].text
                        break
                except:
                    continue
            
            if not side_effects_text:
                # Fallback to body text
                side_effects_text = self.driver.find_element(By.TAG_NAME, "body").text
            
            # Clean up the text
            side_effects_text = side_effects_text.strip()
            
            if side_effects_text:
                logging.info(f"Extracted side effects for {medication} (length: {len(side_effects_text)})")
                return side_effects_text
            else:
                logging.warning(f"No side effects content found for {medication}")
                return "No side effects information found"
                
        except Exception as e:
            logging.error(f"Error extracting side effects for {medication}: {e}")
            return f"Error extracting side effects: {str(e)}"
    
    def save_to_excel(self, medication, side_effects):
        """Save side effects to Excel file"""
        try:
            # Load existing data
            with pd.ExcelWriter(self.excel_path, engine='openpyxl', mode='a', if_sheet_exists='overlay') as writer:
                # Read existing sheet
                df = pd.read_excel(self.excel_path, sheet_name="All Unique Medications")
                
                # Update the side effects column
                df.loc[df['Medication'] == medication, 'Side Effects'] = side_effects
                
                # Write back to sheet
                df.to_excel(writer, sheet_name="All Unique Medications", index=False)
                
            logging.info(f"Saved side effects for {medication} to Excel")
            return True
            
        except Exception as e:
            logging.error(f"Error saving to Excel for {medication}: {e}")
            return False
    
    def scrape_medication(self, medication, retry_count=0):
        """Scrape side effects for a single medication"""
        max_retries = 3
        
        try:
            logging.info(f"Processing {medication} (attempt {retry_count + 1})")
            
            # Step 1: Search for medication
            if not self.search_medication(medication):
                raise Exception("Failed to search medication")
            
            # Step 2: Click main result
            if not self.click_main_result(medication):
                raise Exception("Failed to click main result")
            
            # Step 3: Navigate to side effects
            if not self.navigate_to_side_effects(medication):
                raise Exception("Failed to navigate to side effects")
            
            # Step 4: Extract side effects
            side_effects = self.extract_side_effects(medication)
            
            # Step 5: Save to Excel
            if self.save_to_excel(medication, side_effects):
                self.success_count += 1
                logging.info(f"Successfully processed {medication}")
                return True
            else:
                raise Exception("Failed to save to Excel")
                
        except Exception as e:
            if retry_count < max_retries:
                logging.warning(f"Retrying {medication} due to error: {e}")
                time.sleep(5)  # Wait before retry
                return self.scrape_medication(medication, retry_count + 1)
            else:
                logging.error(f"Failed to process {medication} after {max_retries + 1} attempts: {e}")
                self.failed_medications.append(medication)
                return False
    
    def run_scraper(self):
        """Main scraper execution"""
        try:
            logging.info("Starting side effects scraper...")
            
            # Load medications
            medications = self.load_medications()
            if not medications:
                logging.error("No medications loaded. Exiting.")
                return
            
            # Setup driver
            self.setup_driver()
            
            # Process each medication
            total_medications = len(medications)
            
            for i, medication in enumerate(medications, 1):
                logging.info(f"Processing medication {i}/{total_medications}: {medication}")
                
                self.scrape_medication(medication)
                self.processed_count += 1
                
                # Add delay between requests
                time.sleep(2)
                
                # Save progress every 10 medications
                if i % 10 == 0:
                    logging.info(f"Progress: {i}/{total_medications} medications processed")
                
                # Break for testing (remove this line for full run)
                # if i >= 5:
                #     break
            
            # Final summary
            logging.info(f"Scraping completed!")
            logging.info(f"Total processed: {self.processed_count}")
            logging.info(f"Successful: {self.success_count}")
            logging.info(f"Failed: {len(self.failed_medications)}")
            
            if self.failed_medications:
                logging.info(f"Failed medications: {', '.join(self.failed_medications)}")
                
        except Exception as e:
            logging.error(f"Error in main scraper execution: {e}")
            
        finally:
            self.close_driver()


def main():
    """Main function"""
    excel_path = "/Users/juanlu/Documents/Wye/scrapper/Analysis/main_diseases_analysis_final.xlsx"
    
    # Check if file exists
    if not os.path.exists(excel_path):
        logging.error(f"Excel file not found: {excel_path}")
        return
    
    # Create scraper instance and run
    scraper = DrugsSideEffectsScraper(excel_path, headless=True)
    scraper.run_scraper()


if __name__ == "__main__":
    main()
