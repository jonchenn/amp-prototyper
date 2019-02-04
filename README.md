# easy-amplify

## Getting started

### Usage

```
node run.js --url=[URL]
```

Required arguments:
*  --url=URL: URL to the page to convert.

### Options

*  --steps=FILE: Path to the custom steps JS file.
*  --moreSteps=FILE: Path to the more steps JS file.
*  --output=FILE: Path to the output file.
*  --verbose: Display AMP validation errors.

Examples:

```
# Amplify a page and generate results in /output folder.
node src/run.js --url=http://127.0.0.1:8080

# Amplify a page and generate results in /output/test folder.
node src/run.js --url=http://127.0.0.1:8080 --output=test

# Amplify a page with a custom steps.
node src/run.js --url=http://127.0.0.1:8080 --steps=custom/mysteps.js

# Amplify a page and display AMP validation details.
node src/run.js --url=http://127.0.0.1:8080 --verbose
```

## Reference
