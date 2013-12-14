var player = player || {};
player.services = {};

angular.module('player.services', ['restangular'])
    .factory(player.services)
    // configure restangular
    .config(function(RestangularProvider) {
        RestangularProvider.setRestangularFields({
            id: "name"
        });
        RestangularProvider.setResponseExtractor(function (response) {
            response.data = {};
            if (angular.isArray(response)) {
                angular.forEach(response, function(value, key) {
                    response.data[key] = angular.copy(value);
                });
            } else {
                response.data = angular.copy(response);
            }
            return response;
        });
    });


player.services._ = function () {
    return window._; // assumes loDash has already been loaded on the page
};

var baseGame;     //    /games/:gameId
var basePlayer;   //    /games/:gameId/players/:playerId
/**
 * creates restangular objects to communicate with the server API.
 * each API method returns a promise object that can be listened upon using then(callback)
 * @param $log
 * @param Restangular
 * @returns {{init: Function, login: Function}}
 */
player.services.apiService = function ($log, Restangular, _, localStorageService) {
    function baseArtifact(artifactId) {
        //      /games/:gameId/artifacts/:artifactId
        return baseGame.one('artifacts', artifactId);
    }
    var service = {
        init : function (gameId, playerId) {
            $log.debug('init called', gameId, playerId);
            if (gameId && playerId){
                localStorageService.add('gameId',gameId);
                localStorageService.add('playerId',playerId);
                baseGame = Restangular.one('games', gameId);
                basePlayer = baseGame.one( 'players', playerId);
                basePlayer.addRestangularMethod('login', 'post', 'login');
            }
        },
        getUser: function(){
            // get /games/:gameId/players/:playerId/login
            return Restangular.one('login').get();
        },
        login: function (password) {
            // post /games/:gameId/players/:playerId/login
            return basePlayer.login({"password" : password});
        },
        inventory: function () {
            // https://github.com/mgonto/restangular#adding-custom-methods-to-collections
            // get /games/:gameId/players/:playerId/artifacts
            return basePlayer.one('artifacts').getList().then(function(artifacts){
                return _(artifacts).forEach(function(artifact) {
                    $log.debug('enriching artifact', artifact.name);
                    artifact.examine = _.partial(service.examine, artifact.name);
                    artifact.url = baseArtifact(artifact.name).getRestangularUrl();
                });
            });
        },
        examine: function (artifactId) {
            // get /games/:gameId/artifacts/:artifactId
            return baseArtifact(artifactId).get();
        }
    };
    service.init(localStorageService.get('gameId'), localStorageService.get('playerId'));
    return service;
};

/**
 * Launch schemas resource
 * @param $log angular's logging service
 * @param Restangular REST service
 */
player.services.authService = function ($log, apiService) {
    var service = {
        login: function (gameId, playerId, password) {
            $log.debug('login called', gameId, playerId, password);
            return service.isLoggedIn().then(function(loggedIn){
                if (!loggedIn){
                    apiService.init(gameId, playerId);
                    return apiService.login(password);
                }
            });
        },
        isLoggedIn: function(){
            return apiService.getUser().then(function(user){
                if (user && user.type === "player"){
                    apiService.init(user.game, user.playerName);
                    return user.playerName;
                }
                return null;
            });
        }
    };

    return service;
};


player.services.HttpErrorHandlerService = function ($q, $log, alertService) {
    var errorResponses = {
        "400" : { "type": "error", "message": "Bad Request.	The request cannot be fulfilled due to bad syntax"},
        "403" : { "type": "error", "message": "Access denied. You don't have the required permissions"},
        "404" : { "type": "error", "message": "The requested resource could not be found"},
        "415" : { "type": "error", "message": "Unsupported Media Type. The server will not accept the request, because the media type is not supported"},
        "500" : { "type": "error", "message": "Internal Server Error"},
        "501" : { "type": "error", "message": "Request is not implemented"},
        "503" : { "type": "warn", "message": "Service Unavailable"}
    };

    var service = {
        response: function (response) {
            return response;
        },
        responseError: function (response) {
            $log.warn("Failed response received. Status: " + response.status);
            var errorResponse = errorResponses[response.status] || {"type": "error", "message": "Failed to execute request. Http error code: " + response.status};
            alertService.add(errorResponse.type, errorResponse.message);
            return $q.reject(response);
        }
    };

    return service;
};


player.services.alertService = function ($rootScope, $timeout) {
    var alerts = [];
    var alertService = {
        init: function (alertsArg){
            alerts = alertsArg || alerts;
        },
        add: function (type, msg) {
            var length = alerts.push({'type': type, 'msg': msg});
            $timeout(function () {
                alertService.closeAlert(length - 1);
            }, 5 * 1000);
        },
        closeAlert: function (index) {
            alerts.splice(index, 1);
        }
    };

    return alertService;
};

