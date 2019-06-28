module.exports = [
  {
    name: 'Remove unused inline styles',
    actions: [{
      log: 'Inline external CSS',
      actionType: 'inlineExternalStyles',
      selector: 'head',
      minify: false,
    }, {
      log: 'Remove unused CSS',
      actionType: 'removeUnusedStyles',
      selector: 'style',
      minify: false,
      outputCSS: true,
    }],
  },
];
