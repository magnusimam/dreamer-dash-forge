#!/bin/bash
# Dreamer Dash — Build & Deploy Script
# Usage: bash deploy.sh

set -e

echo "Building with Supabase env vars..."
VITE_SUPABASE_URL="https://stmgzykdildmlbvubtvs.supabase.co" \
VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0bWd6eWtkaWxkbWxidnVidHZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNDcxNzEsImV4cCI6MjA4OTYyMzE3MX0.e6pOI5lHZNsfbY211B-hWI9QBj-mXClbZVnEPSN0Wxo" \
npx vite build

echo "Copying vercel.json to dist..."
cp vercel.json dist/vercel.json

echo "Deploying to Vercel..."
cd dist && vercel --prod --yes

echo "Deploy complete!"
