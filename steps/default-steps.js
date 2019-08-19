module.exports = [
  {
    name: 'Make relative URLs absolute',
    actions: [{
      log: 'Adding https for URLs that start with \/\/',
      actionType: 'replace',
      selector: 'head, body',
      regex: '(href|src)=["\']\/\/([^\)^"^\']*)["\']',
      replace: '$1="$2"',
    }, {
      log: 'Update relative URLs',
      actionType: 'replace',
      selector: 'head, body',
      regex: '(href|src)=["\'](\\.*\\/[^\)^"^\']*)["\']',
      replace: '$1="$HOST/$2"',
    }, {
      log: 'Update relative URLs in CSS url()',
      actionType: 'replace',
      selector: 'style',
      regex: 'url\\(["\']?(\\.*[^\)^"^\']*)["\']?\\)',
      replace: 'url($HOST/$1)',
    }],
  },
  {
    name: 'Remove disallowed tags',
    actions: [{
      log: 'Remove iframe',
      actionType: 'replace',
      selector: 'html',
      regex: '<iframe[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>',
      replace: '',
    }, {
      log: 'Remove inline scripts',
      actionType: 'replace',
      selector: 'html',
      regex: '(<!--)?.*<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>.*(?:-->)?',
      replace: '',
    }, {
      log: 'Remove third-party elements',
      actionType: 'replace',
      selector: 'html',
      regex: '(<!--)?.*<(script|link) .*(src|href)=(?!"($HOST|#)).*>.*(?:-->)?',
      replace: '',
    }, {
      log: 'Remove javascript:void(0)',
      actionType: 'replace',
      selector: 'html',
      regex: 'javascript:.*void(0)',
      replace: '',
    }, {
      log: 'Remove noscript',
      actionType: 'replace',
      selector: 'html',
      regex: '<noscript[^<]*(?:(?!<\/noscript>)<[^<]*)*<\/noscript>',
      replace: '',
    }],
  },
  {
    name: 'Inline all CSS styles in <head>',
    actions: [{
      log: 'Remove styles links',
      actionType: 'replace',
      selector: 'head',
      regex: '(<!--)?.*<link.*rel="(text/css|stylesheet)".*>.*(?:-->)?',
      replace: '',
    }, {
      log: 'Inline external CSS',
      actionType: 'inlineExternalStyles',
      selector: 'head',
      minify: true,
    }, {
      log: 'Merge all inline CSS to the head.',
      actionType: 'mergeContent',
      selector: 'style:not([amp-boilerplate])',
      destSelector: 'head',
    }, {
      log: 'Change inline CSS to <style amp-custom>',
      actionType: 'replace',
      selector: 'html',
      regex: '<style(.*)>',
      replace: '<style amp-custom $1>',
    }, {
      log: 'Remove unused CSS',
      actionType: 'removeUnusedStyles',
      selector: 'head > style[amp-custom]',
      minify: true,
    }, {
      log: 'Remove media attribute in style tag.',
      actionType: 'removeAttribute',
      selector: 'style',
      attribute: 'media',
    }, {
      log: 'Remove !important flag',
      actionType: 'replace',
      selector: 'style',
      regex: '\\!important',
      replace: '',
    }, {
      log: 'Update relative URLs in CSS.',
      actionType: 'replace',
      selector: 'style',
      regex: 'url\\(["\']?((?!http(s?))[^\)^"^\']*)["\']?\\)',
      replace: 'url("$HOST/$1")',
    }],
  },
  {
    name: 'Additional page clean up',
    actions: [{
      log: 'Move font links to <head>',
      actionType: 'move',
      selector: 'link',
      destSelector: 'head',
    }],
  },
  {
    name: 'Convert disallowed tags to <div> based on AMP validation result.',
    actions: [{
      log: 'Change tags to <div>',
      actionType: 'replaceBasedOnAmpErrors',
      selector: 'html',
      ampErrorRegex: 'The tag \'([^\']*)\' is disallowed',
      regex: '<($1)((.|[\\r\\n])*)</$1>',
      replace: '<div data-original-tag="$1" $2</div>',
    }],
  },
  {
    name: 'Add AMP JS library and AMP boilerplate',
    actions: [{
      log: 'Set HTML tag with AMP',
      actionType: 'setAttribute',
      selector: 'html',
      attribute: 'amp',
      value: '',
    }, {
      log: 'Add preload to AMP JS library.',
      actionType: 'appendAfter',
      selector: 'title',
      value: '<link rel="preload" as="script" href="https://cdn.ampproject.org/v0.js">',
    }, {
      log: 'Add AMP JS library.',
      actionType: 'appendAfter',
      selector: 'title',
      value: '<script async src="https://cdn.ampproject.org/v0.js"></script>',
    }, {
      log: 'Update viewport',
      actionType: 'replaceOrInsert',
      selector: 'head',
      regex: '<meta.*name="viewport".*>',
      replace: '<meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">',
    }, {
      log: 'Update charset to UTF-8',
      actionType: 'replaceOrInsert',
      selector: 'head',
      regex: '<meta charset=".*">',
      replace: '<meta charset="utf-8">',
    }, {
      log: 'Add canonical link.',
      actionType: 'replaceOrInsert',
      selector: 'head',
      regex: '<link rel=(\")?canonical(\")?.*>',
      replace: '<link rel=canonical href="%%URL%%">',
    }, {
      log: 'Add AMP boilerplate.',
      actionType: 'insert',
      selector: 'head',
      value: `
<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style>
<noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>
`,
    }],
  },
  {
    name: 'Convert img to amp-img',
    actions: [{
      log: 'Set width and height for amp-img',
      actionType: 'customFunc',
      selector: 'img',
      customFunc: async (action, elements, page) => {
        if (elements && elements.length) {
          sizeMap = await page.$$eval('img', (imgs) => {
            return imgs.map(img =>[img.width, img.height]);
          });
          for (let i=0; i<elements.length; i++) {
            if (sizeMap && sizeMap[i]) {
              elements[i].setAttribute('width', sizeMap[i][0]);
              elements[i].setAttribute('height', sizeMap[i][1]);
            }
          }
        }
      },
    }, {
      log: 'Remove attribute sizes in img',
      actionType: 'removeAttribute',
      selector: 'img',
      attribute: 'sizes'
    }, {
      log: 'Replace img to amp-img',
      actionType: 'replace',
      selector: 'html',
      regex: '<img\\s+((\\w*="[^"]*"\\s*)*)[^>]*/?>',
      replace: '<amp-img $1></amp-img>',
    }, {
      log: 'Set fixed layout',
      actionType: 'setAttribute',
      selector: 'amp-img',
      attribute: 'layout',
      value: 'fixed',
    }],
  },
  {
    name: 'Remove disallowed attributes and tags based on AMP validation result.',
    actions: [{
      log: 'Remove disallowed attributes',
      actionType: 'removeDisallowedAttribute',
      selector: 'html',
    }],
  },

];
