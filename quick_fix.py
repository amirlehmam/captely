import psycopg2

# Connect to your DigitalOcean database
conn = psycopg2.connect('postgresql://captely:captely123@db-postgresql-fra1-42046-do-user-18496313-0.g.db.ondigitalocean.com:25060/captely')
cur = conn.cursor()

print('🔍 Current packages with invalid Stripe price IDs:')
cur.execute('SELECT name, display_name, stripe_price_id_monthly, stripe_price_id_annual FROM packages WHERE is_active = true ORDER BY credits_monthly;')
for row in cur.fetchall():
    print(f'  {row[1]} ({row[0]}): monthly={row[2]}, annual={row[3]}')

print('\n🧹 Clearing invalid Stripe price IDs...')
cur.execute('UPDATE packages SET stripe_price_id_monthly = NULL, stripe_price_id_annual = NULL WHERE is_active = true;')
conn.commit()

print('\n✅ Cleared all Stripe price IDs. Your billing service will now create new ones automatically.')
print('\n📦 Updated packages:')
cur.execute('SELECT name, display_name, price_monthly, price_annual FROM packages WHERE is_active = true ORDER BY credits_monthly;')
for row in cur.fetchall():
    print(f'  {row[1]} ({row[0]}): €{row[2]}/month, €{row[3]}/year')

conn.close()
print('\n🎯 Now try clicking "Buy this pack" - it should work!') 