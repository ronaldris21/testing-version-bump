# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

# Check if .npmrc exists
if [ ! -f ".npmrc" ]; then
  echo "//npm.pkg.github.com/:_authToken=\${GH_TOKEN}" >> .npmrc
  echo "@the-data-quality-co-op:registry=https://npm.pkg.github.com/" >> .npmrc
fi

# Replace the placeholder with the actual token
sed -i.back "s|\${GH_TOKEN}|${GH_TOKEN}|g" .npmrc

# Remove the .npmrc.back file
rm .npmrc.back