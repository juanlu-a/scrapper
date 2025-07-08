from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys
import time

def test_drugs_com_flow():
    """Test the full flow for getting side effects from drugs.com"""
    try:
        print("Setting up Chrome driver...")
        chrome_options = Options()
        # Don't use headless so we can see what's happening
        # chrome_options.add_argument("--headless")
        chrome_options.add_argument("--no-sandbox")
        chrome_options.add_argument("--disable-dev-shm-usage")
        
        driver = webdriver.Chrome(options=chrome_options)
        wait = WebDriverWait(driver, 10)
        
        medication = "ibuprofen"
        
        print(f"1. Opening drugs.com search for: {medication}")
        driver.get("https://www.drugs.com")
        
        # Find and use the search box
        search_box = wait.until(EC.presence_of_element_located((By.NAME, "searchterm")))
        search_box.clear()
        search_box.send_keys(medication)
        search_box.send_keys(Keys.RETURN)
        
        print("2. Waiting for search results...")
        time.sleep(3)
        
        # Look for the main medication result (usually has a yellow star)
        print("3. Looking for main medication result...")
        
        # Try different selectors for the main result
        main_result = None
        selectors_to_try = [
            f"a[href*='{medication}.html']",  # Direct link to medication page
            "a[href*='.html'][href*='{}']".format(medication),  # More flexible
            ".ddc-search-result a",  # General search result links
            "a[title*='{}']".format(medication),  # Links with medication in title
        ]
        
        for selector in selectors_to_try:
            try:
                results = driver.find_elements(By.CSS_SELECTOR, selector)
                if results:
                    # Look for the most relevant result (usually the first non-sponsored one)
                    for result in results:
                        href = result.get_attribute('href')
                        text = result.text.lower()
                        if medication.lower() in text and '.html' in href and 'search' not in href:
                            main_result = result
                            print(f"   Found main result: {result.text} -> {href}")
                            break
                    if main_result:
                        break
            except:
                continue
        
        if not main_result:
            print("❌ Could not find main medication result")
            driver.quit()
            return
        
        print("4. Clicking on main medication result...")
        main_result.click()
        
        print("5. Waiting for medication page to load...")
        time.sleep(3)
        
        print("6. Looking for 'Side effects' navigation link...")
        
        # Look for the side effects link in the navigation
        side_effects_link = None
        selectors_to_try = [
            "a[href*='side-effects']",  # Direct side effects link
            "a[href*='#side-effects']",  # Anchor link to side effects
            "a:contains('Side effects')",  # Link containing "Side effects"
            "//a[contains(text(), 'Side effects')]",  # XPath for side effects
        ]
        
        for selector in selectors_to_try:
            try:
                if selector.startswith("//"):
                    # XPath selector
                    links = driver.find_elements(By.XPATH, selector)
                else:
                    # CSS selector
                    links = driver.find_elements(By.CSS_SELECTOR, selector)
                
                if links:
                    side_effects_link = links[0]
                    print(f"   Found side effects link: {side_effects_link.text}")
                    break
            except:
                continue
        
        if not side_effects_link:
            print("❌ Could not find side effects link")
            # Let's see what navigation links are available
            print("Available navigation links:")
            nav_links = driver.find_elements(By.CSS_SELECTOR, "a")
            for link in nav_links[:20]:  # Show first 20 links
                if link.text.strip():
                    print(f"   - {link.text} -> {link.get_attribute('href')}")
            driver.quit()
            return
        
        print("7. Clicking on side effects link...")
        side_effects_link.click()
        
        print("8. Waiting for side effects section to load...")
        time.sleep(3)
        
        print("9. Extracting side effects content...")
        
        # Try to find side effects content
        side_effects_content = ""
        
        # Look for side effects sections
        selectors_to_try = [
            "#side-effects",  # ID selector
            ".side-effects",  # Class selector
            "[id*='side-effects']",  # Partial ID match
            "[class*='side-effects']",  # Partial class match
        ]
        
        for selector in selectors_to_try:
            try:
                section = driver.find_element(By.CSS_SELECTOR, selector)
                if section:
                    side_effects_content = section.text
                    print(f"   Found side effects content using selector: {selector}")
                    break
            except:
                continue
        
        if not side_effects_content:
            # If no specific section found, get the main content
            try:
                main_content = driver.find_element(By.CSS_SELECTOR, "main, .main-content, #main, .content")
                side_effects_content = main_content.text
                print("   Using main content area")
            except:
                side_effects_content = driver.find_element(By.TAG_NAME, "body").text
                print("   Using body content")
        
        print(f"10. ✅ Successfully extracted {len(side_effects_content)} characters of content")
        print(f"Preview: {side_effects_content[:200]}...")
        
        # Keep browser open for a few seconds to see the result
        print("Keeping browser open for 5 seconds to view result...")
        time.sleep(5)
        
        driver.quit()
        
    except Exception as e:
        print(f"❌ Error: {str(e)}")
        try:
            driver.quit()
        except:
            pass

if __name__ == "__main__":
    test_drugs_com_flow()
