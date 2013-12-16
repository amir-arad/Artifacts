var player = player || {
    controllers: {},
    directives: {},
    filters: {},
    services: {}
};

angular.module('player', ['player.controllers', 'player.directives', 'player.filters', 'player.services',
        'ngRoute', 'ngAnimate', 'ui.bootstrap', 'LocalStorageModule', 'ajoslin.mobile-navigate'])
    .config(["$provide",function($provide){
        $provide.decorator("$log",function($delegate, logService){
            return logService($delegate);
        });
    }])
    .config(['$routeProvider', '$locationProvider', '$httpProvider',
        function ($routeProvider, $locationProvider, $httpProvider) {
//        $locationProvider.html5Mode(true);
            $routeProvider
                .when('/login', {
                    controller: 'loginController',
                    templateUrl: 'view/login.html'
                })
                .when('/logout', {
                    controller: 'logoutController',
                    template : 'Logging out...'
                })
                .when('/nearby', {
                    controller: 'nearbyController',
                    templateUrl: 'view/artifactList.html'
                })
                .when('/inventory', {
                    controller: 'inventoryController',
                    templateUrl: 'view/artifactList.html',
                    resolve: {
                        inventory: function (apiService) {
                            return apiService.inventory();
                        }
                    }
                })
                .when('/artifact/:id', {
                    controller: 'artifactController',
                    templateUrl: 'view/artifact.html',
                    resolve: {
                        artifact: function ($route, apiService) {
                            return apiService.examine($route.current.params.id);
                        }
                    }
                })
                .otherwise({
                    redirectTo: '/login'
                });
            $httpProvider.interceptors.push('HttpErrorHandlerService');
        }]);