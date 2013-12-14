var player = player || {};
player.controllers = {};

angular.module('player.controllers', []).
    controller(player.controllers);

// from http://www.yearofmoo.com/2012/10/more-angularjs-magic-to-supercharge-your-webapp.html#apply-digest-and-phase
// be sure to inject $scope and $location
var changeLocation = function($scope, $location, url, forceReload) {
    $scope = $scope || angular.element(document).scope();
    if(forceReload || $scope.$$phase) {
        window.location = url;
    }
    else {
        //only use this if you want to replace the history stack
        //$location.path(url).replace();
        //this this if you want to change the URL and add it to the history stack
        $location.path(url);
        $scope.$apply();
    }
};

/**
 * The login controller.
 */
player.controllers.loginController =  function ($scope, $log, $location, authService) {
    $scope.login = function() {
        $log.debug('login sent', $scope.game, $scope.player, $scope.password);
        authService.login($scope.game, $scope.player, $scope.password).then(function(){
            changeLocation($scope, $location, "#/inventory");
        });
    };
    authService.isLoggedIn().then(function(isLoggedIn){
        if ($location.path() == '/login' && isLoggedIn){
            changeLocation($scope, $location, "#/inventory");
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