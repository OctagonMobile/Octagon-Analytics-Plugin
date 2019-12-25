import Dashboards from './dashboard/index';
import Visualizations from './visualization/index';
import Video from './video/index';
import ImageProxy from './image/index';

module.exports = function(server){
   Dashboards(server);
   Visualizations(server);
   Video(server);
   ImageProxy(server);
}