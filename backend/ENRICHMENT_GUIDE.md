# Captely Cascade Enrichment System

This guide explains how to use the cascade enrichment system to enrich your LinkedIn Sales Navigator contacts with email and phone data from multiple providers.

## How It Works

The system uses a cost-efficient cascade approach:

1. LinkedIn contacts are processed sequentially through multiple data providers
2. Providers are ordered from cheapest to most expensive:
   - **Icypeas** (lowest cost per credit)
   - **Dropcontact** (low-medium cost)
   - **Hunter.io** (medium cost)
   - **Apollo** (highest cost)
3. The cascade stops when a high-confidence result is found
4. Results are stored in the database for later retrieval

This approach maximizes your results while minimizing costs by only using expensive services when necessary.

## Setting Up API Keys

Add your API keys to the `.env` file in the root directory:

```
HUNTER_API_KEY=your_hunter_key
DROPCONTACT_API_KEY=your_dropcontact_key
ICYPEAS_API_KEY=your_icypeas_key
ICYPEAS_API_SECRET=your_icypeas_secret
APOLLO_API_KEY=your_apollo_key
```

## Processing CSV Files

### Method 1: Using Docker Command

1. Place your CSV file in the `csv` directory
2. Run this command:

```bash
docker exec captely-enrichment-worker python -c "from enrichment.tasks import process_csv_file; process_csv_file('/app/csv/your_file.csv')"
```

### Method 2: Using the Enrichment Script

```bash
cd backend
python services/enrichment-worker/enrich_csv.py csv/your_file.csv
```

### CSV Format

Your CSV should have some of these columns (the system will try to normalize column names):
- First Name / Last Name (or Full Name)
- Company / Organization
- Title / Position
- LinkedIn URL
- Company Domain (optional)

## Monitoring

1. Access the Flower dashboard at http://localhost:5555
2. Use username `admin` and password `flowerpassword`
3. Monitor task progress and worker status

## Configuration Options

You can adjust the system behavior by modifying:
- `backend/services/common/config.py`: Change provider order, confidence thresholds
- `.env`: Update API keys and database settings

## Advanced Usage

### Adjusting Confidence Thresholds

The system has two main confidence thresholds:
- `minimum_confidence` (0.70): Minimum threshold to accept a result
- `high_confidence` (0.90): Threshold to stop the cascade early

You can adjust these in `backend/services/common/config.py`.

### Changing Provider Order

You can change the order of providers by modifying the `service_order` list in the config:

```python
self.service_order = ['icypeas', 'dropcontact', 'hunter', 'apollo']
```

### Rate Limiting

The system automatically respects each provider's rate limits:
- Icypeas: 60 requests/minute
- Dropcontact: 10 requests/minute
- Hunter: 20 requests/minute
- Apollo: 30 requests/minute

You can adjust these in `backend/services/enrichment-worker/enrichment/tasks.py`.

## Troubleshooting

- **CSV Not Found**: Make sure your CSV files are in the `csv` directory
- **Invalid CSV Format**: Ensure your CSV has the required columns
- **API Error**: Check your API keys in the `.env` file
- **No Results**: Try adjusting the confidence thresholds lower
- **Worker Not Running**: Make sure the Docker containers are running:
  ```bash
  docker-compose ps
  ```

## Database Tables

The system uses three main tables:
- `contacts`: Stores contact information
- `enrichment_results`: Stores individual provider results
- `import_jobs`: Tracks overall import progress 