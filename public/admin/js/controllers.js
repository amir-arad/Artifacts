var admin = admin || {};
admin.controllers = {};

admin.controllers._ = function () {
    return window._; // assumes loDash has already been loaded on the page
};

angular.module('admin.controllers', ['angular-carousel'])
    .controller(admin.controllers)
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
                    if (!isLoggedIn === !$rootScope.loginPage) {
                        // needs a redirection
                        if (isLoggedIn){
                            $rootScope.$emit('login');   // TODO unused?
                            // redirect to inventory
                            $navigate.go('/game');
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
admin.controllers.loginController =  function ($rootScope, $scope, $log, $location, $navigate, authService) {
    $scope.login = function() {
        $log.debug('login sent', $scope.game, $scope.password);
        authService.login($scope.game, $scope.password).then(function(){
            $rootScope.loginPage = false;
            $rootScope.$emit('login');     // TODO unused?
            $navigate.go('/game');
        });
    };
};

/**
 * The login controller.
 */
admin.controllers.logoutController =  function ($rootScope, $log, $navigate, authService) {
    $log.debug('logout called');
    authService.logout().then(function(){
        $rootScope.$emit('logout');           // TODO unused?
        $navigate.go('/login');
    });
};


admin.controllers.headerController =  function ($scope, $location, $navigate) {
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
        "title": "Players",
        "link": "playerList"
    }, {
        "title": "Game",
        "link": "game"
    }, {
        "title": "Ground",
        "link": "ground"
    }, {
        "title": "Log out",
        "link": "logout"
    }];
};

admin.controllers.alertsController =  function($scope, alertService) {
    $scope.alerts = [];
    alertService.init($scope.alerts);
    $scope.closeAlert = alertService.closeAlert;
};


admin.controllers.gameController =  function($scope, apiService, game) {
    $scope.game = game;
    $scope.save = function(){
        apiService.saveGame(game);
    };
};

admin.controllers.playerListController =  function($rootScope, $scope, $log, $navigate, apiService, playerList) {
    $scope.playerList = playerList;
    $scope.newPlayer = {};

    $scope.create = function(){
        $scope.playerList.push($scope.newPlayer)
        apiService.createPlayer($scope.newPlayer)
            .then(function(){
                $scope.newPlayer = {};
            })
            .finally($scope.refresh);
    };

    $scope.refresh = function() {
        apiService.getPlayerList().then(function (playerList) {
            $scope.playerList = playerList;
        });
    }

    $scope.delete = function(playerId){
        $scope.playerList = _.remove($scope.playerList, {'name' : playerId});
        apiService.removePlayer(playerId).finally($scope.refresh);
    };

    $scope.open = function(playerId){
        $navigate.go('/player/' + playerId);
    };
};

admin.controllers.artifactListController = function($scope, apiService, artifactsService, artifacts, owner) {
    $scope.artifacts = artifacts;
    $scope.newArtifact = {};
    $scope.create = function () {
        $scope.newArtifact.owner = owner;
        $scope.artifacts.push($scope.newArtifact)
        artifactsService.createArtifact($scope.newArtifact)
            .then(function () {
                $scope.newArtifact = {};
            })
            .finally($scope.refresh);
    };

    $scope.refresh = function () {
        artifactsService.getArtifactsbyOwner(owner).then(function (artifacts) {
            $scope.artifacts = artifacts;
        });
    }

    $scope.delete = function (artifactsId) {
        $scope.artifacts = _.remove($scope.artifacts, {'name': artifactsId});
        apiService.removeArtifact(artifactsId).finally($scope.refresh);
    };

    $scope.open = function (artifactsId) {
        $navigate.go('/artifact/' + artifactsId);
    };
}

admin.controllers.playerController =  function($scope, apiService, artifactsService, player, artifacts) {
    $scope.player = player;
    $scope.save = function(){
        apiService.savePlayer(player);
    };
    // add functionality to edit artifacts
    admin.controllers.artifactListController($scope, apiService, artifactsService, artifacts, player.name);
};


admin.controllers.artifactController =  function($rootScope, $scope, $log, $navigate, apiService, artifact) {
    $log.debug('inspecting artifact', artifact.name);
    $scope.artifact = artifact;
    $scope.inventory = function(){
        $navigate.go('/inventory');
    };
    $scope.drop = function(){
        apiService.drop(artifact.name).then(function(){
            $rootScope.$emit('refreshScanner');
            $navigate.go('/inventory');
        });
    };
};