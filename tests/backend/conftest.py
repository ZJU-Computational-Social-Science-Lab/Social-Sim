"""
Shared pytest fixtures for backend tests.
"""

import pytest
from litestar.testing import TestClient

from socialsim4.backend.main import app


@pytest.fixture
def client() -> TestClient:
    """Create a test client for the Litestar application."""
    return TestClient(app)
