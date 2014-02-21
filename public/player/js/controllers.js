var player = player || {};
player.controllers = {};

player.controllers._ = function () {
    return window._; // assumes loDash has already been loaded on the page
};

angular.module('player.controllers', ['angular-carousel'])
    .controller(player.controllers)
    .config(['$provide', function($provide){
    // listener infra for controller-controller communication
        $provide.decorator('$rootScope', ['$delegate', function($delegate){
            Object.defineProperty($delegate.constructor.prototype, '$onRootScope', {
                value: function(name, listener){
                    var unsubscribe = $delegate.$on(name, listener);
                    this.$on('$destroy', unsubscribe);
                },
                enumerable: false
            });
            return $delegate;
        }]);
    }])
    .run( ['$rootScope', '$navigate', 'authService', function($rootScope, $navigate, authService) {
        // register listener to watch route changes
        $rootScope.$on("$routeChangeStart", function(event, next, current) {
            if (next.controller !== undefined) {
                $rootScope.loginPage = next.controller === 'loginController';
                authService.isLoggedIn().then(function(isLoggedIn){
                    if (isLoggedIn === $rootScope.loginPage) {
                        // needs a redirection
                        if (isLoggedIn){
                            // redirect to inventory
                            $navigate.go('/inventory');
                        } else {
                            // redirect to login
                            $navigate.go('/login');
                        }
                    }
                });
            }
        });
    }]);

/**
 * The login controller.
 */
player.controllers.loginController =  ['$rootScope', '$scope', '$log', '$location', 'authService',
    function ($rootScope, $scope, $log, $location, authService) {
        // TODO here for presentation only
        $scope.game = 'sampleGame';
        $scope.player = 'bob';
        $scope.password = 'king123';

        $scope.login = function() {
            $log.debug('login sent', $scope.game, $scope.player, $scope.password);
            authService.login($scope.game, $scope.player, $scope.password).then(function(){
               //  $rootScope.loginPage = false;
                $location.path('/inventory');
               //  $navigate.go('/inventory');
            });
        };
    }];

/**
 * The login controller.
 */
player.controllers.logoutController =  ['$rootScope', '$log', '$location', 'authService',
    function ($rootScope, $log, $location, authService) {
    $log.debug('logout called');
    authService.logout().then(function(){
      //  $rootScope.loginPage = true;
        $location.path('/login');
      //  $navigate.go('/login');
    });
}];


/**
 * top toolbar controller
 * @param $scope
 * @param $location
 * @param $navigate
 */
player.controllers.headerController =  ['$scope', '$location', '$navigate', function ($scope, $location, $navigate) {
    $scope.getClass = function(path) {
        // seems to not be working so well
        if ($location.path().substr(1, path.length) == path) {
            return "active";
        } else {
            return "";
        }
    };
    $scope.navigate = function(path) {
        $navigate.go('/'+path);
    };
}];

player.controllers.alertsController =  ['$scope', 'alertService', function($scope, alertService) {
    $scope.alerts = [];
    alertService.init($scope.alerts);
    $scope.closeAlert = alertService.closeAlert;
}];

player.controllers.inventoryController =  ['$scope', '$navigate', 'apiService', function($scope, $navigate, apiService) {
    $scope.title = 'You have';

    apiService.inventory().then(function(result) {
        $scope.artifacts = result;
    });

    $scope.examine = function(artifactName){
        $navigate.go('/artifact/'+artifactName);
    };
}];

player.controllers.scannerController =  ['$rootScope', '$scope', 'apiService', function($rootScope, $scope, apiService) {
    apiService.nearby().then(function(result) {
        $scope.artifacts = result;
    });

    $scope.toggleLeftNav = function(){
        $rootScope.leftNav = !$rootScope.leftNav;
    };

    $scope.pickup = function(artifactId){
        apiService.pickup(artifactId);
    };
}];

player.controllers.artifactController =  ['$scope', '$navigate', 'apiService', 'artifact', '$log', function($scope, $navigate, apiService, artifact, $log) {
    $log.debug('inspecting artifact', artifact.name);
    $scope.artifact = artifact;
    $scope.inventory = function(){
        $navigate.go('/inventory');
    };
    $scope.drop = function(){
        apiService.drop(artifact.name).then($scope.inventory);
    };
}];