const _ = require('lodash');

import { FieldList } from './_field_list.js';

class IndexPattern {
  constructor(state) {
    _.assign(this, state);
    this.fields = new FieldList(this, JSON.parse(state.fields));
  }
}

module.exports = IndexPattern;
