module.exports = [
  {
    name: 'Make relative URLs absolute',
    actions: [{
      log: 'Adding https for URLs starts with \/\/',
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
    name: 'Remove unused styles in <head>',
    actions: [{
      log: 'Remove unused CSS',
      actionType: 'removeUnusedStyles',
      selector: 'head > style',
      minify: false,
    }],
  },
];
