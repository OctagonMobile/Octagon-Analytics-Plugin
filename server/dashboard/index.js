import { DashboardService } from './DashboardService';
import { Client } from '../utils/Client';

export default server => {
  const dashboardService = new DashboardService(new Client(server));
  const baseUrl = '/api/dashboard';

  server.route({
    path: `${baseUrl}/list`,
    method: 'GET',
    handler(request, reply) {
      reply(dashboardService.getList(request));
    }
  });

};
