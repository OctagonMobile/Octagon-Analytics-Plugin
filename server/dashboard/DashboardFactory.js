export class DashboardFactory {

  createDashboard(dashboardData) {
    const { id, type } = dashboardData;
    return {
      id,
      type,
      title: dashboardData.attributes.title,
      description: dashboardData.attributes.description,
      panels: JSON.parse(dashboardData.attributes.panelsJSON),
      timeTo: dashboardData.attributes.timeTo || '',
      timeFrom: dashboardData.attributes.timeFrom || ''
    };
  }

  createPanel(panel, visualization) {
    return {
    ...panel,
      size_x: panel.size_x || panel.gridData.w,
      size_y: panel.size_y || panel.gridData.h,
      col: panel.col || panel.gridData.x,
      row: panel.row || panel.gridData.y,
      searchQueryPanel: this.getSearchQuery(visualization.attributes.kibanaSavedObjectMeta.searchSourceJSON),
      visState: this.getVisualizationState(visualization)
    }
  }

  getVisualizationState(visualization) {
    if (visualization.type === 'search') {
      return {
        type: visualization.type,
        title: visualization.attributes.title
      };
    }
    return JSON.parse(visualization.attributes.visState);
  };

  getSearchQuery(searchJsonObj) {
    const searchSourceParsed = JSON.parse(searchJsonObj);
    const queryEl = searchSourceParsed.query;
    return queryEl && queryEl.hasOwnProperty('query_string') ? queryEl['query_string'].query : '';
  }
}
