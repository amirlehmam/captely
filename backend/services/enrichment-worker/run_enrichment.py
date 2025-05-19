#!/usr/bin/env python3
import os
import sys
import logging
from pathlib import Path
from app.enrichment_cascade import process_csv

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('enrichment.log')
    ]
)
logger = logging.getLogger('enrichment')

def main():
    """Main function to run the enrichment process"""
    logger.info("Starting Captely Enrichment Process")
    
    # Directory with CSV files
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../'))
    csv_dir = os.path.join(project_root, 'backend', 'csv')
    
    # Create directory if it doesn't exist
    if not os.path.exists(csv_dir):
        logger.info(f"Creating CSV directory: {csv_dir}")
        os.makedirs(csv_dir, exist_ok=True)
    
    # Check if we have a limit on the number of leads to process
    max_leads = None
    if "MAX_LEADS" in os.environ:
        try:
            max_leads = int(os.environ["MAX_LEADS"])
            logger.info(f"Will process a maximum of {max_leads} leads per file")
        except ValueError:
            logger.warning(f"Invalid MAX_LEADS value: {os.environ['MAX_LEADS']}")
    
    # Get list of CSV files
    csv_files = [f for f in os.listdir(csv_dir) if f.endswith('.csv') and not f.endswith('_enriched.csv')]
    
    if not csv_files:
        logger.warning(f"No CSV files found in {csv_dir}")
        print(f"\nNo CSV files found to process in {csv_dir}")
        print("Please add some CSV files and try again, or run create_sample_csv.py to generate test data.")
        return
    
    logger.info(f"Found {len(csv_files)} CSV files to process")
    
    # Process each file
    for i, csv_file in enumerate(csv_files):
        input_path = os.path.join(csv_dir, csv_file)
        
        # Default output path adds "_enriched" to the filename
        base_name = Path(csv_file).stem
        output_path = os.path.join(csv_dir, f"{base_name}_enriched.csv")
        
        print(f"\n[{i+1}/{len(csv_files)}] Processing: {csv_file}")
        logger.info(f"Processing file {i+1}/{len(csv_files)}: {csv_file}")
        
        result = process_csv(input_path, output_path, max_leads)
        
        if "error" in result:
            logger.error(f"Error processing {csv_file}: {result['error']}")
            print(f"❌ Error: {result['error']}")
        else:
            logger.info(f"Completed processing {csv_file}")
            success_rate = result.get('success_rate', 0)
            print(f"✅ Success rate: {success_rate:.1f}% ({result.get('success', 0)}/{result.get('total', 0)} contacts)")
            print(f"📁 Output saved to: {output_path}")
    
    print("\n✅ Enrichment process completed!")
    logger.info("Enrichment process completed")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n🛑 Process interrupted by user")
        logger.info("Process interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Unexpected error: {str(e)}")
        logger.exception("Unexpected error")
        sys.exit(1) 