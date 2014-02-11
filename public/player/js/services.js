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
    })
    .run(function($rootScope, $timeout, $log,  apiService, apiSocket, geoLocationService, alertService) {
        var connected = false;
        var interval = 5000;  // todo get allow server to modify this
        var timer = $timeout(angular.noop, 1);  // init timer so that stopReporting() never fails
        function reportToGame(){
            apiService.reportToGame()['finally'](function(){     // 'finally' is a reserved word in JavaScript, and IE8 takes it seriously
                timer = $timeout(reportToGame, interval);
            });
        }
        function stopReporting() {
            $timeout.cancel(timer);
        };
        $rootScope.$on('$destroy', stopReporting);
        // sync logical socket lifecycle to login session
        $rootScope.$on('logged in', function(){
            $log.debug('logged in detected');
            if (!connected){
                apiSocket.emit('connect', {}, reportToGame);       // start reporting data after login
                apiService.startReportToGame();
            }
            connected = true;
        });
        $rootScope.$on('logged out', function(){
            $log.debug('logged out detected');
            stopReporting();
            if (connected){
                apiService.stopReportToGame();
                apiSocket.emit('disconnect');
            }
            connected = false;
        });
        // apiSocket.forward(['inventory', 'nearby'], $rootScope);
    });


player.services._ = function () {
    return window._; // assumes loDash has already been loaded on the page
};

player.services.apiSocket = function ($log, socketFactory) {
    $log.debug('creating API socket');
    var result = socketFactory({
        prefix: 'api:'
    });
    return result;
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
player.services.apiService = function ($log, $q, Restangular, _, localStorageService, apiSocket, geoLocationService, alertService) {
    function baseArtifact(artifactId) {
        //      /games/:gameId/artifacts/:artifactId
        return baseGame.one('artifacts', artifactId);
    }
    function enrichArtifactFromApi(artifact) {
        // https://github.com/mgonto/restangular#adding-custom-methods-to-collections
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

    function replaceRepoArtifacts(repository, newArtifacts) {
        var enrichedArtifacts = _.forEach(newArtifacts, enrichArtifactFromApi);
        Array.prototype.splice.apply(repository, [0, repository.length].concat(enrichedArtifacts));
    }

    var inventoryInit = $q.defer();
    var nearbyInit = $q.defer();
    var inventory = [];
    var nearby = [];

    apiSocket.on('inventory:sync', function (artifacts) {
        $log.debug('inventory refresh');
        replaceRepoArtifacts(inventory, artifacts);
        inventoryInit.resolve();
    });
    apiSocket.on('nearby:sync', function (artifacts) {
        $log.debug('nearby refresh');
        replaceRepoArtifacts(nearby, artifacts);
        nearbyInit.resolve();
    });
    var locationWatch = -1;
    var service = {
        ready : $q.all([inventoryInit.promise, nearbyInit.promise]),   // this data-less promise will resolve after both inventory and nearby are set
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
        startReportToGame: function startReportToGameFromApi(){
            $log.debug('reporting');
            // getting geolocation
            geoLocationService.query()
                .then(function (position){
                    locationWatch = geoLocationService.track(function(position){
                        apiSocket.emit('report', {location : position.coords});
                    }, function(error){
                        alertService.add("error obtaining position : " + error.message);
                    }, {throttle : 5000, enableHighAccuracy : false});
                    apiSocket.emit('report', {location : position.coords});
                }).catch(function(error){
                    alertService.add("error obtaining position : " + error.message);
                });
            // TODO add gyro support
        },
        stopReportToGame: function stopReportToGameFromApi(){
            geoLocationService.stopTracking(locationWatch)
        },
        inventory: function inventoryFromApi() {
            return $q.when(inventory);  // wrap with promise to hide implementation
        },
        nearby: function nearbyFromApi() {
            return $q.when(nearby)  // wrap with promise to hide implementation
        },
        examine: function examineFromApi(artifactId) {
            // get /games/:gameId/artifacts/:artifactId
            return baseArtifact(artifactId).get().then(enrichArtifactFromApi);
        },
        drop: function dropFromApi(artifactId){
            // del /games/:gameId/players/:playerId/artifacts/:artifactId
            return basePlayer.one('artifacts', artifactId).remove();
        },
        pickup: function pickupFromApi(artifactId) {
            // put /games/:gameId/players/:playerId/nearby/:artifactId with no body
            return basePlayer.one('nearby', artifactId).customPUT();
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
player.services.authService = function ($log, $rootScope, apiService) {
    var service = {
        logout: function () {
            $log.debug('logout called');
            return apiService.logout().then(function(){
                $log.debug('logout executed');
                $rootScope.$emit('logged out');
                apiService.init(null, null);
            });
        },
        login: function (gameId, playerId, password) {
            $log.debug('login called', gameId, playerId, password);
            return service.isLoggedIn().then(function(loggedIn){
                if (!loggedIn){
                    apiService.init(gameId, playerId);
                    return apiService.login(password).then(function(){
                        $log.debug('loggin executed');
                        $rootScope.$emit('logged in');
                    });
                }
            });
        },
        isLoggedIn: function(){
            return apiService.getUser().then(function(user){
                if (user && user.type === "player"){
                    apiService.init(user.game, user.playerName);
                    $rootScope.$emit('logged in');
                    return user.playerName;
                }
                return null;
            });
        }
    };

    return service;
};


//    interface Position {
//        readonly attribute Coordinates coords;
//        readonly attribute DOMTimeStamp timestamp;
//    };

//    interface Coordinates {
//        readonly attribute double latitude;
//        readonly attribute double longitude;
//        readonly attribute double? altitude;
//        readonly attribute double accuracy;
//        readonly attribute double? altitudeAccuracy;
//        readonly attribute double? heading;
//        readonly attribute double? speed;
//    }

// http://dev.w3.org/geo/api/spec-source.html#position_options_interface
//interface PositionOptions {
//    attribute boolean enableHighAccuracy;
//    attribute long timeout;
//    attribute long maximumAge;
//};

// todo use optimistic high accuracy with timeout fallback:
// http://stackoverflow.com/questions/9053262/geolocation-html5-enablehighaccuracy-true-false-or-best-option
player.services.geoLocationService = function ($window, $q, $rootScope, _) {
    if (!$window.navigator){
        throw new Error("geo-location support required");
    }
    var scopeApply = _.bind($rootScope.$apply, $rootScope);
    return {
        query: function (options) {
            var defer = $q.defer();
            $window.navigator.geolocation.getCurrentPosition(
                _.compose(scopeApply, _.partial(_.bind, defer.resolve, defer)),
                _.compose(scopeApply, _.partial(_.bind, defer.reject, defer)),
                options);
            return defer.promise;
        },
        track : function(successCallback, errorCallback, options) {
            var minTimeBetweenCalls =  (options && options.throttle) || 5000;
            return $window.navigator.geolocation.watchPosition(
                _.compose(scopeApply, _.partial(_.partial, _.throttle(successCallback, minTimeBetweenCalls, {leading: false}))),
                _.compose(scopeApply, _.partial(_.partial, _.throttle(errorCallback, minTimeBetweenCalls, {leading: false}))),
                options);
        },
        stopTracking : function(watchId) {
            return $window.navigator.geolocation.clearWatch(watchId);
        }
    };
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

