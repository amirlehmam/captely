#!/usr/bin/env python3
"""
CSV Enrichment Tool
------------------
Command-line tool to enrich CSV files with contact information.
"""
import os
import sys
import time
import logging
import argparse
import csv
from pathlib import Path
from typing import List, Optional

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger('enrich_csv')

# Import our Celery task if available
try:
    import enrichment.tasks
    CELERY_AVAILABLE = True
except ImportError:
    logger.warning("Enrichment tasks not available locally. Will use Docker container.")
    CELERY_AVAILABLE = False

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Enrich LinkedIn Sales Navigator CSV files with contact information')
    parser.add_argument('file', nargs='?', help='CSV file to process')
    parser.add_argument('--dir', '-d', default='csv', help='Directory containing CSV files to process')
    parser.add_argument('--user', '-u', default='system', help='User ID to associate with the job')
    parser.add_argument('--max', '-m', type=int, help='Maximum number of contacts to process (for testing)')
    parser.add_argument('--output', '-o', help='Output directory for enriched files')
    return parser.parse_args()

def find_csv_files(directory: str, specific_file: Optional[str] = None) -> List[str]:
    """Find CSV files to process."""
    dir_path = Path(directory)
    
    # Make sure the directory exists
    if not dir_path.exists():
        logger.info(f"Creating directory {dir_path}")
        dir_path.mkdir(parents=True, exist_ok=True)
    
    # If a specific file was provided
    if specific_file:
        file_path = Path(specific_file)
        if file_path.exists() and file_path.is_file():
            return [str(file_path)]
        
        # Try in the specified directory
        file_in_dir = dir_path / file_path.name
        if file_in_dir.exists() and file_in_dir.is_file():
            return [str(file_in_dir)]
            
        logger.error(f"File not found: {specific_file}")
        return []
    
    # Find all CSV files in the directory
    csv_files = list(dir_path.glob("*.csv"))
    
    # Filter out files that already have _enriched in the name
    csv_files = [f for f in csv_files if "_enriched" not in f.name]
    
    if not csv_files:
        logger.warning(f"No CSV files found in {dir_path}")
        
    return [str(f) for f in csv_files]

def validate_csv(file_path: str) -> bool:
    """Check if the CSV file has the required columns."""
    try:
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.reader(f)
            header = next(reader, [])
            
            # Check if we have at least some of the required columns (case insensitive)
            required_fields = [
                'first name', 'last name', 'name', 'full name', 
                'company', 'organization', 
                'title', 'position'
            ]
            
            # Convert header to lowercase for case-insensitive comparison
            header_lower = [h.lower() for h in header]
            
            # Check if any of the required fields are present
            for field in required_fields:
                if field in header_lower:
                    return True
            
            logger.warning(f"CSV file {file_path} missing required columns")
            return False
    except Exception as e:
        logger.error(f"Error validating CSV {file_path}: {str(e)}")
        return False

def run_enrichment_in_container(file_path: str, user_id: str, max_contacts: Optional[int] = None) -> bool:
    """Run the enrichment process through the Docker container."""
    import subprocess
    
    # Build the command
    cmd = [
        "docker", "exec", "captely-enrichment-worker",
        "python", "-c",
        f"from enrichment.tasks import process_csv_file; process_csv_file('{file_path}', user_id='{user_id}')"
    ]
    
    logger.info(f"Running command: {' '.join(cmd)}")
    
    # Execute the command
    try:
        subprocess.run(cmd, check=True)
        logger.info(f"Enrichment job started for {file_path}")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Error running command: {e}")
        return False

def main():
    """Main entry point."""
    args = parse_args()
    
    # Find CSV files
    files = find_csv_files(args.dir, args.file)
    
    if not files:
        logger.error("No files to process. Please provide a CSV file.")
        sys.exit(1)
    
    # Process each file
    for file_path in files:
        logger.info(f"Processing file: {file_path}")
        
        # Validate the CSV file
        if not validate_csv(file_path):
            logger.error(f"Skipping invalid file: {file_path}")
            continue
        
        # Process the file
        if CELERY_AVAILABLE:
            # Use local tasks if available
            job_id = f"job_{int(time.time())}_{Path(file_path).name}"
            task = enrichment.tasks.process_csv_file.delay(file_path, job_id=job_id, user_id=args.user)
            logger.info(f"Started job {job_id} with task ID {task.id}")
        else:
            # Use Docker container
            run_enrichment_in_container(file_path, args.user, args.max)
    
    logger.info("All enrichment jobs have been submitted.")
    logger.info("Results will be stored in the database and can be exported later.")
    
if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("Process interrupted by user.")
        sys.exit(0)
    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        sys.exit(1) 