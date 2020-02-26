import _ from './combine_aggs/lodash';
import { AggConfigs } from './combine_aggs/agg_configs';
import IndexPattern from './combine_aggs/index_pattern';
import { IndexedArray } from './combine_aggs/indexed_array';
import dateMathParser from 'datemath-parser';
import { AggConfig } from './combine_aggs/agg_config';
import { aggTypes } from './combine_aggs/agg_types/agg_types';

export class VisualizationService {
  metricLabels = {
    median: '50th percentile of ',
    sum: 'Sum of ',
    cardinality: 'Unique count of ',
    count: 'Count',
    avg: 'Average ',
    max: 'Max ',
    min: 'Min ',
    top_hits: 'Last '
  };

  constructor(client) {
    this.client = client;
  }

  prepareSearchQueryObject(searchTerm) {
    if (typeof searchTerm === 'string' && searchTerm !== '') {
      return {
        query_string: {
          analyze_wildcard: true,
          query: searchTerm
        }
      };
    }
    return false;
  }

  prepareScriptedFieldsObj(scriptedFields) {
    let scriptedFieldsObj = {};

    scriptedFields.forEach(field => {
      scriptedFieldsObj[field.name] = {
        script: {
          inline: field.script,
          lang: field.lang
        }
      };
    });
    return scriptedFieldsObj;
  }

  prepareVisualizationFilter(filterObj) {
    switch (filterObj.filterType) {
      case 'terms':
        if (filterObj.filterField && filterObj.filterValue) {
          let filterWord = typeof filterObj.filterValue === 'object' ? 'terms' : 'match_phrase';
          return {
            [filterWord]: {
              [filterObj.filterField]: filterObj.filterValue
            }
          };
        }
        break;
      case 'range':
        if (filterObj.filterField && filterObj.filterRangeFrom && filterObj.filterRangeTo) {
          return {
            range: {
              [filterObj.filterField]: {
                gte: filterObj.filterRangeFrom,
                lt: filterObj.filterRangeTo
              }
            }
          };
        }
        break;
      case 'date_histogram':
        if (filterObj.filterField && filterObj.filterValue) {
          return {
            range: {
              [filterObj.filterField]: {
                gte: parseInt(filterObj.filterValue),
                lt: parseInt(filterObj.filterValue) + 20000
              }
            }
          };
        }
        break;
      case 'geohash_grid':
        if (
          filterObj.filterField &&
          filterObj.filterValue &&
          filterObj.filterValue.bottom_right &&
          filterObj.filterValue.top_left
        ) {
          return {
            geo_bounding_box: {
              [filterObj.filterField]: filterObj.filterValue
            }
          };
        }
      default:
        return false;
    }
  }

  checkForScriptedFields(response) {

    const tempFieldsArray = JSON.parse(response[0].attributes.fields);
    const fieldsArray = [];
    tempFieldsArray.forEach(field => {
      if (field.scripted) {
        fieldsArray.push(field);
      }
    });
    return fieldsArray;
  }

  injectMockedIndexPattern(visualizationItem) {
    visualizationItem.indexPattern.attributes.fields = JSON.parse(visualizationItem.indexPattern.attributes.fields);
    visualizationItem.indexPattern = {
      fields: new IndexedArray({
        index: ['name'],
        group: ['type'],
        initialSet: visualizationItem.indexPattern.attributes.fields
      })
    };
  }

  visDataPostResponseProc(visualization, response) {
    if (visualization.attributes.visState) {
      const parsedState = JSON.parse(visualization.attributes.visState);

      if (parsedState.type === 'table') {
        // Need to put table headers in the response
        response[0].tableHeaders = parsedState.aggs.map(agg => {
          try {
            const aggConfig = new AggConfig(visualization, agg);
            return {
              label: aggTypes.byName[agg.type].makeLabel(aggConfig),
              id: agg.id
            };
          } catch (ex) {
            throw ex;
          }
        });
      }

      if (
        parsedState.type === 'pie' ||
        parsedState.type === 'histogram' ||
        parsedState.type === 'tagcloud' ||
        parsedState.type === 't4p-tagcloud'
      ) {
        // Need to put table headers in the response
        const pieAggs = parsedState.aggs.filter(
          ag => ag.type === 'sum' || ag.type === 'max' || (ag.type === 'avg' && ag.id === '1')
        );

        if (pieAggs.length > 0) {
          let buckets = _.get(response[0], 'aggregations[\'2\'].buckets');
          if (buckets && buckets instanceof Array) {
            buckets.forEach(bucket => {
              bucket.bucketValue = bucket['1'].value;
              delete bucket['1'];
            });
          }
        }
      }

      if (parsedState.type === 'tile_map') {
        response[0].aggregations['2'].buckets.forEach(bucket => {
          bucket.location = bucket['3'].location;
          delete bucket['3'];
          bucket.type = parsedState.aggs['0'].type;
          if (bucket.type !== 'count') {
            bucket.doc_count = bucket['1'].value;
            delete bucket['1'];
          }
        });
      }

      if (parsedState.type === 't4p-map') {
        const locationField = parsedState.params.location_field;
        const timeField = parsedState.params.time_field;
        const userField = parsedState.params.user_field;
        const faceField = parsedState.params.face_url_field;
        const tempArrayMap = [];

        response[0].hits.hits.forEach(hit => {
          if (hit._source[userField]) {
            tempArrayMap.push({
              location: hit._source[locationField],
              userID: hit._source[userField],
              timestamp: hit._source[timeField],
              faceUrl: hit._source[faceField]
            });
          }
        });
        response[0].hits.hits = [];
        response[0].hits.hits = tempArrayMap;
      }

      if (parsedState.type === 'metric') {
        if (!response[0].aggregations) {
          response[0].aggregations = {};
        }
        response[0].aggregations.metrics = [];
        if (parsedState.aggs.length) {
          parsedState.aggs.forEach(aggsItem => {
            const tempObj = {
              id: aggsItem.id,
              type: aggsItem.type
            };

            if (aggsItem.type === 'count') {
              tempObj.value = response[0].hits.total;
              tempObj.label = aggsItem.type;
            } else {
              if (aggsItem.type === 'top_hits') {
                // this metric type is not fully supported
                tempObj.value = response[0].aggregations[aggsItem.id].hits.hits[0].fields[aggsItem.params.field][0];
              } else {
                if (response[0].aggregations[aggsItem.id]) {
                  tempObj.value = response[0].aggregations[aggsItem.id].value;
                } else {
                  tempObj.value = 'N/A';
                }
              }
              tempObj.label = aggsItem.params.customLabel || this.metricLabels[aggsItem.type] + aggsItem.params.field;
            }
            delete response[0].aggregations[aggsItem.id];
            response[0].aggregations.metrics.push(tempObj);
          });
        }
      }

      if (parsedState.type === 't4p-tile') {
        const tempHitArray = [];
        const urlTypesArray = [
          {
            propertyName: 'video',
            urlName: 'videoUrl'
          },
          {
            propertyName: 'images',
            urlName: 'imageUrl'
          },
          {
            propertyName: 'audio',
            urlName: 'audioUrl'
          }
        ];

        response[0].hits.hits.forEach((hit, index) => {
          const thumbnailFilePath =
            parsedState.params[parsedState.params.specifytype.toLowerCase()] || parsedState.params.images;
          const thumbnailFileName = _.get(hit.fields, thumbnailFilePath)
            ? _.get(hit.fields, thumbnailFilePath)[0]
            : _.get(hit._source, thumbnailFilePath);

          tempHitArray[index] = {};

          urlTypesArray.forEach(urlTypeItem => {
            const currentTypeFilename = _.get(hit.fields, parsedState.params[urlTypeItem.propertyName])
              ? _.get(hit.fields, parsedState.params[urlTypeItem.propertyName])[0]
              : _.get(hit._source, parsedState.params[urlTypeItem.propertyName]);

            tempHitArray[index][urlTypeItem.urlName] =
              parsedState.params.imlServer.indexOf('{{file}}') !== -1
                ? parsedState.params.imlServer.replace('{{file}}', currentTypeFilename)
                : parsedState.params.imlServer + currentTypeFilename;
          });

          if (parsedState.params.urlThumbnail.indexOf('{{file}}') !== -1) {
            tempHitArray[index].thumbnailUrl = parsedState.params.urlThumbnail.replace('{{file}}', thumbnailFileName);
          } else {
            tempHitArray[index].thumbnailUrl = parsedState.params.urlThumbnail + thumbnailFileName;
          }

          tempHitArray[index].imageHash = _.get(hit.fields, parsedState.params.imageHashField)
            ? _.get(hit.fields, parsedState.params.imageHashField)[0]
            : _.get(hit._source, parsedState.params.imageHashField);

          tempHitArray[index].timestamp = hit._source['@timestamp'];
          tempHitArray[index].type = parsedState.params.specifytype;
        });
        response[0].hits.hits = [];
        response[0].hits.hits = tempHitArray;
      }

      if (parsedState.type === 't4p-face') {
        const tempHitArray = [];
        const urlObject = {
          propertyName: 'file',
          urlName: 'faceUrl',
          box: 'box'
        };

        response[0].hits.hits.forEach(hit => {
          const currentTypeFilename = _.get(hit.fields, parsedState.params[urlObject.propertyName])
            ? _.get(hit.fields, parsedState.params[urlObject.propertyName])[0]
            : _.get(hit._source, parsedState.params[urlObject.propertyName]);
          const tempHitArrayObj = {};
          const obsoleteESResponse = parsedState.params[urlObject.box] === 'processed.faces.box';
          let currentBox;
          let faceUrl = parsedState.params.faceUrl;

          if (!currentTypeFilename) {
            return;
          }

          if (parsedState.params.faceUrl.indexOf('{{file}}') !== -1) {
            faceUrl = parsedState.params.faceUrl.replace('{{file}}', currentTypeFilename);
          } else {
            faceUrl = parsedState.params.faceUrl + currentTypeFilename;
          }
          tempHitArrayObj.faces = [];
          if (obsoleteESResponse) {
            if (_.get(hit._source, 'processed.faces') && Array.isArray(hit._source.processed.faces)) {
              hit._source.processed.faces.forEach(element => {
                if (element.box && faceUrl.indexOf('{{box}}') !== -1) {
                  tempHitArrayObj.faces.push(faceUrl.replace('{{box}}', element.box));
                }
              });
              if (tempHitArrayObj.faces.length > 1) {
                tempHitArrayObj.fileName = currentTypeFilename;
                tempHitArrayObj.type = parsedState.type;
                tempHitArray.push(tempHitArrayObj);
              }
            }
          } else {
            let facesUrl = faceUrl;
            currentBox = _.get(hit._source, parsedState.params[urlObject.box]);
            if (currentBox && faceUrl.indexOf('{{box}}') !== -1) {
              facesUrl = faceUrl.replace('{{box}}', currentBox);
            }
            tempHitArrayObj.faces.push(facesUrl);
            tempHitArrayObj.fileName = currentTypeFilename;
            tempHitArrayObj.type = parsedState.type;
            tempHitArray.push(tempHitArrayObj);
          }
        });
        response[0].hits.hits = tempHitArray;
      }
    }
  }

  getTimeRange(request) {
    const timeRange = request.payload.timeRange;
    return timeRange ? JSON.parse(timeRange) : {
      from: request.payload.timeFrom || 'now-5y',
      to: request.payload.timeTo || 'now',
      mode: 'quick'
    };
  }

  getQueryRange(request, timeStampProp) {
    const { from, to } = this.getTimeRange(request);
    return {
      [timeStampProp]: {
        gte: dateMathParser.parse(from),
        lte: dateMathParser.parse(to),
        format: 'epoch_millis'
      }
    };
  }

  prepareVisualizationDataRequest(
    visualizationItem,
    request,
    visualizationFilters,
    searchSource,
    searchQueryPanel,
    searchQueryDashboard,
    mapPrecision
  ) {
    console.log(JSON.stringify(visualizationItem.attributes,null,4));
    console.log('=============================')    

    const aggsParsedJSON = JSON.parse(visualizationItem.attributes.visState);
    if(aggsParsedJSON.type === 'input_control_vis'){
      //Input control do not have search source in the searchSourceJSON
      //It has multiple indice in visState.params.controls instead
      
      
    }

    if (!searchSource) {
      searchSource = JSON.parse(visualizationItem.attributes.kibanaSavedObjectMeta.searchSourceJSON);      
    }    

    return this.client.bulkGet(request, [{ type: 'index-pattern', id: searchSource.index }]).then(bulkResult => {
      const timeRange = this.getTimeRange(request);
      const indexPattern = bulkResult[0];
      visualizationItem.indexPattern = indexPattern;
      console.log(JSON.stringify(bulkResult,null,4));
      const scriptedFieldsArray = this.checkForScriptedFields(bulkResult);
      const scriptedFieldObj = this.prepareScriptedFieldsObj(scriptedFieldsArray) || {};

      const indexJSON = {
        index: [indexPattern.attributes.title],
        ignore_unavailable: true
      };

      if (aggsParsedJSON.type === 'tile_map' && mapPrecision !== undefined) {
        aggsParsedJSON.aggs[1].params.precision = mapPrecision;
      }

      if (aggsParsedJSON.type === 'histogram') {
        aggsParsedJSON.aggs[1].params.timeRange = timeRange;
      }

      const aggs = new AggConfigs(new IndexPattern({
        id: indexPattern.id,
        ...indexPattern.attributes
      }), aggsParsedJSON.aggs, aggsParsedJSON.type.schemas);

      const aggsDsl = aggs.toDsl(true);

      if (aggs.hasOwnProperty('aggs') && aggs.aggs.hasOwnProperty('2')) {
        if (aggs.aggs[2][aggsParsedJSON.type] && aggs.aggs[2][aggsParsedJSON.type].field) {
          const aggsField = aggs.aggs[2][aggsParsedJSON.type].field;
          if (scriptedFieldsArray.length) {
            if (scriptedFieldObj[aggsField]) {
              aggs.aggs['2'][aggsParsedJSON.type].script = scriptedFieldObj[aggsField].script;
              delete aggs.aggs[2][aggsParsedJSON.type].field;
            }
          }
        }
      }

      const queryJSON = {
        query: {
          bool: {
            must: [
              {
                range: this.getQueryRange(request, indexPattern.attributes.timeFieldName)
              }
            ],
            must_not: [],
            filter: []
          }
        },
        size: ['t4p-tile', 't4p-map', 't4p-face'].includes(aggsParsedJSON.type) ? 1000 : 100,
        _source: {
          excludes: []
        },
        aggs: aggsDsl || {},
        script_fields: scriptedFieldObj
      };

      if (visualizationFilters && visualizationFilters.length) {
        visualizationFilters.forEach(visualizationFilter => {
          let visualizationFilterObj = this.prepareVisualizationFilter(visualizationFilter);
          if (visualizationFilterObj) {
            visualizationFilter.isFilterInverted
              ? queryJSON.query.bool.must_not.push(visualizationFilterObj)
              : queryJSON.query.bool.must.push(visualizationFilterObj);
          }
        });
      }

      if (searchQueryPanel === '' && searchQueryDashboard === '') {
        queryJSON.query.bool.must.push({ match_all: {} });
      } else {
        const searchQueryPanelObj = this.prepareSearchQueryObject(searchQueryPanel);
        const searchQueryDashboardObj = this.prepareSearchQueryObject(searchQueryDashboard);

        if (searchQueryPanelObj) {
          queryJSON.query.bool.must.push(searchQueryPanelObj);
        }

        if (searchQueryDashboardObj) {
          queryJSON.query.bool.must.push(searchQueryDashboardObj);
        }
      }

      return JSON.stringify(indexJSON) + '\n' + JSON.stringify(queryJSON);
    });
  }

  prepareSearchDataRequest(
    searchItem,
    pageSize,
    pageNum,
    request,
    savedSearchFilters,
    searchQueryPanel,
    searchQueryDashboard
  ) {
    const searchSourceJSON = JSON.parse(searchItem.attributes.kibanaSavedObjectMeta.searchSourceJSON);

    return this.client
      .bulkGet(request, [
        {
          type: 'index-pattern',
          id: searchSourceJSON.index,
          searchFields: ['title']
        }
      ])
      .then(res => {
        let timestampProp;
        let rangeProp;
        const result = res[0];
        if (result.attributes.timeFieldName) {
          rangeProp = {
            range: this.getQueryRange(request, result.attributes.timeFieldName)
          };
        }

        const indexJSON = {
          index: [result.attributes.title],
          ignore_unavailable: true
        };
        const sortObj = searchItem.attributes.sort;
        const searchQuery = { match_all: {} };

        const queryJSON = {
          query: {
            bool: {
              must: [],
              must_not: []
            }
          },
          from: pageNum * pageSize,
          size: pageSize,
          sort: [
            {
              [sortObj[0]]: {
                order: sortObj[1]
              }
            }
          ]
        };

        queryJSON.query.bool.must.push(timestampProp ? rangeProp : searchQuery);

        if (savedSearchFilters && savedSearchFilters.length) {
          savedSearchFilters.forEach(savedSearchFilter => {
            const savedSearchFilterObj = this.prepareVisualizationFilter(savedSearchFilter);
            savedSearchFilter.isFilterInverted && savedSearchFilterObj
              ? queryJSON.query.bool.must_not.push(savedSearchFilterObj)
              : queryJSON.query.bool.must.push(savedSearchFilterObj);
          });
        }
        if (searchQueryPanel === '' && searchQueryDashboard === '') {
          queryJSON.query.bool.must.push(searchQuery);
        } else {
          const searchQueryPanelObj = this.prepareSearchQueryObject(searchQueryPanel);
          const searchQueryDashboardObj = this.prepareSearchQueryObject(searchQueryDashboard);

          if (searchQueryPanelObj) {
            queryJSON.query.bool.must.push(searchQueryPanelObj);
          }
          if (searchQueryDashboardObj) {
            queryJSON.query.bool.must.push(searchQueryDashboardObj);
          }
        }
        return JSON.stringify(indexJSON) + '\n' + JSON.stringify(queryJSON);
      });
  }
}
