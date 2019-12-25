import { Client } from '../utils/Client';
import { VideoService } from './VideoService';

export default server => {
  const baseUrl = '/api/pekka_video';
  const client = new Client(server);
  const videoService = new VideoService(client);

  server.route({
    path: `${baseUrl}/get-all-objects-list`,
    method: 'GET',
    handler(req, reply) {
      const range = videoService.getTimeRangeFromRequestParameter(req);
      const resultObj = { results: [] };
      videoService.compositeQueryTillEnd(req, false, null, range, resultObj).then(objectsList => reply(objectsList));
    }
  });

  server.route({
    path: `${baseUrl}/get-objects-data`,
    method: 'GET',
    handler(req, reply) {
      let objectId = req.query.id;
      const objectName = req.query.name;
      const correlation_id = req.query.cor_id;
      const index = req.query.index;

      if (!objectId && !objectName) {
        reply('Request parameter error').code(400);
        return;
      }

      if (objectName) {
        objectId = objectName;
      }

      videoService
        .startScroll(req, index, objectId, correlation_id)
        .then(transformedResults => {
          const result = {
            localisation: [
              {
                sublocalisations: {
                  localisation: transformedResults
                },
                label: 'EllipseWithBoudingBox-1',
                tcin: '00:00:00.0000',
                tcout: '00:00:06.0800',
                tclevel: 0
              }
            ],
            id: objectId,
            type: 'visual_tracking',
            algorithm: 'demo-video-generator',
            processor: 'Demo processor',
            processed: 1432288449928,
            version: 1
          };
          reply(result);
        });
    }
  });
};
