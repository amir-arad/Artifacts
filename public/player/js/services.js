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
    function enrichArtifactFromApi(artifact) {
        function relativeUrl(relative){
            return baseArtifact(artifact.name).one(relative).getRestangularUrl();
        }
        $log.debug('artifact', artifact.name);
        artifact.iconUrl = relativeUrl(artifact.icon);
        artifact.images =
            _.chain(artifact.assets)
                .filter(function(asset){return asset !== artifact.icon;})
                .map(relativeUrl)
                .value();
        return artifact;
    }

    var service = {
        init : function initApiService (gameId, playerId) {
            $log.debug('context detected', gameId, playerId);
            if (gameId && playerId){
                localStorageService.add('gameId',gameId);
                localStorageService.add('playerId',playerId);
                baseGame = Restangular.one('games', gameId);
                basePlayer = baseGame.one( 'players', playerId);
                basePlayer.addRestangularMethod('login', 'post', 'login');
            }
        },
        getUser: function getUserFromApi(){
            // get /games/:gameId/players/:playerId/login
            return Restangular.one('login').get();
        },
        login: function loginFromApi(password) {
            // post /games/:gameId/players/:playerId/login
            return basePlayer.login({"password" : password});
        },
        logout: function logoutFromApi(password) {
            // post /logout
            return Restangular.one('logout').post();
        },
        inventory: function inventoryFromApi() {
            // https://github.com/mgonto/restangular#adding-custom-methods-to-collections
            // get /games/:gameId/players/:playerId/artifacts
            return basePlayer.one('artifacts').getList().then(function(artifacts){
                return _.forEach(artifacts, enrichArtifactFromApi);
            });
        },
        examine: function examineFromApi(artifactId) {
            // get /games/:gameId/artifacts/:artifactId
            return baseArtifact(artifactId).get().then(enrichArtifactFromApi);
        }
    };
    service.init(localStorageService.get('gameId'), localStorageService.get('playerId'));
    return service;
};




if (Error.captureStackTrace){  // only works in chrome
    Object.defineProperty(window, '__stack', {
        get : function() {
            var orig = Error.prepareStackTrace;
            Error.prepareStackTrace = function(_, stack) {
                return stack;
            };
            var err = new Error();
            Error.captureStackTrace(err, Function.caller);
            var stack = err.stack;
            Error.prepareStackTrace = orig;
            return stack;
        }
    });
}

/**
 * custom logging solution
 */
// todo customize https://github.com/siosio/consoleLink to match
player.services.logService = function () {
    return function($delegate){
        var stackdepth = 3;
        function pathFromUrl(url){
            var parser = document.createElement('a');
            parser.href = url;
            return parser.pathname;
        }

        function proxy(type, args){
            var stack = window.__stack;
            var link = stack ? "FROM " + pathFromUrl(stack[stackdepth].getFileName()) + ':' + stack[stackdepth].getLineNumber() : "";
            var now = new Date().toISOString();
            // turn into array via slice() and then join() into a string
            var content = Array.prototype.slice.call(args).join(" ");
            // formatting
            var line = now + " " + type.toUpperCase() + " " + content + " | " + link;   // TODO add spaces
            // Call the original with the output prepended with formatted timestamp
            $delegate[type].apply(this, [line]);
        }
        return  {
            debug: function(){
                proxy('debug', arguments);
            },
            log: function(){
                proxy('log', arguments);
            },
            info: function(){
                proxy('info', arguments);
            },
            error: function(){
                proxy('error', arguments);
            },
            warn:function(){
                proxy('warn', arguments);
            }
        };
    };
};

/**
 * Launch schemas resource
 * @param $log angular's logging service
 * @param Restangular REST service
 */
player.services.authService = function ($log, apiService) {
    var service = {
        logout: function () {
            $log.debug('logout called');
            return apiService.logout().then(function(){
                $log.debug('logged out');
                apiService.init(null, null);
            });
        },
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

