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

class DrugsComScraper:
    def __init__(self):
        self.base_url = "https://www.drugs.com"
        self.session = requests.Session()
        # Add more comprehensive headers to mimic a real browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        })
        
    def search_medication(self, medication_name):
        """Search for a medication on Drugs.com and return the URL of the medication page"""
        try:
            # Clean the medication name for search
            clean_name = medication_name.strip().lower().replace(' ', '-')
            
            # Add a delay before each request
            time.sleep(random.uniform(1, 2))
            
            # Try direct URL first (most common pattern)
            direct_url = f"{self.base_url}/{clean_name}.html"
            
            print(f"  Trying direct URL: {direct_url}")
            
            # Test if direct URL works
            try:
                response = self.session.get(direct_url, timeout=15, allow_redirects=True)
                if response.status_code == 200:
                    print(f"  ✓ Found direct URL for {medication_name}")
                    return direct_url
                else:
                    print(f"  Direct URL failed ({response.status_code})")
            except Exception as e:
                print(f"  Direct URL error: {str(e)}")
            
            # Try alternative patterns
            alternative_urls = [
                f"{self.base_url}/mtm/{clean_name}.html",
                f"{self.base_url}/drug-class/{clean_name}.html",
                f"{self.base_url}/otc/{clean_name}.html"
            ]
            
            for alt_url in alternative_urls:
                try:
                    print(f"  Trying alternative: {alt_url}")
                    time.sleep(random.uniform(0.5, 1.5))
                    response = self.session.get(alt_url, timeout=15, allow_redirects=True)
                    if response.status_code == 200:
                        print(f"  ✓ Found alternative URL for {medication_name}")
                        return alt_url
                except Exception as e:
                    continue
            
            print(f"  ✗ No accessible page found for {medication_name}")
            return None
            
        except Exception as e:
            print(f"  ✗ Error searching for {medication_name}: {str(e)}")
            return None
    
    def scrape_side_effects(self, medication_name):
        """Scrape side effects information for a medication"""
        try:
            print(f"🔍 Searching for {medication_name}...")
            
            # Step 1: Find the medication page
            drug_url = self.search_medication(medication_name)
            if not drug_url:
                return {
                    'medication': medication_name,
                    'status': 'Not Found',
                    'full_information': f'Medication "{medication_name}" not found on Drugs.com'
                }
            
            # Step 2: Try to get the side effects page
            side_effects_url = drug_url.replace('.html', '-side-effects.html')
            
            print(f"  Trying side effects URL: {side_effects_url}")
            
            # Try the side effects page first
            response = self.session.get(side_effects_url, timeout=10)
            if response.status_code != 200:
                print(f"  Side effects page not found, using main page: {drug_url}")
                response = self.session.get(drug_url, timeout=10)
                side_effects_url = drug_url
            
            if response.status_code != 200:
                return {
                    'medication': medication_name,
                    'status': 'Error',
                    'full_information': f'Failed to access page for {medication_name} (HTTP {response.status_code})'
                }
            
            soup = BeautifulSoup(response.content, 'html.parser')
            
            # Extract side effects content
            side_effects_content = self.extract_side_effects_content(soup, medication_name)
            
            print(f"  ✓ Successfully scraped {medication_name}")
            
            return {
                'medication': medication_name,
                'status': 'Success',
                'full_information': side_effects_content,
                'source_url': side_effects_url
            }
            
        except Exception as e:
            print(f"  ✗ Error scraping {medication_name}: {str(e)}")
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error scraping {medication_name}: {str(e)}'
            }
    
    def extract_side_effects_content(self, soup, medication_name):
        """Extract all side effects content from the page"""
        content_parts = []
        
        try:
            content_parts.append(f"=== {medication_name} Side Effects Information ===\n")
            
            # Method 1: Look for specific side effects headings
            headings = soup.find_all(['h1', 'h2', 'h3', 'h4'], string=re.compile(r'side effects?', re.IGNORECASE))
            
            if headings:
                print(f"  Found {len(headings)} side effects headings")
                for heading in headings:
                    content_parts.append(f"\n--- {heading.get_text(strip=True)} ---\n")
                    
                    # Get content after the heading
                    current = heading.next_sibling
                    while current and current.name not in ['h1', 'h2', 'h3', 'h4']:
                        if hasattr(current, 'get_text'):
                            text = current.get_text(strip=True)
                            if text and len(text) > 10:
                                if current.name == 'ul':
                                    # Handle lists
                                    for li in current.find_all('li'):
                                        content_parts.append(f"• {li.get_text(strip=True)}")
                                else:
                                    content_parts.append(text)
                                content_parts.append("")
                        current = current.next_sibling
            
            # Method 2: Look for paragraphs containing side effects
            if not content_parts or len(content_parts) < 5:
                print("  Looking for side effects in paragraphs...")
                paragraphs = soup.find_all('p')
                for p in paragraphs:
                    text = p.get_text(strip=True)
                    if ('side effect' in text.lower() or 
                        'adverse' in text.lower() or 
                        'reaction' in text.lower()) and len(text) > 30:
                        content_parts.append(text)
                        content_parts.append("")
            
            # Method 3: Look for lists that might contain side effects
            if not content_parts or len(content_parts) < 5:
                print("  Looking for side effects in lists...")
                lists = soup.find_all(['ul', 'ol'])
                for ul in lists:
                    list_text = ul.get_text(strip=True).lower()
                    if 'side effect' in list_text or 'symptom' in list_text:
                        content_parts.append("\n--- Side Effects List ---\n")
                        for li in ul.find_all('li'):
                            content_parts.append(f"• {li.get_text(strip=True)}")
                        content_parts.append("")
            
            # Join all content
            if content_parts and len(content_parts) > 2:  # More than just the header
                result = '\n'.join(content_parts)
                print(f"  Extracted {len(result)} characters of content")
                return result
            else:
                return f"Limited side effects information found for {medication_name}. Please check the source manually."
                
        except Exception as e:
            return f"Error extracting side effects content for {medication_name}: {str(e)}"
    
    def add_delay(self):
        """Add a random delay to avoid being blocked"""
        delay = random.uniform(3, 6)  # Random delay between 3-6 seconds
        time.sleep(delay)

def test_scraper():
    """Test the scraper with a few medications"""
    
    # Test with common medications
    test_medications = ["ibuprofen", "acetaminophen", "aspirin"]
    
    scraper = DrugsComScraper()
    
    for med in test_medications:
        print(f"\n{'='*50}")
        result = scraper.scrape_side_effects(med)
        print(f"Status: {result['status']}")
        print(f"Content length: {len(result['full_information'])}")
        print(f"Preview: {result['full_information'][:200]}...")
        
        scraper.add_delay()

if __name__ == "__main__":
    print("Testing Drugs.com Side Effects Scraper...")
    print("=" * 60)
    
    test_scraper()
