#!/bin/bash

# Extract dependencies and devDependencies from package.json
DEPS=$(jq -r '.dependencies, .devDependencies | to_entries[] | select(.value | test("\\^")) | "\(.key): \(.value)"' package.json)

if [ -n "$DEPS" ]; then
    echo "❌ Found dependencies using caret (^):"
    echo "$DEPS"
    exit 1 # Fail the CI
else
    echo "✅ All dependencies are locked (no caret ^ versions)."
fi
