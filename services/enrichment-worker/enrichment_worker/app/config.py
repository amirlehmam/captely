# config.py
def get_settings():
    # return your settings here
    return {
        'DATABASE_URL': 'postgres://user:password@db/captely',
        'CELERY_BROKER_URL': 'redis://localhost:6379/0',
        # other settings as required
    }
