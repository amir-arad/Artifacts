//Setting up route
window.app.config(['$routeProvider',
    function($routeProvider) {
        $routeProvider.
            when('/login', {
                templateUrl: 'views/auth/sysop.html'
            }).
            when('/games/:gameId/login', {
                templateUrl: 'views/auth/game.html'
            }).
            when('/games/:gameId/players/:playerId/login', {
                templateUrl: 'views/auth/player.html'
            }).


            when('/articles/create', {
                templateUrl: 'views/articles/create.html'
            }).
            when('/articles/:articleId/edit', {
                templateUrl: 'views/articles/edit.html'
            }).
            when('/articles/:articleId', {
                templateUrl: 'views/articles/view.html'
            }).
            when('/', {
                templateUrl: 'views/index.html'
            }).
            otherwise({
                redirectTo: '/'
            });
    }
]);

//Setting HTML5 Location Mode
window.app.config(['$locationProvider',
    function($locationProvider) {
        $locationProvider.hashPrefix("!");
    }
]);