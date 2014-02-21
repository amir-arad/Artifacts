var player = player || {};
player.services = {};

angular.module('player.services', ['restangular'])
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
    .run(['$rootScope', '$log',  'apiService', 'apiSocket', function($rootScope, $log,  apiService, apiSocket) {
        var initialized = false;
        // sync logical socket lifecycle to login session
        $rootScope.$on('logged in', function(){
            if (!initialized){
                $log.debug('starting game reporting');
                apiSocket.connect().then(function(apiSocket){
                    apiSocket.emit('init');       // start reporting data after login
                    apiService.startReportToGame();
                });
            }
            initialized = true;
        });
        function cleanup() {
            if (initialized) {
                $log.debug('cleaning up game reporting');
                apiService.stopReportToGame();
                apiSocket.emit('destroy');
            }
            initialized = false;
        }
        $rootScope.$on('logged out', cleanup);
        $rootScope.$on('$destroy', cleanup);
    }])
    .factory('_',  function () {
        return window._; // assumes loDash has already been loaded on the page
    }).factory('apiSocket', function ($log, $q, socketFactory) {
        $log.debug('creating API socket');
        // the API socket available as a service before the connection begins.
        // it is important not to connect the socket before being logged in,
        // otherwise the server rejects the connection.
        // calling connect() on the result will trigger the connection and return a promise to a connected socket
        // add/remove listeners is supported at all times
        var defSoc = $q.defer();
        var sPromise = defSoc.promise;
        var realSoc = null;
        var result = socketFactory({
            prefix: 'api:',
            ioSocket : {
                on : function (){
                    var a = arguments;
                    if (realSoc){
                        realSoc.on.apply(realSoc, a);
                    } else{
                        defSoc.promise.then(function(realSoc){
                            realSoc.on.apply(realSoc, a);
                        });
                    }
                },
                removeListener : function (){
                    var a = arguments;
                    if (realSoc){
                        realSoc.removeListener.apply(realSoc, a);
                    } else{
                        defSoc.promise.then(function(realSoc){
                            realSoc.removeListener.apply(realSoc, a);
                        });
                    }
                },
                emit : function (){
                    if (realSoc){
                        realSoc.emit.apply(realSoc, arguments);
                    }  // ignore offline emits
                }
            }
        });
        result.connect = function(){
            if (!realSoc){
                var defConnect = $q.defer();
                realSoc = window.io.connect();
                realSoc.on("connect", function(){
                    defConnect.resolve(result);
                });
                defSoc.resolve(realSoc);
                return defConnect.promise;
            }
            return $q.when(result);
        };
        return result;
    })

/**
 * creates restangular objects to communicate with the server API.
 * each API method returns a promise object that can be listened upon using then(callback)
 * @param $log
 * @param Restangular
 * @returns {{init: Function, login: Function}}
 */
    .factory('apiService', ['$log', '$q', 'Restangular', '_', 'localStorageService', 'apiSocket', 'geoLocationService', 'gyroAccelService', 'alertService',
        function ($log, $q, Restangular, _, localStorageService, apiSocket, geoLocationService, gyroAccelService, alertService) {
            var baseGame;     //    /games/:gameId
            var basePlayer;   //    /games/:gameId/players/:playerId
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

            apiSocket.on('inventory:sync', function (artifacts, ack) {
                $log.debug('inventory refresh');
                replaceRepoArtifacts(inventory, artifacts);
                inventoryInit.resolve();
                ack();
            });
            apiSocket.on('nearby:sync', function (artifacts, ack) {
                $log.debug('nearby refresh');
                replaceRepoArtifacts(nearby, artifacts);
                nearbyInit.resolve();
                ack();
            });
            var locationWatch = -1;
            var accelerationWatch = -1;
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
                    var vectorPower = function(x, y, z){
                        return Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2) + Math.pow(z, 2));
                    };
                    // listen to gyro acceleration
                    // calculating "movement" which is the average of aceleration shifts during the time period
                    accelerationWatch = gyroAccelService.track(function(events){
                        var lastEvent =  events.shift();
                        var sum = _.reduce(events, function(result, event) {
                            // deriviate acceleration over time: delta acceleration / delta time
                            result += vectorPower(
                                event.accelerationIncludingGravity.x - lastEvent.accelerationIncludingGravity.x,
                                event.accelerationIncludingGravity.y - lastEvent.accelerationIncludingGravity.y,
                                event.accelerationIncludingGravity.z - lastEvent.accelerationIncludingGravity.z) / (event.timeStamp - lastEvent.timeStamp);
                            lastEvent = event;
                            return result;
                        }, 0);
                        // average
                        var avgMovement = Math.floor((sum * 300) / (events.length));    // 300 was chosen by simple trial and error (only include actual human movements)
                        if (avgMovement){
                            apiSocket.emit('report', {movement : avgMovement});
                        }
                    }, {throttleEvent : 200, throttleCallback : 2000});

                    var sendLocationToServer = function(position){
                        apiSocket.emit('report', {"location" : { "type": "Point", "coordinates": [position.coords.longitude, position.coords.latitude]}});
                    };
                    // getting geolocation
                    geoLocationService.query()     // query geolocation directly at first
                        .then(sendLocationToServer).catch(function(error){
                            alertService.add("error obtaining position : " + error.message);
                        });

                    // then passively listen to geolocation changes and update every 5 seconds
                    locationWatch = geoLocationService.track(sendLocationToServer, function(error){
                        alertService.add("error obtaining position : " + error.message);
                    }, {throttle : 5000, enableHighAccuracy : false});
                },
                stopReportToGame: function stopReportToGameFromApi(){
                    geoLocationService.stopTracking(locationWatch);
                    gyroAccelService.stopTracking(accelerationWatch);
                },
                inventory: function inventoryFromApi() {
                    return $q.when(inventory);  // wrap with promise to hide implementation
                },
                nearby: function nearbyFromApi() {
                    return $q.when(nearby);  // wrap with promise to hide implementation
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
        }])



/**
 * custom logging solution
 */
// todo customize https://github.com/siosio/consoleLink to match
    .factory('logService', function () {
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
    })

/**
 * Launch schemas resource
 * @param $log angular's logging service
 * @param Restangular REST service
 */
    .factory('authService', ['$log', '$rootScope', 'apiService', 'apiSocket', function($log, $rootScope, apiService, apiSocket) {
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
                    if (user && user !== 'null' && user.type === "player"){
                        apiService.init(user.game, user.playerName);
                        $rootScope.$emit('logged in');
                        return true;
                    }
                    return false;
                });
            }
        };

        return service;
    }])


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
    .factory('geoLocationService', ['$window', '$q', '$rootScope', '_', function ($window, $q, $rootScope, _) {
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
                var minTimeBetweenCalls =  (options && options.throttle) || 30000;
                return $window.navigator.geolocation.watchPosition(
                    _.throttle(_.compose(scopeApply, _.partial(_.partial, successCallback)), minTimeBetweenCalls, {leading: false}),
                    _.throttle(_.compose(scopeApply, _.partial(_.partial, errorCallback)), minTimeBetweenCalls, {leading: false}),
                    options);
            },
            stopTracking : function(watchId) {
                return $window.navigator.geolocation.clearWatch(watchId);
            }
        };
    }])
    .factory('gyroAccelService', ['$window', '$rootScope', '_', function ($window, $rootScope, _) {
        if (!$window.DeviceMotionEvent){
            throw new Error("motion sensor required");
        }
        var appenders = {};
        return {
            track : function(callback, options) {
                var minTimeBetweenSamples =  (options && options.throttleEvent) || 100;
                var minTimeBetweenCallback =  (options && options.throttleCallback) || 5000;
                var events = [];
                var appender = _.throttle(_.bind(Array.prototype.push, events), minTimeBetweenSamples, {leading: false});
                $window.addEventListener('devicemotion', appender);
                var handler = function () {
                    if (events.length) {
                        var oldEvents = events.splice(0, events.length);
                        $rootScope.$apply(_.partial(callback, oldEvents));
                    }
                };
                var trackId = $window.setInterval(handler, minTimeBetweenCallback);
                appenders[trackId] = appender;
                return trackId;
            },
            stopTracking : function(trackId) {
                window.removeEventListener('devicemotion', appenders[trackId]);
                delete appenders[trackId];
                $window.clearInterval(trackId);
            }
        };
    }])


    .factory('HttpErrorHandlerService', ['$q', '$log', 'alertService', function ($q, $log, alertService) {
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
    }])


    .factory('alertService', ['$timeout', function ($timeout) {
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
    }]);




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