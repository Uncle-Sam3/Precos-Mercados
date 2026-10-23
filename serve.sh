#!/bin/sh
# Abre o site localmente em http://localhost:8080
cd "$(dirname "$0")/site" && python3 -m http.server 8080
