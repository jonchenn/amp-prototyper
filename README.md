# amp-prototyper

This Node.js-based script is a prototyping tool that automatically converts a HTML page to a [Accelerated Mobile Page (AMP)](https://amp.dev) to demonstrate performance gains with AMP. It follows [the general guideline of converting HTML to AMP](https://amp.dev/documentation/guides-and-tutorials/start/converting/).

## TL;DR

- The goal is to showcase the advantages of AMP in page load performance.
- It generates a converted AMP HTML, a screenshot, and AMP validation errors for each step.
- It automatically converts a HTML page to AMP with pre-defined steps. You can customize the steps for specific scenarios.

## What is amp-prototyper

The main goal is to minimize the effort of creating a prototype AMP page from a canonical HTML page, such as adding AMP boilerplate, removing custom Javascript, making all CSS inline, etc. The output of this tool includes converted AMP, the screenshot, and AMP validation errors for each conversion step.

This script uses [puppeteer](https://github.com/GoogleChrome/puppeteer) to load and render pages.

## Non-scope

This tool doesn't aim to create production-ready AMP pages from any arbitrary HTML pages. If your goal is to create high-quality AMP pages for production, please follow [the general guideline of converting HTML to AMP](https://amp.dev/documentation/guides-and-tutorials/start/converting/).

## Getting started

Run the following to run the script locally.

```
git clone https://github.com/jonchenn/amp-prototyper.git
cd amp-prototyper
yarn install
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
- `--verbose` - Display AMP validation errors.

### Examples:

```
# Amplify a page and generate results in /output folder.
./amp-prototyper http://127.0.0.1:8080

# Amplify a page and generate results in /output/test folder.
./amp-prototyper http://127.0.0.1:8080 --output=test

# Amplify a page with customized steps.
./amp-prototyper http://127.0.0.1:8080 --steps=custom/mysteps.js

# Amplify a page and display AMP validation details.
./amp-prototyper http://127.0.0.1:8080 --verbose

# Amplify a page and generate screenshots with specific Device.
./amp-prototyper http://127.0.0.1:8080 --device='Pixel 2'

# Amplify a page and display browser.
./amp-prototyper http://127.0.0.1:8080 --headless=false
```

### Test with a sample HTML.

You can also run a sample HTML with following:

```
# Run a localhost web server using http-server.
yarn sample
```

This opens up a localhost web server at <http://127.0.0.1:8080> by default that serves [test/index.html](https://github.com/jonchenn/amp-prototyper/blob/master/test/index.html). This is a quick and simple HTML page to test amp-prototyper. You can run the following to see how amp-prototyper works.

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
- `output-step-[STEP_ID]-log.txt` (only with --verbose) - AMP validation errors from console output.

If you don't specify --output, it uses the domain from the given URL as the name of the output folder.

### Verify your output

You can run the following command to run a simple web server locally to serve your output files.

```
yarn output
```

Open up the localhost URL with a browser. For example: <http://127.0.0.1:8080>

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

- `name`

  <string> - Step name.</string>

- `actions`<Array<[Action]()>> - actions to execute.
- `skip`

  <boolean> - Whether to skip this step.</boolean>

Common properties of an action:

- `actionType`

  <string> - Action type.</string>

- `log`

  <string> - Message output of this action.</string>

- `waitAfterLoaded`

  <int> - Wait for a specific milliseconds after the page loaded.</int>

### Environment Variables

You can also use the following EnvVars in the steps configuration.

- `$URL`

  <string> - The URL from the --url parameter.</string>

- `$HOST`

  <string> - The host derived from the URL.</string>

- `$DOMAIN`

  <string> - The domain derived from the URL.</string>

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

- `log`

  <string> - Message output of this action.</string>

- `waitAfterLoaded`

  <int> - Wait for a specific milliseconds after the page loaded.</int>

#### replace

Use Regex to find and replace in the DOM.

- `selector`

  <string> - target element.</string>

- `regex`

  <string> - Regex string to match.</string>

- `replace`

  <string> - Replace matches with this string.</string>

#### replaceBasedOnAmpErrors

Use Regex to find and replace in the DOM based on AMP validation errors.

- `selector`

  <string> - target element.</string>

- `ampErrorRegex`

  <string> - Regex string to match for AMP validation errors.</string>

- `regex`

  <string> - Regex string to match.</string>

- `replace`

  <string> - Replace matches with this string.</string>

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

- `selector`

  <string> - target element.</string>

- `regex`

  <string> - Regex string to match.</string>

- `replace`

  <string> - Replace matches with this string.</string>

#### insert

Insert a string to the bottom of the destination element. E.g. adding a string to the bottom of the .

- `selector`

  <string> - target element.</string>

- `value`

  <string> - the string to insert.</string>

- `destSelector`

  <string> - destination element.</string>

#### move

Move elements to the bottom of the destination element. E.g. moving all

<link>

 to the bottom of the .

- `selector`

  <string> - target element.</string>

- `destSelector`

  <string> - destination element.</string>

#### appendAfter

Append a string right after a specific element.

- `selector`

  <string> - target element.</string>

- `value`

  <string> - the string to append.</string>

#### inlineExternalStyles

Collect all external CSS and append a

<style> tag with inline CSS.</p>
<ul>
<li><code>selector</code> <string> - target element to append the CSS.</li>
<li><code>value</code> <string> - the string to append.</li>
<li><code>excludeDomains</code> &lt;Array<string>&gt; - the array of excluded domains. E.g. <code>[&#39;examples.com&#39;]</code> excludes all CSS loaded from <code>examples.com</code>.</li>
<li><code>minify</code> <boolean> - whether to minify CSS.</li>
<li><code>attributes</code> &lt;Array<string>&gt; - add attributes when appending <style> tag.</li>
</ul>
<h4 id="removeunusedstyles">removeUnusedStyles</h4>
<p>Remove unused CSS using <a href="https://github.com/jakubpawlowicz/clean-css">clean-css</a> and <a href="https://github.com/purifycss/purifycss">purifycss</a>.</p>
<ul>
<li><code>selector</code> <string> - target element.</li>
<li><code>value</code> <string> - the string to append.</li>
</ul>
<h4 id="customfunc">customFunc</h4>
<p>Run the action with a custom function. Example:</p>
<pre><code>  # An action object.
  {
    log: &#39;Click a button&#39;,
    actionType: &#39;customFunc&#39;,
    customFunc: async (action, sourceDom, page) =&gt; {
      await page.click(&#39;button#summit&#39;);
    },
  }],
},
</code></pre><p>In the custom function, there are three arguments:</p>
<ul>
<li><code>action</code> <ActionObject> - the action object itself.</li>
<li><code>sourceDom</code> <DOM document> - the raw DOM document object before rendering, as in the View Source in Chrome.</li>
<li><code>page</code> <puppeteer Page object> - The page object in puppeteer.</li>
</ul>
<h3 id="customize-steps">Customize steps</h3>
<p>To customize your own steps for specific scenarios, create a .js file like below:</p>
<pre><code>module.exports = [
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
</code></pre><p>Next, run the script with <code>--steps=/path/to/mysteps.js</code>:</p>
<pre><code># Amplify a page with customized steps.
./amp-prototyper http://127.0.0.1:8080 --steps=/path/to/mysteps.js
</code></pre><h2 id="reference">Reference</h2>
<ul>
<li><a href="https://github.com/GoogleChrome/puppeteer">puppeteer</a></li>
<li><a href="https://github.com/jakubpawlowicz/clean-css">clean-css</a></li>
<li><a href="https://github.com/purifycss/purifycss">purifycss</a></li>
</ul>
</style>
