var player = player || {};
player.controllers = {};

angular.module('player.controllers', []).
    controller(player.controllers);

/**
 * The login controller.
 */
player.controllers.loginController =  function ($scope, $log, $location, $navigate, authService) {
    $scope.login = function() {
        $log.debug('login sent', $scope.game, $scope.player, $scope.password);
        authService.login($scope.game, $scope.player, $scope.password).then(function(){
            $navigate.go('/inventory');
        });
    };
    authService.isLoggedIn().then(function(isLoggedIn){
        if ($location.path() == '/login' && isLoggedIn){
            $navigate.go('/inventory');
        }
    });
};

player.controllers.headerController =  function ($scope, $location, $navigate, authService) {
    $scope.getClass = function(path) {
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
    }];
    authService.isLoggedIn().then(function(isLoggedIn){
        if ($location.path() != '/login' && !isLoggedIn){
            $navigate.go('/login');
        }
    });
};

player.controllers.alertsController =  function($scope, alertService) {
    $scope.alerts = [];
    alertService.init($scope.alerts);
    $scope.closeAlert = alertService.closeAlert;
};


player.controllers.inventoryController =  function($scope, $log, apiService) {
    $scope.refresh = function(){
        $log.debug('refreshing inventory');
        apiService.inventory().then(function(inventory){
            $scope.inventory = inventory;
        });
    };
};

player.controllers.nearbyController =  function($scope, $log, apiService) {
    $scope.refresh = function(){
        $log.debug('refreshing nearby');
        apiService.nearby().then(function(nearby){
            $scope.nearby = nearby;
        });
    };
};


player.controllers.artifact =  function($scope, $log, artifact) {
    $scope.artifact = artifact;
};