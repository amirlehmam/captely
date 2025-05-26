#!/usr/bin/env python
"""
Script to run a task directly with proper Full Name and Company data
"""

from app.tasks import process_csv_file
import csv
import os

if __name__ == "__main__":
    csv_path = '/app/csv/linkedin_leads_2025-05-19T15-53-50.csv'
    job_id = 'job_test_fullname'
    user_id = 'admin'
    
    # Print the first few rows of the CSV to verify data
    print(f"Checking CSV file: {csv_path}")
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader):
            if i < 3:  # Print first 3 rows
                print(f"Row {i+1}: Full Name = '{row.get('Full Name')}', Company = '{row.get('Company')}'")
            else:
                break
    
    # Run the task
    result = process_csv_file(csv_path, job_id, user_id)
    print(f"Task result: {result}") 