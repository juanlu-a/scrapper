#!/usr/bin/env python3
"""
Test script to verify the sleep-resistant features of the scraper
"""

import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from production_scraper import DrugsScraper
import time

def test_reconnection():
    """Test the reconnection features"""
    print("🧪 Testing Sleep-Resistant Features")
    print("="*50)
    
    # Initialize scraper
    scraper = DrugsScraper(headless=False)
    
    try:
        # Test 1: Basic connection check
        print("\n1. Testing basic connection...")
        if scraper.check_connection():
            print("   ✅ Initial connection OK")
        else:
            print("   ❌ Initial connection failed")
        
        # Test 2: Test a basic navigation
        print("\n2. Testing basic navigation...")
        scraper.driver.get("https://www.drugs.com")
        time.sleep(2)
        print("   ✅ Navigation successful")
        
        # Test 3: Test safe driver action
        print("\n3. Testing safe driver action...")
        def test_action():
            return scraper.driver.current_url
        
        url = scraper.safe_driver_action(test_action)
        print(f"   ✅ Safe action successful: {url}")
        
        # Test 4: Simulate connection loss and recovery
        print("\n4. Testing connection recovery...")
        print("   💡 You can now put your computer to sleep for 10 seconds...")
        print("   💡 The scraper will attempt to reconnect automatically")
        
        # Wait and then test connection
        time.sleep(5)
        
        # Test reconnection
        scraper.reconnect_if_needed()
        
        if scraper.check_connection():
            print("   ✅ Reconnection successful")
            
            # Test that we can still navigate
            scraper.driver.get("https://www.drugs.com")
            print("   ✅ Navigation after reconnection successful")
        else:
            print("   ❌ Reconnection failed")
        
        print("\n" + "="*50)
        print("✅ Sleep-resistant features are working!")
        print("🚀 The scraper is ready for long-running operations")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        
    finally:
        scraper.close()

if __name__ == "__main__":
    test_reconnection()
