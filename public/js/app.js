window.app = angular.module('artifacts',
    ['ngCookies', 'restangular', 'ui.bootstrap', 'ui.route', 'artifacts.system', 'mean.articles']);

angular.module('artifacts.system', []);
angular.module('mean.articles', []);