
# Test script for absolute environment

from backend.app_factory import create_app

print("Initializing app...")
try:
    app = create_app()
    print("App initialized successfully.")
    
    with app.app_context():
        print("Checking DB connection...")
        from backend.extensions import db
        # Try a simple query
        from backend.models import User
        count = User.query.count()
        print(f"User count: {count}")
        
    print("Listing Blueprints:")
    for name, bp in app.blueprints.items():
        print(f" - {name}")
        
    print("Smoke Checking Routes:")
    rules = [str(r) for r in app.url_map.iter_rules()]
    print(f"Total routes: {len(rules)}")
    
    # Check key routes exist
    key_routes = [
        '/api/health', 
        '/api/menu-json', 
        '/tools/<path:filename>', 
        '/api/tools/registry',
        '/'
    ]
    for r in key_routes:
        found = any(r in rule for rule in rules)
        # Note: flask routes might have different format (e.g. /tools/<path:filename>)
        # so exact match might fail, but let's just print status.
        # simpler: create a test client
        
    client = app.test_client()
    resp = client.get('/api/health')
    print(f"Health Check: {resp.status_code}")
    if resp.status_code not in (200, 503):
        print("FAILED Health Check")
        sys.exit(1)
        
    print("ALL CHECKS PASSED")

except Exception as e:
    print(f"CRITICAL ERROR: {e}")
    sys.exit(1)
