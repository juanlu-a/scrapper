#!/usr/bin/env python3
"""Debug script to test what content is being extracted from drugs.com"""

import time
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from webdriver_manager.chrome import ChromeDriverManager

def setup_chrome_driver():
    """Set up Chrome driver with necessary options"""
    chrome_options = Options()
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option('useAutomationExtension', False)
    
    service = Service(ChromeDriverManager().install())
    driver = webdriver.Chrome(service=service, options=chrome_options)
    driver.execute_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
    
    return driver

def test_medication_extraction(medication_name="aspirin"):
    """Test the full extraction process for a single medication"""
    driver = setup_chrome_driver()
    
    try:
        print(f"🔍 Testing extraction for: {medication_name}")
        
        # Step 1: Go to drugs.com
        print("1. Navigating to drugs.com...")
        driver.get("https://www.drugs.com")
        time.sleep(3)
        
        # Step 2: Search for medication
        print(f"2. Searching for {medication_name}...")
        
        # First, let's see what search elements are available
        print("   Inspecting search elements...")
        
        # Try different search selectors
        search_selectors = [
            'input[name="searchterm"]',  # This is the correct one!
            'input[name="query"]',
            'input[type="search"]',
            'input[placeholder*="search"]',
            'input[placeholder*="Search"]',
            '#search',
            '.search-input',
            'input.search'
        ]
        
        search_box = None
        for selector in search_selectors:
            try:
                search_box = driver.find_element(By.CSS_SELECTOR, selector)
                print(f"   Found search box with selector: {selector}")
                break
            except:
                continue
        
        if not search_box:
            print("   ❌ No search box found! Let's check page structure...")
            page_source = driver.page_source
            if 'search' in page_source.lower():
                print("   Found 'search' in page source")
                # Let's try to find any input elements
                inputs = driver.find_elements(By.TAG_NAME, "input")
                print(f"   Found {len(inputs)} input elements")
                for i, inp in enumerate(inputs[:5]):
                    try:
                        print(f"      Input {i}: type='{inp.get_attribute('type')}', name='{inp.get_attribute('name')}', placeholder='{inp.get_attribute('placeholder')}'")
                    except:
                        pass
            return
        
        search_box.clear()
        search_box.send_keys(medication_name)
        
        # Try different submit button selectors
        submit_selectors = [
            'input[type="submit"]',
            'button[type="submit"]',
            '.search-button',
            '#search-button',
            'input[value*="Search"]',
            'button[value*="Search"]'
        ]
        
        search_button = None
        for selector in submit_selectors:
            try:
                search_button = driver.find_element(By.CSS_SELECTOR, selector)
                print(f"   Found search button with selector: {selector}")
                break
            except:
                continue
        
        if not search_button:
            print("   ❌ No search button found! Trying Enter key...")
            from selenium.webdriver.common.keys import Keys
            search_box.send_keys(Keys.RETURN)
        else:
            search_button.click()
            
        time.sleep(3)
        
        # Step 3: Find and click first medication link
        print("3. Finding medication link...")
        medication_links = driver.find_elements(By.CSS_SELECTOR, "a[href*='.html']")
        for link in medication_links:
            if medication_name.lower() in link.text.lower():
                print(f"   Clicking: {link.text}")
                link.click()
                break
        time.sleep(3)
        
        # Step 4: Find side effects link
        print("4. Finding side effects link...")
        side_effects_selectors = [
            "//a[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'side effects')]",
            "//a[contains(text(), 'Side effects')]",
            "//a[contains(text(), 'side effects')]",
        ]
        
        side_effects_link = None
        for selector in side_effects_selectors:
            try:
                links = driver.find_elements(By.XPATH, selector)
                if links:
                    side_effects_link = links[0]
                    print(f"   Found side effects link: {side_effects_link.text}")
                    break
            except:
                continue
        
        if not side_effects_link:
            print("   ❌ No side effects link found!")
            return
            
        # Step 5: Click side effects link
        print("5. Clicking side effects link...")
        side_effects_link.click()
        time.sleep(5)
        
        # Step 6: Extract content - DEBUG VERSION
        print("6. Extracting content...")
        print(f"   Current URL: {driver.current_url}")
        
        # Get page title
        page_title = driver.title
        print(f"   Page title: {page_title}")
        
        # Try different extraction strategies
        print("\n📝 EXTRACTION TEST RESULTS:")
        
        # Strategy 1: Get all text from body
        print("\n--- Strategy 1: Full page text ---")
        try:
            body = driver.find_element(By.TAG_NAME, "body")
            full_text = body.text
            print(f"Total page text length: {len(full_text)} characters")
            
            # Look for side effects keywords
            keywords = ['side effect', 'adverse', 'warning', 'precaution']
            lines_with_keywords = []
            for line in full_text.split('\n'):
                if any(keyword in line.lower() for keyword in keywords):
                    lines_with_keywords.append(line.strip())
            
            print(f"Lines containing side effects keywords: {len(lines_with_keywords)}")
            for i, line in enumerate(lines_with_keywords[:5]):  # Show first 5
                print(f"   {i+1}. {line[:100]}...")
                
        except Exception as e:
            print(f"   Error with Strategy 1: {e}")
        
        # Strategy 2: Look for specific CSS selectors
        print("\n--- Strategy 2: CSS selectors ---")
        
        # Focus on the side effects element specifically
        try:
            side_effects_elem = driver.find_element(By.CSS_SELECTOR, "#side-effects")
            full_text = side_effects_elem.text.strip()
            print(f"   #side-effects: Found 1 element with {len(full_text)} characters")
            print(f"   SIDE EFFECTS HEADER CONTENT: '{full_text}'")
            
            # The content is probably in the parent or following siblings
            print(f"   Looking for content around #side-effects...")
            
            # Try parent element
            try:
                parent = side_effects_elem.find_element(By.XPATH, "..")
                parent_text = parent.text.strip()
                print(f"   Parent element has {len(parent_text)} characters")
                if len(parent_text) > 100:
                    print(f"   PARENT CONTENT: {parent_text[:500]}...")
            except Exception as e:
                print(f"   Error getting parent: {e}")
            
            # Try following siblings
            try:
                following_siblings = side_effects_elem.find_elements(By.XPATH, "./following-sibling::*")
                print(f"   Found {len(following_siblings)} following siblings")
                for i, sibling in enumerate(following_siblings[:3]):
                    sibling_text = sibling.text.strip()
                    if len(sibling_text) > 20:
                        print(f"   Sibling {i+1}: {sibling_text[:200]}...")
            except Exception as e:
                print(f"   Error getting siblings: {e}")
                
            # Try next elements by different methods
            try:
                # Look for the next div after side-effects
                next_divs = driver.find_elements(By.XPATH, "//h2[@id='side-effects']/following::div")
                print(f"   Found {len(next_divs)} divs after side-effects")
                for i, div in enumerate(next_divs[:3]):
                    div_text = div.text.strip()
                    if len(div_text) > 50:
                        print(f"   Div {i+1}: {div_text[:200]}...")
            except Exception as e:
                print(f"   Error finding following divs: {e}")
                
        except Exception as e:
            print(f"   #side-effects: Error - {e}")
        
        # Strategy 3: Look for common div classes
        print("\n--- Strategy 3: Common content divs ---")
        common_selectors = [
            "div[class*='content']",
            "div[class*='main']", 
            "div[class*='article']",
            "div[class*='text']",
            "div[class*='body']"
        ]
        
        for selector in common_selectors:
            try:
                elements = driver.find_elements(By.CSS_SELECTOR, selector)
                print(f"   {selector}: {len(elements)} elements found")
                for i, elem in enumerate(elements[:1]):  # Show first 1
                    text = elem.text.strip()
                    if len(text) > 100:
                        print(f"      Element {i+1}: {text[:200]}...")
            except Exception as e:
                print(f"   {selector}: Error - {e}")
        
        # Strategy 4: Look at page source
        print("\n--- Strategy 4: Page source analysis ---")
        page_source = driver.page_source
        print(f"   Page source length: {len(page_source)} characters")
        
        # Count occurrences of side effect related terms
        terms = ['side effect', 'adverse', 'warning', 'precaution', 'reaction']
        for term in terms:
            count = page_source.lower().count(term)
            print(f"   '{term}' appears {count} times in source")
        
    except Exception as e:
        print(f"❌ Error during test: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        print("\n🔚 Closing browser...")
        driver.quit()

if __name__ == "__main__":
    test_medication_extraction("aspirin")
