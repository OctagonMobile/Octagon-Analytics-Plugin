const elasticsearch = require('elasticsearch');
const _ = require('lodash');

export class Client {
  constructor(server) {
    this.server = server;
    this.config = this.server.config();
    this.elasticSearchClient = new elasticsearch.Client({
      host: this.config.get('elasticsearch.url'),
      log: 'warning'
    });
  }

  getRequestClient(request) {
    return this.server.savedObjects.getScopedSavedObjectsClient(request);
  }

  async bulkGet(request, params) {
    return (await this.getRequestClient(request).bulkGet(params)).saved_objects;
  }

  async find(request, params) {
    return (await this.getRequestClient(request).find(params)).saved_objects;
  }

  get esClient() {
    return this.elasticSearchClient;
  }

  get initCallWithRequest() {
    const elastic = this.server.plugins.elasticsearch;
    return elastic.callWithRequest || elastic.getCluster('data').callWithRequest;
  }

  getConfigValue(option) {
    return this.config.get(option);
  }

  getWhiteListHeaders(request) {
    const list = (this.getConfigValue('elasticsearch.requestHeadersWhitelist') || []).map(header =>
      header.trim().toLowerCase()
    );
    return _.pick(request.headers, list);
  }

  checkRequiredParameters(parameters) {
    return parameters.every(item => !!item);
  }
}
