module.exports = [
  {
    name: 'Make relative URLs absolute',
    actions: [{
      log: 'Update relative URLs',
      actionType: 'replace',
      selector: 'html',
      regex: '(href|src)="(\\.*\/)(\\w)',
      replace: '$1="%%DOMAIN%%/$2$3',
    }, {
      log: 'Update relative URLs in CSS.',
      actionType: 'replace',
      selector: 'html',
      regex: 'background: url\\("(\\.*\/)(\\w)',
      replace: 'background: url("%%DOMAIN%%/$1$2',
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
      regex: '(<!--)?.*<(script|link) .*(src|href)=(?!"(%%DOMAIN%%|#)).*>.*(?:-->)?',
      replace: '',
    }, {
      log: 'Remove javascript:void(0)',
      actionType: 'replace',
      selector: 'html',
      regex: 'javascript:.*void(0)',
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
      targetSelector: 'head',
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
    }],
  },
  {
    name: 'Remove disallowed attributes',
    actions: [{
      log: 'Remove disallowed attributes based on AMP validation result.',
      actionType: 'removeDisallowedAttributes',
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
      actionType: 'insertBottom',
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
      log: 'replace img to amp-img',
      actionType: 'replace',
      selector: 'html',
      regex: '<img ((\\w*="[\\w\\d:\\/\\.\\s-\'’]*"\\s?)*)>',
      replace: '<amp-img $1></amp-img>',
    }, {
      log: 'Set responsive layout',
      actionType: 'setAttribute',
      selector: 'amp-img',
      attribute: 'width',
      value: '1',
    }, {
      log: 'Set responsive layout',
      actionType: 'setAttribute',
      selector: 'amp-img',
      attribute: 'height',
      value: '1',
    }, {
      log: 'Set responsive layout',
      actionType: 'setAttribute',
      selector: 'amp-img',
      attribute: 'layout',
      value: 'responsive',
    }],
  },
];
