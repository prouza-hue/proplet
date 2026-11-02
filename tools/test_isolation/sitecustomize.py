"""Auto-loaded only by tools/test_current.py's isolated subprocess environment."""
import os
if os.environ.get('PROPLET_TEST_ISOLATED') == '1':
    from network_guard import install
    install()
