var _ = require('lodash').runInContext();
var lodashStringMixin = require('./lodash-mixins/string');
var lodashLangMixin = require('./lodash-mixins/lang');
var lodashObjectMixin = require('./lodash-mixins/object');
var lodashCollectionMixin = require('./lodash-mixins/collection');
var lodashFunctionMixin = require('./lodash-mixins/function');
var lodashOopMixin = require('./lodash-mixins/oop');

lodashStringMixin(_);
lodashLangMixin(_);
lodashObjectMixin(_);
lodashCollectionMixin(_);
lodashFunctionMixin(_);
lodashOopMixin(_);

module.exports = _;
