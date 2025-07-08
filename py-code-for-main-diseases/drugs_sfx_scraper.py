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

class DrugsSfxScraper:
    def __init__(self):
        self.base_url = "https://www.drugs.com"
        self.sfx_url = "https://www.drugs.com/sfx/"
        self.session = requests.Session()
        
        # Enhanced headers to mimic a real browser
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'same-origin',
            'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
            'Sec-Ch-Ua-Mobile': '?0',
            'Sec-Ch-Ua-Platform': '"macOS"',
            'Referer': 'https://www.drugs.com/sfx/',
            'Cache-Control': 'max-age=0'
        })
        
    def search_side_effects(self, medication_name):
        """Search for side effects using the /sfx/ endpoint"""
        try:
            print(f"🔍 Searching side effects for: {medication_name}")
            
            # Add delay to avoid rate limiting
            time.sleep(random.uniform(1.5, 3.0))
            
            # Method 1: Try direct sfx search URL
            search_url = f"{self.sfx_url}{quote(medication_name.lower())}.html"
            print(f"  Trying direct sfx URL: {search_url}")
            
            response = self.session.get(search_url, timeout=15)
            
            if response.status_code == 200:
                print(f"  ✓ Found direct sfx page for {medication_name}")
                return self.extract_side_effects_from_sfx(response.content, medication_name, search_url)
            
            print(f"  Direct sfx failed ({response.status_code}), trying search...")
            
            # Method 2: Use the sfx search form
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
        """Search using the sfx search form"""
        try:
            print(f"  Using sfx search form for {medication_name}")
            
            # First, get the search page to get any necessary form data
            search_page = self.session.get(self.sfx_url, timeout=15)
            
            if search_page.status_code != 200:
                print(f"  ✗ Cannot access sfx search page: {search_page.status_code}")
                return self.fallback_search(medication_name)
            
            # Try to find the search form or direct search URL pattern
            soup = BeautifulSoup(search_page.content, 'html.parser')
            
            # Look for search form
            search_form = soup.find('form')
            if search_form:
                action = search_form.get('action', '')
                method = search_form.get('method', 'GET').upper()
                
                # Prepare search data
                search_data = {
                    'searchterm': medication_name,
                    'q': medication_name,
                    'drug': medication_name
                }
                
                # Submit search
                if method == 'POST':
                    response = self.session.post(urljoin(self.sfx_url, action), data=search_data, timeout=15)
                else:
                    response = self.session.get(urljoin(self.sfx_url, action), params=search_data, timeout=15)
                
                if response.status_code == 200:
                    print(f"  ✓ Search form submitted successfully")
                    return self.extract_side_effects_from_sfx(response.content, medication_name, response.url)
            
            # If form search fails, try fallback
            return self.fallback_search(medication_name)
            
        except Exception as e:
            print(f"  ✗ Error with sfx form search: {str(e)}")
            return self.fallback_search(medication_name)
    
    def fallback_search(self, medication_name):
        """Fallback to regular drug page search"""
        try:
            print(f"  Trying fallback search for {medication_name}")
            
            # Try different URL patterns
            url_patterns = [
                f"{self.base_url}/{medication_name.lower().replace(' ', '-')}.html",
                f"{self.base_url}/mtm/{medication_name.lower().replace(' ', '-')}.html",
                f"{self.base_url}/otc/{medication_name.lower().replace(' ', '-')}.html"
            ]
            
            for url in url_patterns:
                try:
                    print(f"    Trying: {url}")
                    response = self.session.get(url, timeout=15)
                    
                    if response.status_code == 200:
                        print(f"    ✓ Found page: {url}")
                        return self.extract_side_effects_from_regular_page(response.content, medication_name, url)
                        
                except Exception as e:
                    continue
            
            # If all fails, return not found
            print(f"  ✗ All search methods failed for {medication_name}")
            return {
                'medication': medication_name,
                'status': 'Not Found',
                'full_information': f'No side effects information found for {medication_name}',
                'source_url': 'N/A'
            }
            
        except Exception as e:
            print(f"  ✗ Error in fallback search: {str(e)}")
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error in fallback search for {medication_name}: {str(e)}',
                'source_url': 'N/A'
            }
    
    def extract_side_effects_from_sfx(self, content, medication_name, source_url):
        """Extract side effects from sfx page content"""
        try:
            soup = BeautifulSoup(content, 'html.parser')
            content_parts = []
            
            content_parts.append(f"=== {medication_name} Side Effects (from drugs.com/sfx) ===\n")
            
            # Look for side effects content in sfx pages
            # These pages might have different structure
            
            # Method 1: Look for main content areas
            main_content = soup.find('div', class_='main-content') or soup.find('div', {'id': 'content'}) or soup.find('main')
            
            if main_content:
                # Extract headings and content
                for element in main_content.find_all(['h1', 'h2', 'h3', 'h4', 'h5', 'p', 'ul', 'ol', 'div']):
                    if element.name in ['h1', 'h2', 'h3', 'h4', 'h5']:
                        text = element.get_text(strip=True)
                        if text and len(text) > 3:
                            content_parts.append(f"\n--- {text} ---")
                    elif element.name in ['p', 'div']:
                        text = element.get_text(strip=True)
                        if text and len(text) > 15:
                            content_parts.append(text)
                    elif element.name in ['ul', 'ol']:
                        for li in element.find_all('li'):
                            li_text = li.get_text(strip=True)
                            if li_text and len(li_text) > 3:
                                content_parts.append(f"• {li_text}")
                    
                    content_parts.append("")  # Add spacing
            
            # Method 2: Look for any text containing side effects keywords
            if not content_parts or len(content_parts) < 5:
                print(f"  Limited content found, extracting all relevant text...")
                
                all_text = soup.get_text()
                paragraphs = re.split(r'\n\s*\n', all_text)
                
                for para in paragraphs:
                    para = para.strip()
                    if (len(para) > 20 and 
                        ('side effect' in para.lower() or 
                         'adverse' in para.lower() or 
                         'reaction' in para.lower() or
                         'symptom' in para.lower())):
                        content_parts.append(para)
                        content_parts.append("")
            
            # Join content
            if content_parts and len(content_parts) > 3:
                result_text = '\n'.join(content_parts)
                print(f"  ✓ Extracted {len(result_text)} characters from sfx page")
                
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
                    'full_information': f'Limited side effects information found for {medication_name}. Page content was minimal.',
                    'source_url': source_url
                }
                
        except Exception as e:
            print(f"  ✗ Error extracting from sfx page: {str(e)}")
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error extracting side effects for {medication_name}: {str(e)}',
                'source_url': source_url
            }
    
    def extract_side_effects_from_regular_page(self, content, medication_name, source_url):
        """Extract side effects from regular drug page"""
        try:
            soup = BeautifulSoup(content, 'html.parser')
            content_parts = []
            
            content_parts.append(f"=== {medication_name} Side Effects Information ===\n")
            
            # Look for side effects sections
            side_effects_headings = soup.find_all(['h1', 'h2', 'h3', 'h4'], string=re.compile(r'side effects?', re.IGNORECASE))
            
            for heading in side_effects_headings:
                content_parts.append(f"\n--- {heading.get_text(strip=True)} ---")
                
                # Get content after the heading
                current = heading.next_sibling
                while current and current.name not in ['h1', 'h2', 'h3', 'h4']:
                    if hasattr(current, 'get_text'):
                        if current.name == 'p':
                            text = current.get_text(strip=True)
                            if text and len(text) > 15:
                                content_parts.append(text)
                        elif current.name in ['ul', 'ol']:
                            for li in current.find_all('li'):
                                li_text = li.get_text(strip=True)
                                if li_text:
                                    content_parts.append(f"• {li_text}")
                        elif current.name == 'div':
                            div_text = current.get_text(strip=True)
                            if div_text and len(div_text) > 15:
                                content_parts.append(div_text)
                    
                    current = current.next_sibling
                
                content_parts.append("")  # Add spacing
            
            # Join and return
            if content_parts and len(content_parts) > 3:
                result_text = '\n'.join(content_parts)
                print(f"  ✓ Extracted {len(result_text)} characters from regular page")
                
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
                    'full_information': f'Limited side effects information found for {medication_name}',
                    'source_url': source_url
                }
                
        except Exception as e:
            return {
                'medication': medication_name,
                'status': 'Error',
                'full_information': f'Error extracting from regular page: {str(e)}',
                'source_url': source_url
            }

def test_sfx_scraper():
    """Test the sfx scraper with a few medications"""
    
    # Test with common medications
    test_medications = ["ibuprofen", "acetaminophen", "aspirin", "lisinopril", "metformin"]
    
    scraper = DrugsSfxScraper()
    
    results = []
    
    for med in test_medications:
        print(f"\n{'='*60}")
        result = scraper.search_side_effects(med)
        results.append(result)
        
        print(f"Status: {result['status']}")
        print(f"Source: {result['source_url']}")
        print(f"Content length: {len(result['full_information'])}")
        print(f"Preview: {result['full_information'][:200]}...")
    
    # Summary
    print(f"\n{'='*60}")
    print("SUMMARY:")
    successful = sum(1 for r in results if r['status'] == 'Success')
    print(f"Successful: {successful}/{len(results)}")
    
    if successful > 0:
        print("✅ SFX scraper is working!")
        return True
    else:
        print("❌ SFX scraper not working")
        return False

if __name__ == "__main__":
    print("Testing Drugs.com SFX Side Effects Scraper...")
    print("=" * 60)
    
    test_sfx_scraper()
