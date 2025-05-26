#!/usr/bin/env python
"""
Enrichment script to process LinkedIn Sales Navigator CSV data.
This script connects to the enrichment worker service to process the data.
"""

import os
import sys
import time
import json
import argparse
import requests
from pathlib import Path

def main():
    """Main entry point for the enrichment script."""
    parser = argparse.ArgumentParser(description='Process LinkedIn Sales Navigator CSV data.')
    parser.add_argument('--file', '-f', required=True, help='Path to the CSV file to process')
    parser.add_argument('--user', '-u', required=True, help='User ID to associate with the job')
    parser.add_argument('--api', '-a', default='http://localhost:8002', help='API endpoint for the import service')
    args = parser.parse_args()
    
    file_path = Path(args.file).resolve()
    
    if not file_path.exists():
        print(f"Error: File {file_path} does not exist.")
        sys.exit(1)
    
    if not file_path.is_file():
        print(f"Error: {file_path} is not a file.")
        sys.exit(1)
    
    # Check file extension
    if file_path.suffix.lower() != '.csv':
        print(f"Error: {file_path} is not a CSV file.")
        sys.exit(1)
    
    print(f"Processing {file_path}...")
    
    # Submit the job to the import service
    try:
        data = {
            'file_path': str(file_path),
            'user_id': args.user
        }
        
        response = requests.post(
            f"{args.api}/api/v1/import/enrich",
            json=data,
            headers={'Content-Type': 'application/json'}
        )
        
        if response.status_code != 200:
            print(f"Error: {response.status_code} - {response.text}")
            sys.exit(1)
        
        # Get the job ID
        result = response.json()
        job_id = result.get('job_id')
        
        print(f"Job submitted successfully. Job ID: {job_id}")
        print("You can monitor the progress in the Flower dashboard at http://localhost:5555")
        
    except Exception as e:
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == '__main__':
    main() 