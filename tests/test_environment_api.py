import pytest
import os
import sys


def test_environment_service_file_exists():
    """Test that the environment service file exists and is valid Python."""
    service_path = "src/socialsim4/backend/services/environment_suggestion_service.py"
    assert os.path.exists(service_path)
    # Check file can be parsed as Python
    with open(service_path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert "async def get_simulation_state" in content
    assert "async def generate_environment_suggestions" in content
    assert "async def broadcast_environment_event" in content


def test_environment_routes_file_exists():
    """Test that the environment routes file exists and is valid Python."""
    routes_path = "src/socialsim4/backend/api/routes/environment.py"
    assert os.path.exists(routes_path)
    # Check file can be parsed as Python
    with open(routes_path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert "async def get_suggestion_status" in content
    assert "async def generate_suggestions" in content
    assert "async def apply_environment_event" in content
    assert "router = Router" in content


def test_environment_routes_registered():
    """Test that environment routes are registered in __init__.py."""
    init_path = "src/socialsim4/backend/api/routes/__init__.py"
    with open(init_path, 'r', encoding='utf-8') as f:
        content = f.read()
    assert "environment" in content
    assert "environment.router" in content
