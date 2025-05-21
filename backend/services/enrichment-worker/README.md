# Captely Enrichment Worker

A cost-optimized cascading enrichment system for LinkedIn contact data.

## Overview

This service enhances LinkedIn contact data with email addresses and phone numbers using multiple data providers in a cost-efficient cascade. It tries the cheapest providers first and only progresses to more expensive ones if necessary.

## Key Features

- **Cost Optimization**: Services ordered by cost (cheapest first)
- **Early Termination**: Stops cascade once high-confidence results are found
- **Rate Limiting**: Respects API rate limits to prevent throttling
- **Reliability**: Automatic retries and error handling
- **Monitoring**: Flower dashboard to track progress

## Architecture

```
┌───────────┐
│           │
│ CSV Files │─────┐
│           │     │
└───────────┘     ▼
                ┌─────────────────┐       ┌─────────────┐
                │                 │       │             │
                │ Enrichment      │◄──────┤ Redis Queue │
                │ Worker          │       │             │
                │                 │       └─────────────┘
                └─────────────────┘
                      │   │
         ┌────────────┘   └────────────┐
         ▼                             ▼
┌──────────────────┐          ┌─────────────────┐
│                  │          │                 │
│ Cheapest         │          │ Most Expensive  │
│ Provider APIs    │───...────┤ Provider APIs   │
│ (Icypeas, etc.)  │          │ (Apollo, etc.)  │
│                  │          │                 │
└──────────────────┘          └─────────────────┘
               │                      │
               └──────────┬───────────┘
                          ▼
                  ┌───────────────┐
                  │               │
                  │ PostgreSQL    │
                  │ Database      │
                  │               │
                  └───────────────┘
```

## Setup

### Prerequisites

- Docker & Docker Compose
- API keys for enrichment services:
  - Icypeas (API key + secret)
  - Dropcontact
  - Hunter.io
  - Apollo

### Configuration

1. Set your API keys in the `.env` file in the root directory:

```
HUNTER_API_KEY=your_hunter_key
DROPCONTACT_API_KEY=your_dropcontact_key
ICYPEAS_API_KEY=your_icypeas_key
ICYPEAS_API_SECRET=your_icypeas_secret
APOLLO_API_KEY=your_apollo_key
```

2. Start the services:

```bash
cd backend
docker-compose up -d
```

3. Verify the services are running:

```bash
docker-compose ps
```

## Usage

### Processing CSV Files

1. Place your CSV file in the `csv` directory at the root of the project.

2. Run the enrichment process:

```bash
# From the backend directory
python services/enrichment-worker/enrich_csv.py csv/your_file.csv
```

Or directly using Docker:

```bash
docker exec captely-enrichment-worker python -c "from enrichment.tasks import process_csv_file; process_csv_file('/app/csv/your_file.csv')"
```

### Monitoring

Access the Flower dashboard at http://localhost:5555 to monitor task progress and worker status.

Username: `admin`  
Password: `flowerpassword`

## Customization

### Adjusting Provider Order

Modify the `service_order` list in `common/config.py`:

```python
self.service_order = ['icypeas', 'dropcontact', 'hunter', 'apollo']
```

### Changing Confidence Thresholds

Modify these values in `common/config.py`:

```python
self.minimum_confidence = 0.70  # Minimum threshold to accept a result
self.high_confidence = 0.90     # Threshold to stop the cascade early
```

## Troubleshooting

- **CSV Not Found**: Ensure your CSV is in the correct `csv` directory
- **Invalid CSV Format**: Check your CSV has the required columns
- **API Error**: Verify your API keys in the `.env` file
- **Worker Not Running**: Check Docker container status with `docker-compose ps`
- **Database Issues**: Make sure the database tables are created properly

## Database Schema

The system uses three main tables:

- `contacts`: Stores contact information
- `enrichment_results`: Stores individual provider results
- `import_jobs`: Tracks overall import progress

## Development

### Local Development Setup

1. Create a virtual environment:

```bash
cd services/enrichment-worker
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Run the Celery worker:

```bash
celery -A enrichment.tasks worker -l info
```

### Running Tests

```bash
pytest
```

## License

This project is licensed under the MIT License. 