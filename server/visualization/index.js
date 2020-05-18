import Boom from 'boom';
import './combine_aggs/agg_types/agg_types';
import { VisualizationService } from './VisualizationService';
import { Client } from '../utils/Client';

export default server => {
  const client = new Client(server);
  const visualizationService = new VisualizationService(client);
  
  server.route({
    path: '/api/visualization-data',
    method: 'POST',
    handler(req, reply) {
      const visualizationId = req.payload.id;
      const mapPrecision = req.payload.precision;
      const visualizationFilters = req.payload.filters;
      const searchQueryPanel = req.payload.searchQueryPanel;
      const searchQueryDashboard = req.payload.searchQueryDashboard;

      if (!visualizationId) {
        reply(Boom.badRequest('Visualization ID Not Found'));
        return;
      }

      const postProc = function(visualization, searchSource) {
        return visualizationService
          .prepareVisualizationDataRequest(
            visualization,
            req,
            visualizationFilters,
            searchSource,
            searchQueryPanel,
            searchQueryDashboard,
            mapPrecision
          )
          .then(body => {            
            client.initCallWithRequest(req, 'msearch', { body }).then(response => {
              
              visualizationService.injectMockedIndexPattern(visualization);
              visualizationService.visDataPostResponseProc(visualization, response.responses);
              return reply(response.responses);
            });
          });
      };

      client
        .getRequestClient(req)
        .get('visualization', visualizationId)
        .then(visualization => {
          if (!visualization) {
            return reply(Boom.notFound('Visualization Not Found'));
          }

          if (visualization.attributes.savedSearchId) {
            return client
              .getRequestClient(req)
              .find({
                type: 'search',
                id: visualization.attributes.savedSearchId,
                searchFields: ['id']
              })
              .then(savedSearch => {
                let searchSource = savedSearch[0];
                if (searchSource) {
                  searchSource = JSON.parse(searchSource.attributes.kibanaSavedObjectMeta.searchSourceJSON);
                }
                return postProc(visualization, searchSource);
              });
          }
          return postProc(visualization);
        })
        .catch(error => {
          console.error(error);
          reply(Boom.notFound(error))
        });
    }
  });

  server.route({
    path: '/api/saved-search-data',
    method: 'POST',
    handler(req, reply) {
      let searchItem;
      const pageSize = parseInt(req.payload.pageSize) || 20;
      const pageNum = parseInt(req.payload.pageNum) || 0;
      const savedSearchFilters = req.payload.filters;
      const searchQueryPanel = req.payload.searchQueryPanel;
      const searchQueryDashboard = req.payload.searchQueryDashboard;
      const searchId = req.payload.id;

      client.bulkGet(req, [{ type: 'search', id: searchId }]).then(objSearches => {
        objSearches.forEach(element => {
          if (element.id === searchId) {
            searchItem = element;
          }
        });
        if (!searchItem) {
          reply(Boom.notFound('Visualization Not Found'));
          return;
        }

        visualizationService
          .prepareSearchDataRequest(
            searchItem,
            pageSize,
            pageNum,
            req,
            savedSearchFilters,
            searchQueryPanel,
            searchQueryDashboard
          )
          .then(body => {
            client
              .initCallWithRequest(req, 'msearch', { body })
              .then(response => {
                try {
                  if (response.responses[0].hits) {
                    // modifying the response (adding columns array with Timeframe included)
                    let timeColumnValue = 'Time'; // default name. To be used if the property name is @timestamp
                    const timeSortValue = searchItem.attributes.sort[0];

                    response.responses[0].hits.columns = searchItem.attributes.columns;

                    if (timeSortValue === '@timestamp') {
                      response.responses[0].hits.hits.forEach(element => {
                        element._source[timeColumnValue] = element._source[timeSortValue];
                      });
                    } else {
                      timeColumnValue = timeSortValue;
                    }
                    if (!searchItem.attributes.columns.includes(timeColumnValue)) {
                      response.responses[0].hits.columns.unshift(timeColumnValue);
                    }
                  }
                  reply(response.responses);
                } catch (e) {
                  reply(Boom.badData(e.message));
                }
              })
              .catch(error => reply(Boom.badData(error)));
          });
      });
    }
  });
};
