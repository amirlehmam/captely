#!/usr/bin/env python
"""
Enrichment Worker CLI
---------------------
Simple command-line interface to start enrichment jobs.
"""
import os
import sys
import time
import argparse
import csv
import glob
from pathlib import Path
import logging
import json
from typing import List, Dict, Any, Optional
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("logs/cli.log")
    ]
)
logger = logging.getLogger("enrichment_cli")

# Import Celery task
try:
    from app.tasks import process_csv_file
    CELERY_AVAILABLE = True
except ImportError:
    logger.warning("Celery tasks not available, running in local mode")
    CELERY_AVAILABLE = False

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Process LinkedIn contacts for email enrichment')
    parser.add_argument('--file', type=str, help='Specific CSV file to process')
    parser.add_argument('--dir', type=str, default='csv', help='Directory containing CSV files to process')
    parser.add_argument('--max', type=int, help='Maximum number of contacts to process (for testing)')
    parser.add_argument('--user', type=str, default='system', help='User ID for tracking')
    return parser.parse_args()

def find_csv_files(directory: str = 'csv', specific_file: Optional[str] = None) -> List[str]:
    """Find CSV files to process."""
    if specific_file:
        if os.path.exists(specific_file):
            return [specific_file]
        elif os.path.exists(os.path.join(directory, specific_file)):
            return [os.path.join(directory, specific_file)]
        else:
            logger.error(f"File not found: {specific_file}")
            return []
    
    # Look for all CSV files in the directory
    pattern = os.path.join(directory, "*.csv")
    files = glob.glob(pattern)
    
    # Filter out files that have already been enriched
    files = [f for f in files if not f.endswith("_enriched.csv")]
    
    if not files:
        logger.warning(f"No CSV files found in {directory}")
    
    return files

def count_contacts(file_path: str) -> int:
    """Count the number of contacts in a CSV file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            # Skip header
            next(reader)
            return sum(1 for _ in reader)
    except Exception as e:
        logger.error(f"Error counting contacts in {file_path}: {str(e)}")
        return 0

def validate_csv(file_path: str) -> bool:
    """Validate that the CSV has the required columns."""
    required_columns = ["First Name", "Last Name", "Company"]
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            
            # Check if any of the required columns are present
            for col in required_columns:
                if not any(c.lower() == col.lower() or 
                          c.lower().replace(" ", "_") == col.lower().replace(" ", "_") 
                          for c in header):
                    logger.warning(f"Missing required column: {col} in {file_path}")
                    return False
        return True
    except Exception as e:
        logger.error(f"Error validating CSV {file_path}: {str(e)}")
        return False

def run_enrichment_async(file_path: str, max_contacts: Optional[int] = None, user_id: str = 'system'):
    """Submit a file for enrichment via Celery task."""
    # Generate a job ID
    job_id = f"job_{int(time.time())}_{os.path.basename(file_path)}"
    
    # Submit the task to Celery
    if CELERY_AVAILABLE:
        task = process_csv_file.delay(file_path, job_id, user_id)
        logger.info(f"Submitted job {job_id} with task ID {task.id} for file {file_path}")
        return job_id
    else:
        logger.error("Celery not available, please run enrichment worker")
        return None

def main():
    """Main entry point for the CLI."""
    args = parse_args()
    
    # Find CSV files to process
    files = find_csv_files(args.dir, args.file)
    
    if not files:
        logger.error("No files found to process")
        sys.exit(1)
    
    # Process each file
    jobs = []
    for file_path in files:
        logger.info(f"Processing file: {file_path}")
        
        # Validate CSV structure
        if not validate_csv(file_path):
            logger.error(f"Skipping invalid file: {file_path}")
            continue
        
        # Count contacts
        total_contacts = count_contacts(file_path)
        if total_contacts == 0:
            logger.warning(f"No contacts found in {file_path}")
            continue
        
        # Apply max contacts limit if specified
        max_contacts = args.max
        if max_contacts and max_contacts < total_contacts:
            logger.info(f"Limiting to {max_contacts} contacts (out of {total_contacts} total)")
        else:
            max_contacts = None
        
        # Start the enrichment process
        job_id = run_enrichment_async(file_path, max_contacts, args.user)
        if job_id:
            jobs.append({
                "job_id": job_id,
                "file": file_path,
                "total_contacts": total_contacts,
                "max_contacts": max_contacts,
                "user_id": args.user
            })
    
    # Print summary
    if jobs:
        logger.info(f"Started {len(jobs)} enrichment jobs:")
        for job in jobs:
            logger.info(f"  Job {job['job_id']} for {job['file']} ({job['total_contacts']} contacts)")
        
        logger.info("Use Flower dashboard to monitor progress: http://localhost:5555")
    else:
        logger.error("No jobs were started")

if __name__ == "__main__":
    try:
        # Create logs directory if it doesn't exist
        os.makedirs("logs", exist_ok=True)
        
        # Run the main function
        main()
    except KeyboardInterrupt:
        logger.info("Process interrupted by user")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        sys.exit(1) 