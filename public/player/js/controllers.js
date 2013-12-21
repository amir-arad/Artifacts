var player = player || {};
player.controllers = {};

angular.module('player.controllers', ['angular-carousel'])
    .controller(player.controllers)
    .run( function($rootScope, $location, $navigate, authService) {
        // register listener to watch route changes
        $rootScope.$on( "$routeChangeStart", function(event, next, current) {
            if (next.templateUrl !== undefined) {
                $rootScope.loginPage = next.templateUrl === 'view/login.html';
                authService.isLoggedIn().then(function(isLoggedIn){
                    if ((isLoggedIn? true : false) === $rootScope.loginPage) {
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
//    authService.isLoggedIn().then(function(isLoggedIn){
//        if ($location.path() == '/login' && isLoggedIn){
//            $rootScope.loginPage = false;
//            $navigate.go('/inventory');
//        }
//    });
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
    $scope.menu = [{
        "title": "Inventory",
        "link": "inventory"
    }, {
        "title": "Look Around",
        "link": "nearby"
    }, {
        "title": "Log out",
        "link": "logout"
    }];
};

player.controllers.alertsController =  function($scope, alertService) {
    $scope.alerts = [];
    alertService.init($scope.alerts);
    $scope.closeAlert = alertService.closeAlert;
};


player.controllers.inventoryController =  function($scope, $log, $navigate, apiService, inventory) {
    $scope.title = 'You have';
    $scope.artifacts = inventory;
    $scope.refresh = function(){
        $log.debug('refreshing inventory');
        apiService.inventory().then(function(inventory){
            $scope.artifacts = inventory;
        });
    };
    $scope.examine = function(artifactName){
        $navigate.go('/artifact/'+artifactName);
    };
};

player.controllers.nearbyController =  function($scope, $log, apiService, nearby) {
    $scope.title = 'You see around you';
    $scope.artifacts = nearby;
    $scope.refresh = function(){
        $log.debug('refreshing nearby');
        apiService.nearby().then(function(nearby){
            $scope.artifacts = nearby;
        });
    };
};


player.controllers.artifactController =  function($scope, $log, $navigate, apiService, artifact) {
    $log.debug('inspecting artifact', artifact.name);
    $scope.artifact = artifact;
    $scope.inventory = function(){
        $navigate.go('/inventory');
    };
    $scope.drop = function(){
        apiService.drop(artifact.name).then(function(){
            $navigate.go('/inventory');
        });
    };
};