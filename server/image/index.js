import { ImageService } from './ImageService';
import { Client } from '../utils/Client';

export default server => {
  const pluginName = 'kibana-go';
  const basePath = '/api/imageproxy';
  const client = new Client(server);
  const imageService = new ImageService(client, pluginName);

  if (!client.getConfigValue(`${pluginName}.imageProxy.enabled`)) {
    return;
  }

  server.route({
    path: basePath,
    method: 'GET',
    handler(request, reply) {
      const { esIndexName, customIdField, customIdValue, fieldnameField, apitype } = request.query;

      if (!client.checkRequiredParameters([esIndexName, customIdField, customIdValue, fieldnameField, apitype])) {
        reply(
          'Missing query parameters. Requires: esIndexName, customIdField, customIdValue, fieldnameField, apitype'
        ).code(400);
        return;
      }

      imageService
        .getImage(esIndexName, customIdField, customIdValue, fieldnameField, request)
        .then(fieldValue => {
          if (!fieldValue) {
            reply(
              `Cannot find the ES document under ${esIndexName} with key ${customIdField} and value ${customIdValue}`
            ).code(400);
          }
          else {
            if (!imageService.requestProxiedServer(apitype, fieldValue, reply)) {
              reply(`Invalid api type: ${apitype}`).code(400);
            }
          }
        })
        .catch((e) => {
          reply('Error proxy image files.').code(500);
        });
    }
  });
};
