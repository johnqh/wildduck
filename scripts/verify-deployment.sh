#!/bin/bash

# Deployment verification script
VERSION=${1:-$(node -p "require('./package.json').version")}
PACKAGE_NAME="@johnqh/wildduck"
DOCKER_IMAGE="johnqh/wildduck"

echo "🔍 Verifying deployment for version: $VERSION"
echo "================================================"

# Check NPM
echo -n "📦 NPM Package: "
if npm view $PACKAGE_NAME@$VERSION version &>/dev/null; then
    echo "✅ Published"
else
    echo "❌ Not found"
fi

# Check Docker Hub
echo -n "🐳 Docker Image: "
if docker manifest inspect $DOCKER_IMAGE:v$VERSION &>/dev/null; then
    echo "✅ Available"
else
    echo "❌ Not found"
fi

# Check GitHub Release
echo -n "🏷️  GitHub Release: "
if curl -s https://api.github.com/repos/johnqh/wildduck/releases/tags/v$VERSION | grep -q "tag_name"; then
    echo "✅ Created"
else
    echo "❌ Not found"
fi

echo "================================================"
echo "✅ Verification complete!"