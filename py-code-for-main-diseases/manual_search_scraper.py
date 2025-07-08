import pandas as pd
import requests
from bs4 import BeautifulSoup
import time
import random
from urllib.parse import urljoin, quote
import re
from openpyxl import load_workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
import os
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.keys import Keys
import json

class DrugsComSearchScraper:
    def __init__(self, headless=True):
        self.base_url = "https://www.drugs.com"
        self.sfx_url = "https://www.drugs.com/sfx/"
        self.setup_driver(headless)
        
    def setup_driver(self, headless=True):
        """Set up Chrome driver with options"""
        chrome_options = Options()
        if headless:
            chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        chrome_options.add_argument("--disable-gpu")
        chrome_options.add_argument("--window-size=1920,1080")
        chrome_options.add_argument("--user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        
        try:
            self.driver = webdriver.Chrome(options=chrome_options)
            self.driver.implicitly_wait(10)
        except Exception as e:
            print(f"Error setting up Chrome driver: {e}")
            print("Make sure ChromeDriver is installed and in your PATH")
            raise
    
    def search_medication_manually(self, medication_name):
        """Search for medication using the search functionality"""
        try:
            print(f"  🔍 Searching for: {medication_name}")
            
            # Go to main drugs.com page
            self.driver.get(self.base_url)
            time.sleep(random.uniform(2, 4))
            
            # Find the search box
            search_box = WebDriverWait(self.driver, 10).until(
                EC.presence_of_element_located((By.CSS_SELECTOR, "input[type='search'], input[name='searchterm'], input[placeholder*='search'], #livesearch"))
            )
            
            # Clear and enter medication name
            search_box.clear()
            search_box.send_keys(medication_name)
            time.sleep(random.uniform(1, 2))
            
            # Submit search
            search_box.send_keys(Keys.RETURN)
            time.sleep(random.uniform(3, 5))
            
            # Look for drug results and click on the main medication link
            current_url = self.driver.current_url
            print(f"  📄 Search results URL: {current_url}")
            
            # Try to find and click on the first drug result
            drug_url = self.find_first_drug_result(medication_name)
            
            if drug_url:
                print(f"  ✅ Successfully navigated to drug page: {drug_url}")
                return drug_url
            else:
                print(f"  ❌ No drug page found for {medication_name}")
                return None
                
        except Exception as e:
            print(f"  ❌ Error searching for {medication_name}: {str(e)}")
            return None
    
    def find_first_drug_result(self, medication_name):
        """Find the first relevant drug result from search results"""
        try:
            # Wait for search results to load
            time.sleep(3)
            
            print(f"  🔍 Looking for medication link for: {medication_name}")
            
            # Look for the main medication link (like "Ibuprofen" in the search results)
            # Try to find links that match the medication name exactly or closely
            
            # First, try to find links with the exact medication name
            links = self.driver.find_elements(By.TAG_NAME, "a")
            
            for link in links:
                try:
                    href = link.get_attribute('href')
                    link_text = link.text.strip()
                    
                    # Skip if no href or text
                    if not href or not link_text:
                        continue
                    
                    # Check if this looks like the main medication page
                    if (href and 
                        '.html' in href and 
                        'search' not in href and 
                        '/pro/' not in href and
                        'side-effects' not in href and
                        'dosage' not in href and
                        'interactions' not in href):
                        
                        # Check if the link text matches the medication name
                        if (link_text.lower() == medication_name.lower() or
                            (medication_name.lower() in link_text.lower() and len(link_text) < 50)):
                            
                            print(f"  ✅ Found main medication link: '{link_text}' -> {href}")
                            
                            # Click on the link instead of just returning the URL
                            self.driver.execute_script("arguments[0].click();", link)
                            time.sleep(random.uniform(3, 5))
                            
                            # Return the current URL after clicking
                            return self.driver.current_url
                            
                except Exception as e:
                    continue
            
            # If exact match not found, try broader search
            print(f"  ⚠️  No exact match found, trying broader search...")
            
            for link in links:
                try:
                    href = link.get_attribute('href')
                    link_text = link.text.strip()
                    
                    if (href and 
                        '.html' in href and 
                        'search' not in href and
                        any(word in link_text.lower() for word in medication_name.lower().split())):
                        
                        print(f"  ✅ Found approximate link: '{link_text}' -> {href}")
                        
                        # Click on the link
                        self.driver.execute_script("arguments[0].click();", link)
                        time.sleep(random.uniform(3, 5))
                        
                        return self.driver.current_url
                        
                except Exception as e:
                    continue
            
            return None
            
        except Exception as e:
            print(f"  ❌ Error finding drug result: {str(e)}")
            return None
    
    def get_side_effects_from_drug_page(self, drug_url):
        """Extract side effects from a drug page"""
        try:
            print(f"  📖 Getting side effects from: {drug_url}")
            
            # We're already on the drug page from the search, so just extract side effects
            side_effects_content = self.extract_side_effects_from_page()
            
            # If no side effects found on main page, try the side effects specific page
            if not side_effects_content or len(side_effects_content) < 100:
                print(f"  🔍 Looking for side effects link on page...")
                
                # Try to find and click on "Side Effects" link
                side_effects_link = self.find_side_effects_link()
                
                if side_effects_link:
                    print(f"  ✅ Found side effects link, clicking...")
                    self.driver.execute_script("arguments[0].click();", side_effects_link)
                    time.sleep(random.uniform(3, 5))
                    
                    # Extract side effects from the dedicated page
                    side_effects_content = self.extract_side_effects_from_page()
                else:
                    print(f"  ⚠️  No side effects link found, using content from main page")
            
            return side_effects_content
            
        except Exception as e:
            print(f"  ❌ Error getting side effects: {str(e)}")
            return f"Error extracting side effects: {str(e)}"
            if not side_effects_content or len(side_effects_content) < 100:
                # Try the side effects specific URL
                if drug_url.endswith('.html'):
                    side_effects_url = drug_url.replace('.html', '-side-effects.html')
                    try:
                        self.driver.get(side_effects_url)
                        time.sleep(random.uniform(3, 5))
                        side_effects_content = self.extract_side_effects_from_page()
                    except:
                        pass
            
            return side_effects_content
            
        except Exception as e:
            print(f"  ❌ Error getting side effects: {str(e)}")
            return None
    
    def extract_side_effects_from_page(self):
        """Extract side effects content from current page"""
        try:
            content_parts = []
            
            # Method 1: Look for side effects headings
            headings = self.driver.find_elements(By.CSS_SELECTOR, "h1, h2, h3, h4")
            for heading in headings:
                heading_text = heading.text.strip().lower()
                if 'side effect' in heading_text:
                    content_parts.append(f"--- {heading.text} ---")
                    
                    # Get content after this heading
                    try:
                        parent = heading.find_element(By.XPATH, "./..")
                        content = parent.text.strip()
                        if content and len(content) > 50:
                            content_parts.append(content)
                    except:
                        pass
            
            # Method 2: Look for side effects content in paragraphs
            paragraphs = self.driver.find_elements(By.CSS_SELECTOR, "p, div, li")
            for p in paragraphs:
                text = p.text.strip()
                if ('side effect' in text.lower() or 
                    'adverse' in text.lower() or 
                    'reaction' in text.lower()) and len(text) > 30:
                    content_parts.append(text)
            
            # Method 3: Look for lists that might contain side effects
            lists = self.driver.find_elements(By.CSS_SELECTOR, "ul, ol")
            for ul in lists:
                list_text = ul.text.strip().lower()
                if ('side effect' in list_text or 
                    'symptom' in list_text or 
                    'reaction' in list_text) and len(list_text) > 50:
                    content_parts.append("--- Side Effects List ---")
                    
                    items = ul.find_elements(By.CSS_SELECTOR, "li")
                    for item in items:
                        item_text = item.text.strip()
                        if item_text and len(item_text) > 5:
                            content_parts.append(f"• {item_text}")
            
            # Join all content
            if content_parts:
                result = '\n'.join(content_parts)
                return result
            else:
                return None
                
        except Exception as e:
            print(f"  ❌ Error extracting side effects content: {str(e)}")
            return None
    
    def scrape_medication_side_effects(self, medication_name):
        """Complete process to scrape side effects for a medication"""
        try:
            # Step 1: Search for the medication
            drug_url = self.search_medication_manually(medication_name)
            if not drug_url:
                return {
                    'medication': medication_name,
                    'status': 'Not Found',
                    'full_information': f'Could not find {medication_name} on Drugs.com through search',
                    'source_url': None
                }
            
            # Step 2: Extract side effects from the drug page
            side_effects_content = self.get_side_effects_from_drug_page(drug_url)
            
            if side_effects_content:
                return {
                    'medication': medication_name,
                    'status': 'Success',
                    'full_information': f"=== {medication_name} Side Effects Information ===\n\n{side_effects_content}",
                    'source_url': drug_url
                }
            else:
                return {
                    'medication': medication_name,
                    'status': 'Limited',
                    'full_information': f'Found {medication_name} page but limited side effects information available. Please check manually at: {drug_url}',
                    'source_url': drug_url
                }
            
        except Exception as e:
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error processing {medication_name}: {str(e)}',
                'source_url': None
            }
    
    def close(self):
        """Close the browser driver"""
        if hasattr(self, 'driver'):
            self.driver.quit()

    def find_side_effects_link(self):
        """Find the side effects link on the medication page"""
        try:
            # Look for side effects links with different selectors
            selectors = [
                "a[href*='side-effects']",
                "a[href*='side_effects']",
                "a[href*='sfx']",
                "a:contains('Side Effects')",
                "a:contains('side effects')"
            ]
            
            for selector in selectors:
                try:
                    if 'contains' in selector:
                        # Use XPath for text-based search
                        links = self.driver.find_elements(By.XPATH, f"//a[contains(text(), 'Side Effects') or contains(text(), 'side effects')]")
                    else:
                        links = self.driver.find_elements(By.CSS_SELECTOR, selector)
                    
                    for link in links:
                        href = link.get_attribute('href')
                        link_text = link.text.strip()
                        
                        if href and 'side' in link_text.lower():
                            print(f"  ✅ Found side effects link: '{link_text}' -> {href}")
                            return link
                            
                except Exception as e:
                    continue
            
            return None
            
        except Exception as e:
            print(f"  ❌ Error finding side effects link: {str(e)}")
            return None

def test_manual_search():
    """Test the manual search functionality"""
    
    # Test medications
    test_medications = ["ibuprofen", "acetaminophen", "aspirin", "lisinopril", "metformin"]
    
    scraper = DrugsComSearchScraper(headless=False)  # Show browser for testing
    
    results = []
    
    try:
        for med in test_medications:
            print(f"\n{'='*60}")
            print(f"Testing: {med}")
            print('='*60)
            
            result = scraper.scrape_medication_side_effects(med)
            results.append(result)
            
            print(f"Status: {result['status']}")
            print(f"Content length: {len(result['full_information'])}")
            if result['source_url']:
                print(f"Source URL: {result['source_url']}")
            print(f"Preview: {result['full_information'][:200]}...")
            
            # Add delay between searches
            time.sleep(random.uniform(3, 6))
            
    except KeyboardInterrupt:
        print("\n⚠️  Testing interrupted by user")
    except Exception as e:
        print(f"\n❌ Error during testing: {str(e)}")
    finally:
        scraper.close()
    
    # Summary
    print(f"\n{'='*60}")
    print("TESTING SUMMARY")
    print('='*60)
    
    success_count = sum(1 for r in results if r['status'] == 'Success')
    print(f"Successful: {success_count}/{len(results)}")
    
    for result in results:
        print(f"{result['medication']}: {result['status']}")

if __name__ == "__main__":
    print("Testing Manual Search Functionality for Drugs.com")
    print("=" * 70)
    print("This will open a browser window and search for medications manually")
    print("=" * 70)
    
    test_manual_search()
