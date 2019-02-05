# easy-amplify

This Node.js-based script aims for automating the process of making a HTML page
to a [Accelerated Mobile Page (AMP)](https://www.ampproject.org). It follows
[the general guideline of converting HTML to AMP](https://www.ampproject.org/docs/fundamentals/converting).

### TL;DR

* It automatically converts a HTML page to AMP with pre-defined steps.
* It generates a converted AMP, a screenshot, and AMP validation errors for each step.
* You can customize steps for specific scenarios.

### What is easy-amplify

The main goal is to minimize the effort of converting HTML to AMP, including
adding AMP boilerplate, removing custom Javascript, making all CSS inline, etc.

However, as there are many edge cases when converting a HTML to AMP, this
project doesn't aim for creating an ultimate tool that perfectly converts any
HTML page to AMP. Instead, the outcome of this tool includes converted AMP,
the screenshot, and AMP validation errors for each step.

This script uses [puppeteer](https://github.com/GoogleChrome/puppeteer) to load
and render pages.

## Getting started

Run the following to run the script locally.

```
git clone git@github.com:jonchenn/easy-amplify.git
cd easy-amplify
yarn install
```

### Usage

```
yarn start --url=[URL]
```

Required arguments:
*  --url=URL: URL to the page to convert.

### Options

*  --steps=FILE: Path to the custom steps JS file.
*  --moreSteps=FILE: Path to the more steps JS file.
*  --output=FILE: Path to the output file.
*  --verbose: Display AMP validation errors.

### Examples:

```
# Amplify a page and generate results in /output folder.
yarn start --url=http://127.0.0.1:8080

# Amplify a page and generate results in /output/test folder.
yarn start --url=http://127.0.0.1:8080 --output=test

# Amplify a page with customized steps.
yarn start --url=http://127.0.0.1:8080 --steps=custom/mysteps.js

# Amplify a page and display AMP validation details.
yarn start --url=http://127.0.0.1:8080 --verbose
```

### Test with a sample HTML.

You can also run a sample HTML with following:

```
# Run a localhost web server using http-server.
yarn test
```

This opens up a localhost web server at http://127.0.0.1:8080 by default that
serves [test/index.html](https://github.com/jonchenn/easy-amplify/blob/master/test/index.html).
This is a quick and simple HTML page to test easy-amplify.

## Output of each step

When you run the script, it follows predefined steps, either default steps
at [src/default-steps.js](https://github.com/jonchenn/easy-amplify/blob/master/src/default-steps.js), or customized steps.

You can amplify a HTML page with default steps:

```
# Amplify a page with default steps.
yarn start --url=http://127.0.0.1:8080
```

Or run amplify a page with customized steps:

```
# Amplify a page with customized steps.
yarn start --url=http://127.0.0.1:8080 --steps=custom/mysteps.js
```

At each step, it executes a set of actions and writes the files below to the
output/ folder:
* output-step-[STEP_ID].html - the modified HTML.
* output-step-[STEP_ID].png - the screenshot after this step.
* (With --verbose) output-step-[STEP_ID]-log.txt - AMP validation errors from console output.

## Customize steps

### Structure of steps

You can check out the default steps at [src/default-steps.js](https://github.com/jonchenn/easy-amplify/blob/master/src/default-steps.js).

Each step follows the structure below.

```
{
  name: 'Name of the step',
  actions: [{
    log: 'Log output for this action',
    actionType: 'replace',
    selector: 'html',
    regex: '<div(.*)>(.*)</div>',
    replace: '<span$1>$2</span>',
  }, {
    ...
  }],
},

```

Step properties:

* `name` <string> - Step name.
* `actions`<Array<[Action]()>> - actions to execute.
* `skip` <boolean> - Whether to skip this step.

### Supported actions:

Common properties of an action:

* `log` <string> - Message output of this action.
* `waitAfterLoaded` <int> - Wait for a specific milliseconds after the page loaded.

#### setAttribute

Set an attribute to a specific element.

#### replace

Use Regex to find and replace in the DOM.

#### replaceOrInsert

Use Regex to find and replace in the DOM. If not found, insert to the destination element.

#### insertBottom

Insert a string to a specific element.

#### appendAfter

Append a string right after a specific element.

#### inlineExternalStyles

Collect all external styles and add as inline styles.

#### removeUnusedStyles

Remove unused CSS using [clean-css](https://github.com/jakubpawlowicz/clean-css) and [purifycss](https://github.com/purifycss/purifycss).

#### customFunc

Run the action with a custom function. Example:

```
  # An action object.
  {
    log: 'Click a button',
    actionType: 'customFunc',
    waitAfterLoaded: 1000,
    customFunc: async (action, sourceDom, page) => {
      await page.click('button#summit');
    },
  }],
},

```

In the custom function, there are three arguments:

* `action` <ActionObject> - the action object itself.
* `sourceDom` <DOM document> - the raw DOM document object before rendering, as in the View Source in Chrome.
* `page` <puppeteer Page object> - The page object in puppeteer.

### Creating your customized steps

TBD

## Reference

* [puppeteer](https://github.com/GoogleChrome/puppeteer)
* [clean-css](https://github.com/jakubpawlowicz/clean-css)
* [purifycss](https://github.com/purifycss/purifycss)
