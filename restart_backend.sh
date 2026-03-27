#!/bin/bash
# Script to clean Python cache and restart backend

echo "Cleaning Python cache..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find . -type f -name "*.pyc" -delete 2>/dev/null

echo "Starting backend..."
cd "C:\Users\Justin\Documents\ZJU_Work\Social-Sim"
export PYTHONPATH="C:\Users\Justin\Documents\ZJU_Work\Social-Sim\src"
uvicorn socialsim4.backend.main:app --reload --host 0.0.0.0 --port 8000
