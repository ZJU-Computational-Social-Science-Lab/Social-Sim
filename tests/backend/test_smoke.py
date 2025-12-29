from litestar.testing import TestClient

from socialsim4.backend.main import app


def test_healthcheck():
    client = TestClient(app)
    response = client.get("/api/config")
    assert response.status_code == 200
