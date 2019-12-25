const Wreck = require('wreck');
import _ from 'lodash';

export class ImageService {
  constructor(client, pluginName) {
    this.client = client;
    this.imageServerUrl = this.client.getConfigValue(`${pluginName}.imageProxy.imageApiServer`);
  }

  getImage(index, customIdField, customIdValue, fieldnameField, request) {
    const headers = this.client.getWhiteListHeaders(request);
    return this.client.esClient
      .search({
        index,
        body: {
          query: {
            query_string: {
              query: `${customIdField}:"${customIdValue}"`
            }
          }
        },
        headers
      })
      .then(res => (res.hits && res.hits.hits && res.hits.hits[0] ? res.hits.hits[0] : null))
      .then(customDoc => {
        if (!customDoc) {
          return null;
        } else {
          const fieldValue =
            customDoc && customDoc._source && _.get(customDoc._source, fieldnameField)
              ? _.get(customDoc._source, fieldnameField)
              : null;
          if (typeof fieldValue === 'undefined' || fieldValue === null) {
            throw `No value found under path ${fieldnameField}`;
          }
          return fieldValue;
        }
      });
  }

  getUrlByApiType(apiType, fileName) {
    if (apiType === 'thumbnail') {
      return `${this.imageServerUrl}/file/thumbnail?width=200&file=${fileName}`;
    }
    if (apiType === 'download') {
      return `${this.imageServerUrl}/download?file=${fileName}`;
    }
    return null;
  }

  requestProxiedServer(apiType, fileName, reply) {
    const url = this.getUrlByApiType(apiType, fileName);

    if (url) {
      return Wreck.get(url, null, (err, res, payload) => {
        if (err) {          
          reply(err);          
          return;
        }

        if (res.statusCode !== 200) {
          reply(res.statusCode);
        }

        const response = reply(payload);
        _.each(res.headers, (val, key) => response.header(key, val));
        return response;
      });
    }

    return null;
  }
}
