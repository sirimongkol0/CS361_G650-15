"""Wait up to 60 seconds for the isolated V2 API and frontend."""
import os
import time
from urllib.request import urlopen

urls = [os.environ.get('TEST_API_URL', 'http://127.0.0.1:8126/api/v1') + '/health',
        os.environ.get('TEST_FRONTEND_URL', 'http://localhost:3126') + '/stakeholders']
deadline = time.monotonic() + 60
while time.monotonic() < deadline:
    try:
        for url in urls:
            with urlopen(url, timeout=2) as response:
                if response.status != 200:
                    raise RuntimeError('Server not ready')
        print('V2 API and frontend are ready')
        break
    except Exception:
        time.sleep(1)
else:
    raise SystemExit('V2 API or frontend did not become ready within 60 seconds')
