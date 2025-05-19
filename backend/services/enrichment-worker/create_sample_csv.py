#!/usr/bin/env python3
import os
import csv
from pathlib import Path
import random

# Sample data for generating test contacts
FIRST_NAMES = [
    "James", "Robert", "John", "Michael", "David", "William", "Richard", "Joseph", "Thomas", "Christopher",
    "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica", "Sarah", "Karen"
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin"
]

COMPANIES = [
    "Google", "Microsoft", "Apple", "Amazon", "Tesla", "Meta", "Netflix", "Adobe", "Salesforce", "Intel",
    "Nvidia", "IBM", "Oracle", "Cisco", "Uber", "SpaceX", "Samsung", "Sony", "Dell", "HP"
]

POSITIONS = [
    "CEO", "CTO", "CFO", "COO", "VP of Sales", "VP of Marketing", "VP of Engineering", "Director of Product",
    "Marketing Manager", "Sales Executive", "Software Engineer", "Product Manager", "HR Manager", 
    "Customer Success Manager", "Data Scientist", "Business Analyst", "Financial Analyst", "Account Executive",
    "Operations Manager", "Regional Manager"
]

def generate_linkedin_url(first_name, last_name, company=None):
    """Generate a realistic LinkedIn URL"""
    # 40% chance to be a company page if company is provided
    if company and random.random() < 0.4:
        company_slug = company.lower().replace(" ", "-")
        return f"https://www.linkedin.com/company/{company_slug}/"
    
    # Personal profile
    slug = f"{first_name.lower()}-{last_name.lower()}-{random.randint(10000, 99999)}"
    return f"https://www.linkedin.com/in/{slug}/"

def create_sample_csv(num_contacts=20, output_dir=None):
    """Create a sample CSV file with random contacts"""
    # Determine output directory
    if not output_dir:
        project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '../../../../'))
        output_dir = os.path.join(project_root, 'backend', 'csv')
    
    # Ensure the directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    # Create output file path
    output_path = os.path.join(output_dir, f"sample_leads_{num_contacts}.csv")
    
    # Generate contacts
    contacts = []
    for _ in range(num_contacts):
        first_name = random.choice(FIRST_NAMES)
        last_name = random.choice(LAST_NAMES)
        company = random.choice(COMPANIES)
        position = random.choice(POSITIONS)
        
        contact = {
            "First Name": first_name,
            "Last Name": last_name,
            "Full Name": f"{first_name} {last_name}",
            "Company": company,
            "Position": position,
            "LinkedIn URL": generate_linkedin_url(first_name, last_name, company)
        }
        contacts.append(contact)
    
    # Write to CSV
    with open(output_path, 'w', newline='', encoding='utf-8-sig') as csv_file:
        if contacts:
            fieldnames = contacts[0].keys()
            writer = csv.DictWriter(csv_file, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(contacts)
    
    print(f"Created sample CSV with {num_contacts} contacts at:")
    print(output_path)
    return output_path

if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Create a sample CSV file for enrichment testing")
    parser.add_argument("--count", "-c", type=int, default=20, help="Number of contacts to generate")
    
    args = parser.parse_args()
    create_sample_csv(args.count) 