import APIRegister from './server/api';

export default function(kibana) {
  return new kibana.Plugin({
    name: 'kibana-go',
    require: [],

    config(Joi) {
      return Joi.object({
        enabled: Joi.boolean().default(true),
        imageProxy: Joi.object({
          enabled: Joi.boolean().default(false),
          imageApiServer: Joi.string().optional('')
        }).default()
      }).default();
    },

    init(server) {
      APIRegister(server);
    }
  });
}
