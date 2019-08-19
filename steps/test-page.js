module.exports = [
  {
    name: 'Convert img to amp-img',
    actions: [{
      log: 'dummy action',
      actionType: 'customFunc',
      selector: 'body',
      customFunc: async (action, elements, page) => {},
    }],
  },
];
