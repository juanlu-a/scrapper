import pandas as pd
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from webdriver_manager.chrome import ChromeDriverManager
import time
import random
import re
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import os

class DrugsSfxSeleniumScraper:
    def __init__(self):
        self.base_url = "https://www.drugs.com"
        self.sfx_url = "https://www.drugs.com/sfx/"
        self.driver = None
        self.setup_driver()
    
    def setup_driver(self):
        """Setup Chrome driver with appropriate options"""
        try:
            chrome_options = Options()
            
            # Add arguments to make it less detectable
            chrome_options.add_argument("--no-sandbox")
            chrome_options.add_argument("--disable-dev-shm-usage")
            chrome_options.add_argument("--disable-blink-features=AutomationControlled")
            chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
            chrome_options.add_experimental_option('useAutomationExtension', False)
            chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            
            # For debugging, comment out the next line to see the browser
            # chrome_options.add_argument("--headless")
            
            # Setup driver
            service = Service(ChromeDriverManager().install())
            self.driver = webdriver.Chrome(service=service, options=chrome_options)
            
            # Execute script to remove webdriver property
            self.driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
            
            print("✓ Chrome driver initialized successfully")
            
        except Exception as e:
            print(f"✗ Error setting up Chrome driver: {str(e)}")
            raise
    
    def search_side_effects(self, medication_name):
        """Search for side effects using Selenium"""
        try:
            print(f"🔍 Searching side effects for: {medication_name}")
            
            # Method 1: Try direct SFX URL
            direct_url = f"{self.sfx_url}{medication_name.lower().replace(' ', '-')}.html"
            print(f"  Trying direct SFX URL: {direct_url}")
            
            self.driver.get(direct_url)
            time.sleep(random.uniform(2, 4))
            
            # Check if page loaded successfully
            if "404" not in self.driver.title.lower() and "not found" not in self.driver.page_source.lower():
                print(f"  ✓ Direct SFX page loaded successfully")
                return self.extract_side_effects_content(medication_name, direct_url)
            
            # Method 2: Use SFX search
            print(f"  Direct SFX failed, trying search...")
            return self.search_via_sfx_form(medication_name)
            
        except Exception as e:
            print(f"  ✗ Error searching {medication_name}: {str(e)}")
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error searching {medication_name}: {str(e)}',
                'source_url': 'N/A'
            }
    
    def search_via_sfx_form(self, medication_name):
        """Search using the SFX search form"""
        try:
            print(f"  Using SFX search form for {medication_name}")
            
            # Navigate to SFX page
            self.driver.get(self.sfx_url)
            time.sleep(random.uniform(2, 4))
            
            # Check if page loaded
            if "403" in self.driver.page_source or "Forbidden" in self.driver.page_source:
                print(f"  ✗ SFX page blocked (403)")
                return self.try_regular_drug_page(medication_name)
            
            # Look for search input
            try:
                search_input = WebDriverWait(self.driver, 10).until(
                    EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='text'], input[name*='search'], input[placeholder*='drug']"))
                )
                
                # Clear and type medication name
                search_input.clear()
                search_input.send_keys(medication_name)
                
                # Look for search button
                search_button = self.driver.find_element(By.CSS_SELECTOR, "button[type='submit'], input[type='submit'], .search-button")
                search_button.click()
                
                # Wait for results
                time.sleep(random.uniform(3, 5))
                
                print(f"  ✓ Search submitted successfully")
                return self.extract_side_effects_content(medication_name, self.driver.current_url)
                
            except (TimeoutException, NoSuchElementException):
                print(f"  ✗ Could not find search form")
                return self.try_regular_drug_page(medication_name)
            
        except Exception as e:
            print(f"  ✗ Error with SFX form: {str(e)}")
            return self.try_regular_drug_page(medication_name)
    
    def try_regular_drug_page(self, medication_name):
        """Try to access regular drug page as fallback"""
        try:
            print(f"  Trying regular drug page for {medication_name}")
            
            # Clean medication name
            clean_name = medication_name.lower().replace(' ', '-')
            
            # Try different URL patterns
            url_patterns = [
                f"{self.base_url}/{clean_name}.html",
                f"{self.base_url}/mtm/{clean_name}.html",
                f"{self.base_url}/otc/{clean_name}.html"
            ]
            
            for url in url_patterns:
                try:
                    print(f"    Trying: {url}")
                    self.driver.get(url)
                    time.sleep(random.uniform(2, 4))
                    
                    # Check if page loaded successfully
                    if ("404" not in self.driver.title.lower() and 
                        "not found" not in self.driver.page_source.lower() and
                        "403" not in self.driver.page_source and
                        len(self.driver.page_source) > 1000):
                        
                        print(f"    ✓ Regular page loaded: {url}")
                        return self.extract_side_effects_content(medication_name, url)
                        
                except Exception as e:
                    continue
            
            print(f"  ✗ All regular page attempts failed")
            return {
                'medication': medication_name,
                'status': 'Not Found',
                'full_information': f'No accessible page found for {medication_name}',
                'source_url': 'N/A'
            }
            
        except Exception as e:
            print(f"  ✗ Error with regular page: {str(e)}")
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error accessing regular page for {medication_name}: {str(e)}',
                'source_url': 'N/A'
            }
    
    def extract_side_effects_content(self, medication_name, source_url):
        """Extract side effects content from current page"""
        try:
            print(f"  Extracting content from current page...")
            
            content_parts = []
            content_parts.append(f"=== {medication_name} Side Effects Information ===\n")
            content_parts.append(f"Source: {source_url}\n")
            
            # Method 1: Look for side effects headings
            side_effects_found = False
            
            try:
                # Find headings containing "side effects"
                headings = self.driver.find_elements(By.XPATH, "//h1[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'side effect')] | //h2[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'side effect')] | //h3[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'side effect')]")
                
                for heading in headings:
                    side_effects_found = True
                    content_parts.append(f"\n--- {heading.text} ---\n")
                    
                    # Get following content
                    following_elements = self.driver.execute_script("""
                        var heading = arguments[0];
                        var elements = [];
                        var current = heading.nextElementSibling;
                        while (current && !current.matches('h1, h2, h3, h4')) {
                            if (current.matches('p, ul, ol, div')) {
                                elements.push(current);
                            }
                            current = current.nextElementSibling;
                        }
                        return elements;
                    """, heading)
                    
                    for element in following_elements:
                        text = element.text.strip()
                        if text and len(text) > 10:
                            if element.tag_name == 'ul' or element.tag_name == 'ol':
                                # Handle lists
                                list_items = element.find_elements(By.TAG_NAME, "li")
                                for li in list_items:
                                    content_parts.append(f"• {li.text.strip()}")
                            else:
                                content_parts.append(text)
                            content_parts.append("")
                            
            except Exception as e:
                print(f"    Error finding headings: {str(e)}")
            
            # Method 2: Look for any text containing side effects
            if not side_effects_found:
                print(f"    No side effects headings found, looking for general content...")
                
                try:
                    # Find paragraphs containing side effects keywords
                    paragraphs = self.driver.find_elements(By.XPATH, "//p[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'side effect') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'adverse') or contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'reaction')]")
                    
                    for para in paragraphs:
                        text = para.text.strip()
                        if text and len(text) > 20:
                            content_parts.append(text)
                            content_parts.append("")
                            
                except Exception as e:
                    print(f"    Error finding paragraphs: {str(e)}")
            
            # Method 3: If still nothing, get general page content
            if len(content_parts) < 5:
                print(f"    Limited specific content found, extracting general page content...")
                
                try:
                    # Get main content area
                    main_content = None
                    selectors = ['main', '.main-content', '#content', '.content', 'article']
                    
                    for selector in selectors:
                        try:
                            main_content = self.driver.find_element(By.CSS_SELECTOR, selector)
                            break
                        except:
                            continue
                    
                    if main_content:
                        # Extract text from main content
                        text_content = main_content.text
                        if text_content and len(text_content) > 100:
                            # Split into paragraphs and filter
                            paragraphs = text_content.split('\n\n')
                            for para in paragraphs:
                                para = para.strip()
                                if para and len(para) > 20:
                                    content_parts.append(para)
                                    content_parts.append("")
                                    
                except Exception as e:
                    print(f"    Error extracting general content: {str(e)}")
            
            # Final result
            if len(content_parts) > 3:
                result_text = '\n'.join(content_parts)
                print(f"  ✓ Extracted {len(result_text)} characters of content")
                
                return {
                    'medication': medication_name,
                    'status': 'Success',
                    'full_information': result_text,
                    'source_url': source_url
                }
            else:
                return {
                    'medication': medication_name,
                    'status': 'Limited Info',
                    'full_information': f'Limited information found for {medication_name}. Page may be blocked or have different structure.',
                    'source_url': source_url
                }
                
        except Exception as e:
            print(f"  ✗ Error extracting content: {str(e)}")
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error extracting content for {medication_name}: {str(e)}',
                'source_url': source_url
            }
    
    def close(self):
        """Close the browser"""
        if self.driver:
            self.driver.quit()
            print("✓ Browser closed")

def test_selenium_scraper():
    """Test the Selenium scraper"""
    
    scraper = DrugsSfxSeleniumScraper()
    
    try:
        # Test with a few medications
        test_medications = ["ibuprofen", "acetaminophen", "aspirin"]
        results = []
        
        for med in test_medications:
            print(f"\n{'='*60}")
            result = scraper.search_side_effects(med)
            results.append(result)
            
            print(f"Status: {result['status']}")
            print(f"Source: {result['source_url']}")
            print(f"Content length: {len(result['full_information'])}")
            print(f"Preview: {result['full_information'][:200]}...")
            
            # Add delay between searches
            time.sleep(random.uniform(3, 6))
        
        # Summary
        print(f"\n{'='*60}")
        print("SUMMARY:")
        successful = sum(1 for r in results if r['status'] == 'Success')
        print(f"Successful: {successful}/{len(results)}")
        
        if successful > 0:
            print("✅ Selenium scraper is working!")
            return True
        else:
            print("❌ Selenium scraper not working")
            return False
            
    finally:
        scraper.close()

if __name__ == "__main__":
    print("Testing Drugs.com Selenium Scraper...")
    print("=" * 60)
    
    test_selenium_scraper()
