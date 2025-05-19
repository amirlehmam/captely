#!/usr/bin/env python3
import os
import json
import argparse
import platform
from pathlib import Path

def main():
    """Set up API keys for the enrichment cascade"""
    parser = argparse.ArgumentParser(description="Configure API keys for the enrichment cascade")
    parser.add_argument("--hunter", help="Hunter.io API Key")
    parser.add_argument("--dropcontact", help="Dropcontact API Key")
    parser.add_argument("--icypeas-key", help="Icypeas API Key")
    parser.add_argument("--icypeas-secret", help="Icypeas API Secret")
    parser.add_argument("--apollo", help="Apollo API Key")
    parser.add_argument("--file", "-f", action="store_true", help="Save to .env file instead of environment variables")
    
    args = parser.parse_args()
    
    # Current API keys from the current script
    current_keys = {
        "HUNTER_API_KEY": os.environ.get("HUNTER_API_KEY", "1b8302af512410b685217b7fcf00be362e094f0e"),
        "DROPCONTACT_API_KEY": os.environ.get("DROPCONTACT_API_KEY", "zzqP8RNF6KXajJVgYaQiWeZW64J2mX"),
        "ICYPEAS_API_KEY": os.environ.get("ICYPEAS_API_KEY", "4faf07894e7c40eaac9c608b7f0f5556c7a903707632458c8fc985cd3cc58b8b"),
        "ICYPEAS_API_SECRET": os.environ.get("ICYPEAS_API_SECRET", "e7a3e867b51d1e59518d50d592e1f7aa1a5eccf7c7c56377c9d8dbddc35b2289"),
        "APOLLO_API_KEY": os.environ.get("APOLLO_API_KEY", "wLViVqsiBd3Cp56pFyc8nA")
    }
    
    # Update from command line arguments
    if args.hunter:
        current_keys["HUNTER_API_KEY"] = args.hunter
    if args.dropcontact:
        current_keys["DROPCONTACT_API_KEY"] = args.dropcontact
    if args.icypeas_key:
        current_keys["ICYPEAS_API_KEY"] = args.icypeas_key
    if args.icypeas_secret:
        current_keys["ICYPEAS_API_SECRET"] = args.icypeas_secret
    if args.apollo:
        current_keys["APOLLO_API_KEY"] = args.apollo
    
    if not any([args.hunter, args.dropcontact, args.icypeas_key, args.icypeas_secret, args.apollo]):
        # Interactive mode if no arguments provided
        print("\n=== Captely Enrichment API Key Setup ===\n")
        print("Enter your API keys for each service (leave blank to use current value):\n")
        
        for key, current_value in current_keys.items():
            masked_value = f"{current_value[:5]}...{current_value[-5:]}" if current_value else "Not set"
            new_value = input(f"{key} [{masked_value}]: ").strip()
            if new_value:
                current_keys[key] = new_value
    
    if args.file:
        # Save to .env file
        env_path = Path(".env")
        with open(env_path, "w") as f:
            for key, value in current_keys.items():
                f.write(f"{key}={value}\n")
        print(f"\nAPI keys saved to {env_path.absolute()}")
        print("These will be loaded when the enrichment process runs in this directory.")
    else:
        # Save to environment variable settings
        if platform.system() == "Windows":
            # Create a Windows batch file to set environment variables
            with open("set_api_keys.bat", "w") as f:
                f.write("@echo off\n")
                f.write(":: Captely Enrichment API Keys\n")
                for key, value in current_keys.items():
                    f.write(f"set {key}={value}\n")
                f.write('\necho API keys set successfully!\n')
                f.write('echo Run "run_enrichment.bat" to start the enrichment process.\n')
            print("\nAPI keys saved to Windows batch file.")
            print("Run set_api_keys.bat before running the enrichment process.")
        else:
            # Create a shell script for Linux/Mac
            with open("set_api_keys.sh", "w") as f:
                f.write("#!/bin/bash\n")
                f.write("# Captely Enrichment API Keys\n")
                for key, value in current_keys.items():
                    f.write(f"export {key}={value}\n")
                f.write('\necho "API keys set successfully!"\n')
                f.write('echo "Now run python run_enrichment.py to start the enrichment process."\n')
            os.chmod("set_api_keys.sh", 0o755)  # Make executable
            print("\nAPI keys saved to shell script.")
            print("Run source ./set_api_keys.sh before running the enrichment process.")
    
    print("\nAll API keys configured successfully!")

if __name__ == "__main__":
    main() 