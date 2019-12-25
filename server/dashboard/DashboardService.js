import { DashboardFactory } from './DashboardFactory';

export class DashboardService {
  type = 'dashboard';

  constructor(client) {
    this.client = client;
    this.dashboardFactory = new DashboardFactory();
  }

  getVisualizations(request, params) {
    return this.client.bulkGet(request, params);
  }

  async getList(request) {
    const dashboards = await this.client.find(request, {
      type: this.type,
      perPage: parseInt(request.query.pageSize) || 20,
      page: parseInt(request.query.pageNum) || 1
    });

    return await Promise.all(
      dashboards.map(async dashboard => {
        const picked = this.dashboardFactory.createDashboard(dashboard);
        const visualizations = await this.getVisualizations(request, picked.panels);
        visualizations.forEach((visualization, index) => {
          if (visualization.attributes) {
            picked.panels[index] = this.dashboardFactory.createPanel(picked.panels[index], visualization);
          }
        });
        return picked;
      })
    );
  }
}
