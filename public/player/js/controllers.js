var player = player || {};
player.controllers = {};

player.controllers._ = function () {
    return window._; // assumes loDash has already been loaded on the page
};

angular.module('player.controllers', ['angular-carousel'])
    .controller(player.controllers)
    .config(['$provide', function($provide){   // listener infra for controller-controller communication
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
    .run( function($rootScope, $navigate, authService) {
        // register listener to watch route changes
        $rootScope.$on("$routeChangeStart", function(event, next, current) {
            if (next.templateUrl !== undefined) {
                $rootScope.loginPage = next.templateUrl === 'view/login.html';
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
    });

/**
 * The login controller.
 */
player.controllers.loginController =  function ($rootScope, $scope, $log, $location, $navigate, authService) {
    $scope.login = function() {
        $log.debug('login sent', $scope.game, $scope.player, $scope.password);
        authService.login($scope.game, $scope.player, $scope.password).then(function(){
            $rootScope.loginPage = false;
            $navigate.go('/inventory');
        });
    };
};

/**
 * The login controller.
 */
player.controllers.logoutController =  function ($rootScope, $log, $navigate, authService) {
    $log.debug('logout called');
    authService.logout().then(function(){
        $rootScope.loginPage = true;
        $navigate.go('/login');
    });
};


/**
 * top toolbar controller
 * @param $scope
 * @param $location
 * @param $navigate
 */
player.controllers.headerController =  function ($scope, $location, $navigate) {
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
//    $scope.menu = [{
//        "title": "Inventory",
//        "link": "inventory"
//    }, {
//        "title": "Look Around",
//        "link": "nearby"
//    }, {
//        "title": "Log out",
//        "link": "logout"
//    }];
};

player.controllers.alertsController =  function($scope, alertService) {
    $scope.alerts = [];
    alertService.init($scope.alerts);
    $scope.closeAlert = alertService.closeAlert;
};

player.controllers.inventoryController =  function($rootScope, $scope, $log, $navigate, apiService) {
    $scope.title = 'You have';

    apiService.inventory().then(function(result) {
        $scope.artifacts = result;
    });

    $scope.examine = function(artifactName){
        $navigate.go('/artifact/'+artifactName);
    };
};

player.controllers.scannerController =  function($rootScope, $scope, $log, apiService) {
    apiService.nearby().then(function(result) {
        $scope.artifacts = result;
    });

    $scope.toggleLeftNav = function(){
        $rootScope.leftNav = !$rootScope.leftNav;
    };

    $scope.pickup = function(artifactId){
        apiService.pickup(artifactId);
    };
};

player.controllers.artifactController =  function($rootScope, $scope, $log, $navigate, apiService, artifact) {
    $log.debug('inspecting artifact', artifact.name);
    $scope.artifact = artifact;
    $scope.inventory = function(){
        $navigate.go('/inventory');
    };
    $scope.drop = function(){
        apiService.drop(artifact.name).then($scope.inventory);
    };
};