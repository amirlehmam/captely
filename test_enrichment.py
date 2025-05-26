"""
Simple script to test the enrichment system.
"""
import os
import sys
import json
import requests
from pathlib import Path

def test_enrichment():
    """Test the enrichment system by making an API call to the import service."""
    # API endpoint
    api_url = "http://localhost:8002/api/v1/import/enrich"
    
    # CSV file path - this is the path inside the import-service Docker container
    file_path = "/app/test_leads.csv"
    
    # User ID
    user_id = "admin"
    
    # Prepare the request data
    data = {
        "file_path": file_path,
        "user_id": user_id
    }
    
    # Make the API request
    try:
        response = requests.post(
            api_url,
            json=data,
            headers={"Content-Type": "application/json"}
        )
        
        # Print the response
        print(f"Status code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            result = response.json()
            print(f"\nJob submitted successfully!")
            print(f"Job ID: {result.get('job_id')}")
            print("\nYou can monitor the progress in the Flower dashboard:")
            print("http://localhost:5555")
        else:
            print(f"\nError: Failed to submit job. Status code: {response.status_code}")
            
    except Exception as e:
        print(f"Error: {str(e)}")

if __name__ == "__main__":
    test_enrichment() 