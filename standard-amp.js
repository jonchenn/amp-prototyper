const {amplify} = require('./easy-amplify-core');
const argv = require('minimist')(process.argv.slice(2));

const url ='http://127.0.0.1:8080';
const steps = [
  {
    name: 'Clean up unsupported elements',
    actions: [{
      log: 'Remove iframe',
      actionType: 'replace',
      selector: 'html',
      regex: '<iframe.*<\/iframe>',
      replace: '',
    }, {
      log: 'Remove inline scripts',
      actionType: 'replace',
      selector: 'html',
      regex: '(<!--)?.*<script[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>.*(-->)?',
      replace: '',
    }, {
      log: 'Remove third-party elements',
      actionType: 'replace',
      selector: 'html',
      regex: '(<!--)?.*<(script|link) .*(src|href)=(?!"(%%URL%%|#)).*>.*(?:-->)?',
      replace: '',
    }],
  },
  {
    name: 'Inline all CSS styles in <head>',
    actions: [{
      log: 'append styles',
      actionType: 'appendStyle',
      selector: 'head',
      excludeDomains: [],
      attributes: ['amp-custom'],
    }],
  },
  {
    name: 'Remove disallowed attributes',
    actions: [{
      log: 'Remove attributes: onclick|controlheight|controlwidth|aria-description|adhocenable|data',
      actionType: 'replace',
      selector: 'html',
      regex: '(onclick|controlheight|controlwidth|aria-description|adhocenable|data-[^=]*)=\"[^"]*\"',
      replace: '',
    }, {
      log: 'Remove to|expect|of|mind|promise|menu:click|onclick|privacy-policy|policy|sign-in|nav:clicked|my-account',
      actionType: 'replace',
      selector: 'html',
      regex: '(to|expect|of|mind|promise|menu:click|onclick|privacy-policy|policy|sign-in|nav:clicked|my-account)=\"[^"]*\"',
      replace: '',
    }],
  },
  {
    name: 'Make relative URLs absolute',
    actions: [{
      log: 'Update relative URLs',
      actionType: 'replace',
      selector: 'html',
      regex: '(href|src)=\"([/a-zA-Z0-9\.]+)\"',
      replace: '$1="%%URL%%/$2"',
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
      log: 'Add AMP JS library.',
      actionType: 'insertBottom',
      selector: 'head',
      value: '<script async src="https://cdn.ampproject.org/v0.js"></script>',
    }, {
      log: 'Update viewport',
      actionType: 'replaceOrInsert',
      selector: 'head',
      regex: '<meta name="viewport"([\sa-zA-Z1-9=\"\-\,]*)>',
      replace: '<meta name="viewport" content="width=device-width,minimum-scale=1,initial-scale=1">',
    }, {
      log: 'Update charset to UTF-8',
      actionType: 'replaceOrInsert',
      selector: 'head',
      regex: '<meta charset=".*">',
      replace: '<meta charset="utf-8">',
    }, {
      log: 'Add canonical link.',
      actionType: 'insertBottom',
      selector: 'head',
      value: '<link rel=canonical href="%%URL%%">',
    }, {
      log: 'Add AMP boilerplate.',
      actionType: 'insertBottom',
      selector: 'head',
      value: '<style amp-boilerplate>body{-webkit-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-moz-animation:-amp-start 8s steps(1,end) 0s 1 normal both;-ms-animation:-amp-start 8s steps(1,end) 0s 1 normal both;animation:-amp-start 8s steps(1,end) 0s 1 normal both}@-webkit-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-moz-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-ms-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@-o-keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}@keyframes -amp-start{from{visibility:hidden}to{visibility:visible}}</style><noscript><style amp-boilerplate>body{-webkit-animation:none;-moz-animation:none;-ms-animation:none;animation:none}</style></noscript>',
    }],
  },
  {
    name: 'Convert img to amp-img',
    actions: [{
      log: 'replace img to amp-img',
      actionType: 'replace',
      selector: 'html',
      regex: '<img(.*)>(</img>)?',
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

amplify(url, steps, argv);
