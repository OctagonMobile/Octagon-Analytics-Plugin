const moment = require('moment');

export class VideoService {
  scrollDuration = '30s';

  constructor(client) {
    this.client = client;
  }

  getTimeRangeFromRequestParameter(req) {
    const res = {};
    let video_from = req.query.video_from;
    let video_to = req.query.video_to;

    if (video_from) {
      video_from = moment(video_from);
      if (video_from.isValid()) {
        res.from = video_from.valueOf();
      }
    }

    if (video_to) {
      video_to = moment(video_to);
      if (video_to.isValid()) {
        res.to = video_to.valueOf();
      }
    }

    return res;
  }

  buildQueryGetAllObjectsList(size, range, after, lastKey, id) {
    // Check here for composite aggregation: https://www.elastic.co/guide/en/elasticsearch/reference/current/search-aggregations-bucket-composite-aggregation.html
    return `{
      "size": 0,
       "aggs": {
         "group_by_object_item_id": {
           "composite": {
             "size": ${size},
             "sources": [
               { "keyword": { "terms": { "field": "object_item_id.keyword" } } }
             ]
             ${after ? ',"after": { "keyword": "' + lastKey + '" }' : ''}
           }           
         }
       },
       "query": { "bool": { "must": { "match": { "correlation_id.keyword": "${id}" } } } }
    }`;
  }

  buildQueryGetObjectsData(objectId, size, correlationId) {
    return `{
      "size": ${size},
      "query": {
        "bool": {
          "must": {
            "match":{ "correlation_id.keyword": "${correlationId || ''}" }
          },
          "filter": {
            "term": { "object_item_id.keyword": "${objectId}" }
          }
        }
      }
    }`;
  }

  compositeHandler(resp) {
    const buckets = resp.aggregations.group_by_object_item_id.buckets;
    return buckets.map(bucket => {
      const id = bucket.key.keyword;
      return { object_name: id, object_id: id };
    });
  }

  startScroll(req, index, objectId, correlationId) {
    const size = 500;

    const body = {
      index,
      scroll: this.scrollDuration,
      body: this.buildQueryGetObjectsData(objectId, size, correlationId)
    };

    const respHandler = resp => {
      const buckets = resp && resp.hits && resp.hits.hits ? resp.hits.hits : [];

      return buckets.map(bucket => {
        const bucketSource = bucket._source;
        return {
          shape: {
            c: bucketSource.shape.c,
            o: 0.0,
            rx: bucketSource.shape.rx,
            ry: bucketSource.shape.ry,
            t: bucketSource.shape.t
          },
          label: bucketSource.shape.label || 'object name',
          confidence: bucketSource.shape.confidence || 0.8,
          tc: bucketSource.tc,
          tclevel: 1
        };
      });
    };

    return new Promise(resolve => {
      const resObj = {
        results: []
      };
      this.client.initCallWithRequest(req, 'search', body).then(resp => {
        resObj.results = resObj.results.concat(respHandler(resp));
        return this.scrollTillEnd(req, resp._scroll_id, respHandler, resObj).then(() => resolve(resObj.results));
      });
    });
  }

  scrollTillEnd(req, scrollId, handler, resObj) {
    return this.client
      .initCallWithRequest(req, 'scroll', {
        scrollId: scrollId,
        scroll: this.scrollDuration
      })
      .then(resp => {
        resObj.results = resObj.results.concat(handler(resp));
        if (resp.hits.hits.length) {
          return this.scrollTillEnd(req, resp._scroll_id, handler, resObj);
        }
        return resObj;
      });
  }

  compositeQueryTillEnd(req, after, lastKey, range, resObj) {
    const index = req.query.index;
    const id = req.query.id;
    const size = 500;
    const body = {
      index: index,
      body: this.buildQueryGetAllObjectsList(size, range, after, lastKey, id)
    };

    return this.client.initCallWithRequest(req, 'search', body).then(resp => {
      const buckets = resp.aggregations.group_by_object_item_id.buckets;
      let newLastKey = null;

      if (buckets.length) {
        newLastKey = buckets[buckets.length - 1].key.keyword;
        resObj.results = resObj.results.concat(this.compositeHandler(resp));
      } else {
        return resObj.results;
      }

      if (newLastKey === lastKey) {
        return resObj.results;
      } else {
        lastKey = newLastKey;
        after = true;
        return this.compositeQueryTillEnd(req, after, lastKey, range, resObj);
      }
    });
  }
}
