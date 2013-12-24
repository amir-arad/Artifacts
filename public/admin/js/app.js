var admin = admin || {
    controllers: {},
    directives: {},
    filters: {},
    services: {}
};

angular.module('admin', ['admin.controllers', 'admin.directives', 'admin.filters', 'admin.services',
        'ngRoute', 'ngAnimate', 'LocalStorageModule', 'ajoslin.mobile-navigate', 'ngSanitize', 'angular-carousel'])
    .config(["$provide",function($provide){
        $provide.decorator("$log", function($delegate, logService){
            return logService($delegate);
        });
    }])
    .config(['$routeProvider', '$httpProvider',
        function ($routeProvider, $httpProvider) {
//        $locationProvider.html5Mode(true);
            $routeProvider
                .when('/login', {
                    controller: 'loginController',
                    templateUrl: 'view/login.html',
                    resolve: {
                        isLoggedIn: function (authService) {
                            return authService.isLoggedIn();
                        }
                    }
                })
                .when('/logout', {
                    controller: 'logoutController',
                    template : 'Logging out...'
                })
                .when('/game', {
                    controller: 'gameController',
                    templateUrl: 'view/game.html',
                    resolve: {
                        isLoggedIn: function (authService) {
                            return authService.isLoggedIn();
                        },
                        game: function (apiService) {
                            return apiService.getGame();
                        }
                    }
                })
                .when('/playerList', {
                    controller: 'playerListController',
                    templateUrl: 'view/playerList.html',
                    resolve: {
                        isLoggedIn: function (authService) {
                            return authService.isLoggedIn();
                        },
                        playerList: function (apiService) {
                            return apiService.getPlayerList();
                        }
                    }
                })
                .when('/player/:id', {
                    controller: 'playerController',
                    templateUrl: 'view/player.html',
                    resolve: {
                        isLoggedIn: function (authService) {
                            return authService.isLoggedIn();
                        },
                        player: function ($route, apiService) {
                            return apiService.getPlayer($route.current.params.id);
                        },
                        artifacts: function ($route, artifactsService) {
                            return artifactsService.getArtifactsbyOwner($route.current.params.id);
                        }
                    }
                })
                .when('/ground', {
                    controller: 'artifactListController',
                    templateUrl: 'view/artifactList.html',
                    resolve: {
                        isLoggedIn: function (authService) {
                            return authService.isLoggedIn();
                        },
                        artifacts: function (artifactsService) {
                            return artifactsService.getArtifactsbyOwner('everywhere');
                        },
                        owner: function () {
                            return 'everywhere';
                        }
                    }
                })
//                .when('/artifact/:id', {
//                    controller: 'artifactController',
//                    templateUrl: 'view/artifact.html',
//                    resolve: {
//                        isLoggedIn: function (authService) {
//                            return authService.isLoggedIn();
//                        },
//                        artifact: function ($route, apiService) {
//                            return apiService.examine($route.current.params.id);
//                        }
//                    }
//                })
                .otherwise({
                    redirectTo: '/login'
                });
            $httpProvider.interceptors.push('HttpErrorHandlerService');
        }]);