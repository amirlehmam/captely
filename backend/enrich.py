#!/usr/bin/env python3
"""
Captely Enrichment Command Line Tool
-----------------------------------
Simple command-line script to process CSV files with the cascading enrichment system.
"""
import os
import sys
import argparse
import subprocess

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description='Enrich LinkedIn Sales Navigator contacts')
    parser.add_argument('file', nargs='?', help='CSV file to process')
    parser.add_argument('--docker', action='store_true', help='Execute in Docker container')
    return parser.parse_args()

def main():
    """Main entry point."""
    args = parse_args()
    
    # Make sure the csv directory exists
    os.makedirs('csv', exist_ok=True)
    
    # If no file specified, help the user
    if not args.file:
        if os.path.exists('csv') and any(f.endswith('.csv') for f in os.listdir('csv')):
            print("CSV files found in csv/ directory. Specify one to process:")
            for f in os.listdir('csv'):
                if f.endswith('.csv') and not f.endswith('_enriched.csv'):
                    print(f"  {f}")
        else:
            print("No CSV files found. Place files in the csv/ directory or specify a path.")
        return
    
    # Process the file
    if args.docker:
        # Use Docker command
        file_path = args.file
        
        # If it's a relative path, make it absolute inside the container
        if not file_path.startswith('/'):
            if not file_path.startswith('csv/'):
                file_path = f"csv/{os.path.basename(file_path)}"
            
            # Convert to container path
            file_path = f"/app/{file_path}"
        
        # Build the Docker command
        cmd = [
            "docker", "exec", "captely-enrichment-worker",
            "python", "-c",
            f"from enrichment.tasks import process_csv_file; process_csv_file('{file_path}')"
        ]
        
        print(f"Running enrichment in Docker container...")
        try:
            subprocess.run(cmd, check=True)
            print("Enrichment job submitted. View progress at http://localhost:5555")
        except subprocess.CalledProcessError as e:
            print(f"Error: {e}")
            sys.exit(1)
    else:
        # Use Python script
        try:
            # Execute the enrichment script
            script_path = os.path.join('services', 'enrichment-worker', 'enrich_csv.py')
            cmd = ["python", script_path, args.file]
            
            print(f"Running enrichment script...")
            subprocess.run(cmd, check=True)
        except subprocess.CalledProcessError as e:
            print(f"Error: {e}")
            sys.exit(1)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nOperation cancelled by user.")
        sys.exit(0)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1) 