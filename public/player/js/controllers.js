var player = player || {};
player.controllers = {};

angular.module('player.controllers', []).
    controller(player.controllers);

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
    authService.isLoggedIn().then(function(isLoggedIn){
        if ($location.path() == '/login' && isLoggedIn){
            $rootScope.loginPage = false;
            $navigate.go('/inventory');
        }
    });
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



player.controllers.headerController =  function ($rootScope, $scope, $location, $navigate, authService) {
    $scope.getClass = function(path) {
        if ($location.path().substr(1, path.length) == path) {
            return "active";
        } else {
            return "";
        }
    };
    $rootScope.loginPage = $location.path() == '/login';
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
    authService.isLoggedIn().then(function(isLoggedIn){
        if (!$rootScope.loginPage && !isLoggedIn){
            $rootScope.loginPage = true;
            $navigate.go('/login');
        }
    });
};

player.controllers.alertsController =  function($scope, alertService) {
    $scope.alerts = [];
    alertService.init($scope.alerts);
    $scope.closeAlert = alertService.closeAlert;
};


player.controllers.inventoryController =  function($scope, $log, apiService, inventory) {
    $scope.title = 'You have';
    $scope.artifacts = inventory;
    $scope.refresh = function(){
        $log.debug('refreshing inventory');
        apiService.inventory().then(function(inventory){
            $scope.artifacts = inventory;
        });
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


player.controllers.artifact =  function($scope, $log, artifact) {
    $scope.artifact = artifact;
};