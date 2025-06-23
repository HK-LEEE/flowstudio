#!/usr/bin/env python3
"""Test API connection and endpoints"""
import requests
import json

def test_api():
    base_url = "http://localhost:8003"
    
    print("Testing FlowStudio API connection...")
    print("-" * 50)
    
    # Test health endpoint
    try:
        print(f"\n1. Testing health endpoint: {base_url}/health")
        response = requests.get(f"{base_url}/health", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test root endpoint
    try:
        print(f"\n2. Testing root endpoint: {base_url}/")
        response = requests.get(f"{base_url}/", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Response: {response.json()}")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test component templates endpoint (without auth)
    try:
        print(f"\n3. Testing component templates endpoint: {base_url}/api/fs/component_templates")
        response = requests.get(f"{base_url}/api/fs/component_templates", timeout=5)
        print(f"   Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"   Found {len(data)} component templates")
        else:
            print(f"   Response: {response.text[:200]}...")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    # Test API docs
    try:
        print(f"\n4. Testing API docs: {base_url}/docs")
        response = requests.get(f"{base_url}/docs", timeout=5)
        print(f"   Status: {response.status_code}")
        print(f"   Docs available: {response.status_code == 200}")
    except Exception as e:
        print(f"   ERROR: {e}")
    
    print("\n" + "-" * 50)
    print("Test complete!")

if __name__ == "__main__":
    test_api()