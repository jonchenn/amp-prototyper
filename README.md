# amp-prototyper

This Node.js-based script is a prototyping tool that automatically converts a HTML page to a [Accelerated Mobile Page (AMP)](https://amp.dev) to demonstrate performance gains with AMP. It follows [the general guideline of converting HTML to AMP](https://amp.dev/documentation/guides-and-tutorials/start/converting/).

## TL;DR

- The goal is to showcase the advantages of AMP in page load performance.
- It generates a converted AMP HTML, a screenshot, and AMP validation errors for each step.
- It automatically converts a HTML page to AMP with pre-defined steps. You can customize the steps for specific scenarios.
- Final output contains image comparison and match percentage to original URL. Remove the watermark from the HTML and manually review the output

## What is amp-prototyper

The main goal is to minimize the effort of creating a prototype AMP page from a canonical HTML page, such as adding AMP boilerplate, removing custom Javascript, making all CSS inline, etc. The output of this tool includes converted AMP, the screenshot, and AMP validation errors for each conversion step.

This script uses [puppeteer](https://github.com/GoogleChrome/puppeteer) to load and render pages.

## Non-scope

This tool doesn't aim to create production-ready AMP pages from any arbitrary HTML pages. If your goal is to create high-quality AMP pages for production, please follow [the general guideline of converting HTML to AMP](https://amp.dev/documentation/guides-and-tutorials/start/converting/).

## Getting started

To run the script, you may choose one of the following methods:

#### npx

Run the script directly with npx:

```
npx amp-prototyper [URL]
```

- `URL` - URL to the page to convert.

#### npm or yarn

Install amp-prototyper package.

```
git clone https://github.com/jonchenn/amp-prototyper.git
cd amp-prototyper
yarn install
```

Then, run the script.
```
./amp-prototyper [URL]
```

### Usage

```
./amp-prototyper [URL]
```

Required arguments:

- `URL` - URL to the page to convert.

### Options

- `--steps=FILE` - Path to the custom steps JS file. If not defined, it will use ./steps/default-steps.js
- `--output=FILE` - Path to the output file.
- `--device=DEVICE_NAME` - Use specific device name for screenshots.
- `--headless=(true|false)` - Whether to show browser.
- `--fullPageScreenshot=(true|false*)` - tWhether to save full-page screenshots.
- `--compareScreenshots=(true|false*)` - Whether to compare original site with converted.
- `--customHost=HOST` - Use a custom host name when updating relative asset URLs.
- `--port=PORT_NUMBER` - Port number to use to compare before and after (defaults to 8080)
- `--verbose` - Display AMP validation errors.

### Examples:

```
# Amplify a page and generate results in /output folder.
./amp-prototyper https://thinkwithgoogle.com

# Amplify a page and generate results in /output/test folder.
./amp-prototyper https://thinkwithgoogle.com --output=test

# Amplify a page with customized steps.
./amp-prototyper https://thinkwithgoogle.com --steps=custom/mysteps.js

# Amplify a page and display AMP validation details.
./amp-prototyper https://thinkwithgoogle.com --verbose

# Amplify a page and generate screenshots with specific Device.
./amp-prototyper https://thinkwithgoogle.com --device='Pixel 2'

# Amplify a page and display browser.
./amp-prototyper https://thinkwithgoogle.com --headless=false

# Amplify a page and compare original site with converted.
./amp-prototyper https://thinkwithgoogle.com --compareScreenshots=true

# Amplify a page that served from localhost and generate results with correct absolute URLs for assets.
./amp-prototyper https://thinkwithgoogle.com --customHost=https://example.com
```

### Test with a sample HTML.

You can also run a sample HTML with following:

```
# Run a localhost web server using http-server.
yarn sample
```

This opens up a localhost web server at <http://127.0.0.1:8080> by default that serves [test/index.html](https://github.com/jonchenn/amp-prototyper/blob/master/test/index.html). This is a quick and simple HTML page to test amp-prototyper. You can run the following to see how amp-prototyper works. (If localhost has trouble connecting to the port, add the --port flag with a different port number)

```
# Amplify the page at localhost and output in sample/ folder.
./amp-prototyper http://127.0.0.1:8080 --output=sample
```

Then, check out the `./output/sample`, and you will see a list of output files.

## Output of each step

When you run the script, it follows predefined steps, either default steps at [src/default-steps.js](https://github.com/jonchenn/amp-prototyper/blob/master/src/default-steps.js), or customized steps.

You can amplify a HTML page with default steps:

```
# Amplify a page with default steps.
./amp-prototyper http://127.0.0.1:8080
```

Or run amplify a page with customized steps:

```
# Amplify a page with customized steps.
./amp-prototyper http://127.0.0.1:8080 --steps=custom/mysteps.js
```

At each step, it executes a set of actions and writes the files below to the output/ folder:

- `output-step-[STEP_ID].html` - the modified HTML.
- `output-step-[STEP_ID].png` - the screenshot after this step.
- `output-step-[STEP_ID]-validation.txt` (only with --verbose) - AMP validation errors from console output.

If you don't specify --output, it uses the domain from the given URL as the name of the output folder.

### Verify your output

You can run the following command to run a simple web server locally to serve your output files.

```
yarn output
```

Open up the localhost URL with a browser. For example: <http://127.0.0.1:8080>

Check the image comparsion to see visual differences in the original URL and AMP HTML

Remove the watermark in the AMP HTML and review the code for additional changes/AMP validation error fixes

### Caveats

- Styles from '@import' media queries must be manually added
- HTML containing ShadowDOMs and nested ShadowDOMS are unsupported

## Customize steps

### Structure of steps

You can check out the default steps at [src/default-steps.js](https://github.com/jonchenn/amp-prototyper/blob/master/src/default-steps.js).

Each step follows the structure below.

```
{
  name: 'Name of the step',
  actions: [{
    skip: false,
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

- `name` <[string]> Step name.
- `actions` <[Array]<[Action]()>> actions to execute.
- `skip` <[boolean]> Whether to skip this step.

Common properties of an action:

- `actionType` <string]> Action type.
- `log` <[string]> Message output of this action.
- `waitAfterLoaded` <[number]> Wait for a specific milliseconds after the page loaded.

### Environment Variables

You can also use the following EnvVars in the steps configuration.

- `$URL` <[string]> The URL from the `--url` parameter.
- `$HOST` <[string]> The host derived from the URL.
- `$DOMAIN` <[string]> The domain derived from the URL.

For example, you have a step like below:

```
{
  name: 'Name of the step',
  actions: [{
    log: 'Log output for this action',
    actionType: 'replace',
    selector: 'html',
    regex: '<div(.*)>(.*)</div>',
    replace: '<span$1>$HOST</span>',
  }],
},
```

While running the script with `https://example.com`, it replaces """$HOST""" with "<https://example.com">.

### Supported actions:

#### setAttribute

Set an attribute to a specific element.

- `selector` <[string]> target element.
- `attribute` <[string]> attribute to ad.
- `value` <[string]> the attribute value.

#### removeAttribute

Remove an attribute to a specific element.

- `selector` <[string]> target element.
- `attribute` <[string]> attribute to remove.
#### replace

Use Regex to find and replace in the DOM.

- `selector` <[string]> target element.
- `regex` <[string]> Regex string to match.
- `replace` <[string]> Replace matches with this string.
#### removeDisallowedAttribute

Remove an attribute to specific elements based on AMP validation errors.

- `selector` <[string]> target element.
#### replaceBasedOnAmpErrors

Use Regex to find and replace in the DOM based on AMP validation errors.

- `selector` <[string]> target element.
- `ampErrorRegex` <[string]> Regex string to match for AMP validation errors.
- `regex` <[string]> Regex string to match.
- `replace` <[string]> Replace matches with this string.
For example, in a specific step it has the following AMP validation errors.

```
line 61, col 4: The attribute 'onclick' may not appear in tag 'button'.
line 70, col 4: The tag 'custom-tag' is disallowed.
```

To replace the

<custom-tag> in the body based on the AMP validation result, you
can have the following step:</custom-tag>

```
{
  name: 'Convert disallowed tags to <div> based on AMP validation result.',
  actions: [{
    log: 'Change tags to <div>',
    actionType: 'replaceBasedOnAmpErrors',
    selector: 'body',
    ampErrorRegex: 'The tag \'([^\']*)\' is disallowed',
    regex: '<($1)((.|[\\r\\n])*)</$1>',
    replace: '<div data-original-tag="$1" $2</div>',
  }],
}
```

This step matches the AMP validation result with `ampErrorRegex`. Then it replace the `regex` with the capturing group #1 from `ampErrorRegex`. In this case, the `regex` becomes:

```
<(custom-tag)((.|[\\r\\n])*)</custom-tag>
```

Finally, it uses the revised `regex` to replace the content with `replace` value.

#### replaceOrInsert

Use Regex to find and replace in the DOM. If not found, insert to the destination element.

- `selector` <[string]> target element.
- `regex` <[string]> Regex string to match.
- `replace` <[string]> Replace matches with this string.
#### insert

Insert a string to the bottom of the destination element. E.g. adding a string to the bottom of the .

- `selector` <[string]> target element.
- `value` <[string]> the string to insert.
- `destSelector` <[string]> destination element.
#### move

Move elements to the bottom of the destination element. E.g. moving all

<link>

 to the bottom of the .

- `selector` <[string]> target element.
- `destSelector` <[string]> destination element.
#### appendAfter

Append a string right after a specific element.

- `selector` <[string]> target element.
- `value` <[string]> the string to append.
#### inlineExternalStyles

Collect all external CSS and append a `<style>` tag with inline CSS.

- `selector` <[string]> target element to append the CSS.
- `value` <[string]> the string to append.
- `excludeDomains` <[Array]<[string]>> the array of excluded domains. E.g. [&#39;examples.com&#39;] excludes all CSS loaded from <code>examples.com</code>.
- `minify` <[boolean]> whether to minify CSS.
- `attributes` <[Array]<[string]>> add attributes when appending `<style>` tag.

#### removeUnusedStyles

Remove unused CSS using [clean-css](https://github.com/jakubpawlowicz/clean-css) and [purifycss](https://github.com/purifycss/purifycss).

- `selector` <[string]> target element.
- `value` <[string]> the string to append.

#### customFunc

Run the action with a custom function. Example:

An action object:
```
  {
    log: &#39;Click a button&#39;,
    actionType: &#39;customFunc&#39;,
    customFunc: async (action, sourceDom, page) =&gt; {
      await page.click(&#39;button#summit&#39;);
    },
  }],
},
```

In the custom function, there are three arguments:

- `action` <[ActionObject]> the action object itself.
- `sourceDom` <[DOM document]> the raw DOM document object before rendering, as in the View Source in Chrome.
- `page` <[puppeteer Page object]> The page object in puppeteer.

### Customize steps

To customize your own steps for specific scenarios, create a .js file like below:

```
module.exports = [
  {
    name: &#39;Remove unwanted styles&#39;,
    actions: [{
      log: &#39;Remove inline styles in body&#39;,
      actionType: &#39;replace&#39;,
      selector: &#39;body&#39;,
      regex: &#39;(&lt;!--)?.*&lt;style[^&lt;]*(?:(?!&lt;\/style&gt;)&lt;[^&lt;]*)*&lt;\/style&gt;.*(--&gt;)?&#39;,
      replace: &#39;&#39;,
    }, {
      log: &#39;Remove noscript in body&#39;,
      actionType: &#39;replace&#39;,
      selector: &#39;body&#39;,
      regex: &#39;(&lt;!--)?.*&lt;noscript[^&lt;]*(?:(?!&lt;\/noscript&gt;)&lt;[^&lt;]*)*&lt;\/noscript&gt;.*(--&gt;)?&#39;,
      replace: &#39;&#39;,
    }],
  }, {
    ...
  }
];
```

Next, run the script with `--steps=/path/to/mysteps.js`

```
# Amplify a page with customized steps.
./amp-prototyper http://127.0.0.1:8080 --steps=/path/to/mysteps.js
```

## Use cases with specific conditions

### Sites with Crawler Protection

Since AMP-prototyper is built with [Puppeteer](https://github.com/GoogleChrome/puppeteer) to fetch a page content, some sites may treat this as a crawler or bot, and thus block the access. You may see a different content (e.g. 404 page or timeout) than the regular page content.

The blocking logic usually resides in the web hosting servers. Hence, there's no easy way to overcome. However, you can try the following options:

#### Option 1 - Set headless=false

Some sites may treat puppeteer activities as crawler if it runs in the headless mode. You can try running with headless off, and puppeteer will show the browser window like browsing by a real user.

```
# Amplify a page without headless mode.
./amp-prototyper http://127.0.0.1:8080 --headless=false
```

#### Option 2 - Serve the page locally

Another option to bypass crawler-protection is to download the page and serve the page from a local web server. (E.g. [http-server](https://www.npmjs.com/package/http-server))

For example, you can save the index page of [ThinkWithGoogle.com](https://www.thinkwithgoogle.com) and serve it locally.  It's recommended to copy the **page source** directly instead of using a browser's Save function to avoid unexpected artifacts by the browser.

Since the host is now `localhost` instead of its original host (www.thinkwithgoogle.com), all relative asset paths would incorrectly end up with localhost. Hence, we need to pass `--customHost` to restore its true remote host for asset URLs.

```
# Assuming that the index page is saved to ./tmp/web/index.html

npm i http-server -g
http-server ./tmp/web -p 3000
```

In a new terminal:

```
./amp-prototyper http://127.0.0.1:3000 --customHost=https://www.thinkwithgoogle.com
```

## Reference

[puppeteer](https://github.com/GoogleChrome/puppeteer)
[clean-css](https://github.com/jakubpawlowicz/clean-css)
[purifycss](https://github.com/purifycss/purifycss)
