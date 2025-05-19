# Captely - Cascade Enrichment System

This service provides a powerful data enrichment system for B2B contact information. It takes LinkedIn Sales Navigator contacts and enriches them with email addresses and phone numbers using multiple data providers in a cascade approach.

## How It Works

1. The system processes CSV files containing contact information (name, company, LinkedIn URL, etc.)
2. For each contact, it sequentially tries multiple enrichment services until it finds valid contact information
3. Each service is called in order of priority and reliability:
   - Icypeas
   - DropContact
   - Hunter.io
   - Apollo.io
4. The system stops searching once it finds a high-confidence email address
5. If no high-confidence result is found, it returns the best available match
6. All results are combined into a single enriched CSV file

## Quick Start

**Windows Users:**
1. Simply double-click the `run_enrichment.bat` file
2. Follow the on-screen prompts
3. Your enriched CSV files will be saved in the same directory as the originals with "_enriched" added to the filename

**Command Line Users:**
```bash
# Navigate to the enrichment-worker directory
cd backend/services/enrichment-worker

# Run the enrichment process
python run_enrichment.py

# OR to process only a specific number of leads per file
MAX_LEADS=10 python run_enrichment.py
```

## Input Files

Place your CSV files in the `backend/csv` directory. The files should have these columns:
- First Name
- Last Name
- Full Name
- Position
- Company
- LinkedIn URL
- Location
- Industry

You can export these directly from LinkedIn Sales Navigator.

## Features

- **Intelligent Cascading**: Tries multiple providers in sequence to maximize data coverage
- **Confidence Scoring**: Evaluates the quality of each result to prioritize reliable data
- **Rate Limiting**: Respects API limits for each provider
- **Progress Tracking**: Monitors success rate and enrichment progress
- **Smart Error Handling**: Gracefully handles API errors and retries where appropriate
- **Intermediate Results**: Saves partial results during processing to prevent data loss

## Configuration

The system uses API keys for the following services:
- Hunter.io
- DropContact
- Icypeas
- Apollo.io

These keys are stored in the `enrichment_cascade.py` file. If you need to update them, edit the `API_KEYS` dictionary.

## Troubleshooting

### Connection Issues
- If you encounter connection issues with a specific provider, the system will automatically skip it and try the next one
- Check your internet connection if all providers fail
- Verify that your API keys are correct and have sufficient credits

### CSV Format Issues
- Ensure your CSV files have the required columns
- If you export from LinkedIn Sales Navigator, the format should be compatible
- For custom CSV files, make sure the column names match exactly

### Long Processing Times
- The enrichment process may take time, especially for large files
- The system shows progress updates and estimated completion times
- You can process a smaller batch by setting the `MAX_LEADS` environment variable

### File Access Issues
- Make sure you have write permissions to the CSV directory
- Close any open CSV files before running the enrichment process

## Success Metrics

The system aims to achieve:
- 85-90% email discovery rate
- Efficient API usage to minimize costs
- Fast processing through intelligent service orchestration

## Support

If you encounter any issues, please check the log files in the `logs` directory for detailed error information. 