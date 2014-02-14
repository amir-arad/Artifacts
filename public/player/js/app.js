var player = player || {
    controllers: {},
    directives: {},
    filters: {},
    services: {}
};

angular.module('player', ['player.controllers', 'player.directives', 'player.filters', 'player.services',
        'ngRoute', 'ngAnimate', 'LocalStorageModule', 'ajoslin.mobile-navigate', 'ngSanitize',
        'angular-carousel', 'btford.socket-io'])
    .config(["$provide",function($provide){
        $provide.decorator("$log", ['$delegate', 'logService', function($delegate, logService){
            return logService($delegate);
        }]);
    }])
    .config(['$routeProvider', '$locationProvider', '$httpProvider',
        function ($routeProvider, $locationProvider, $httpProvider) {
//        $locationProvider.html5Mode(true);
            $routeProvider
                .when('/login', {
                    controller: 'loginController',
                    templateUrl: 'view/login.html',
                    resolve: {
                        isLoggedIn: ['authService', function (authService) {
                            return authService.isLoggedIn();
                        }]
                    }
                })
                .when('/logout', {
                    controller: 'logoutController',
                    template : 'Logging out...'
                })
                .when('/inventory', {
                    controller: 'inventoryController',
                    templateUrl: 'view/artifactList.html',
                    resolve: {
                        isLoggedIn: ['authService', function (authService) {
                            return authService.isLoggedIn();
                        }],
                        ready : ['apiService', function (apiService) {
                            return apiService.ready;
                        }]
                    }
                })
                .when('/artifact/:id', {
                    controller: 'artifactController',
                    templateUrl: 'view/artifact.html',
                    resolve: {
                        isLoggedIn: ['authService', function (authService) {
                            return authService.isLoggedIn();
                        }],
                        ready : ['apiService', function (apiService) {
                            return apiService.ready;
                        }],
                        artifact: ['$route', 'apiService', function ($route, apiService) {
                            return apiService.examine($route.current.params.id);
                        }]
                    }
                })
                .otherwise({
                    redirectTo: '/login'
                });
            $httpProvider.interceptors.push('HttpErrorHandlerService');
        }]);