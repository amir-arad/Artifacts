
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


var baseGame;     //    /games/:gameId

function baseArtifact(artifactId) {
    //      /games/:gameId/artifacts/:artifactId
    return baseGame.one('artifacts', artifactId);
}

function enrichArtifactFromApi(artifact) {
    // https://github.com/mgonto/restangular#adding-custom-methods-to-collections
    function relativeUrl(relative){
        return baseArtifact(artifact.name).one(relative).getRestangularUrl();
    }
    artifact.iconUrl = relativeUrl(artifact.icon);
    artifact.images =
        _.chain(artifact.assets)
            .filter(function(asset){return asset !== artifact.icon;})
            .map(relativeUrl)
            .value();
    return artifact;
}

var module = angular.module('admin.services', ['restangular'])
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
        var connected = false;
        // sync logical socket lifecycle to login session
        $rootScope.$on('logged in', function(){
            if (!connected){
                apiSocket.connect().then(function(apiSocket){
                    apiSocket.emit('init');       // start reporting data after login
                });
            }
            connected = true;
        });
        function cleanup() {
            if (connected) {
                apiSocket.emit('destroy');
            }
            connected = false;
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
    .factory('apiService', function ($log, $q, Restangular, _, localStorageService, apiSocket) {


        function replaceRepo(repository, newItems) {
            Array.prototype.splice.apply(repository, [0, repository.length].concat(newItems));
        }

        var groundInit = $q.defer();
        var ground = [];

        apiSocket.on('ground:sync', function (newArtifacts, ack) {
            $log.debug('ground refresh');
            var enrichedArtifacts = _.forEach(newArtifacts, enrichArtifactFromApi);
            replaceRepo(ground, newArtifacts);
            groundInit.resolve();
            ack();
        });

        var service = {
            init : function initApiService (gameId) {
                $log.debug('context detected', gameId);
                if (gameId){
                    localStorageService.add('gameId',gameId);
                    baseGame = Restangular.one('games', gameId);
                    baseGame.addRestangularMethod('login', 'post', 'login');
                }
            },
            getUser: function getUserFromApi(){
                // get /games/:gameId/login
                return Restangular.one('login').get();
            },
            login: function loginFromApi(password) {
                // post /games/:gameId/login
                return baseGame.login({"password" : password});
            },
            logout: function logoutFromApi(password) {
                // post /logout
                return Restangular.one('logout').post();
            },
            getGame: function getGameFromApi(){
                // get /games/:gameId
                return baseGame.get();
            },
            saveGame: function saveGameFromApi(game){
                // put /games/:gameId
                return game.put(); //baseGame.put(game);
            },

//        player CRUD + list
            getPlayerList: function getPlayerListFromApi(){
                // get /games/:gameId/players
                return baseGame.one('players').getList();
            },
            getPlayer: function getPlayerFromApi(playerName){
                // get /games/:gameId/players/:playerId
                return baseGame.one('players', playerName).get();
            },
            createPlayer: function createPlayerFromApi(player){
                // post /games/:gameId/players/:playerId
                return baseGame.all('players').post(player);
            },
            savePlayer: function savePlayerFromApi(player){
                // put /games/:gameId/players/:playerId
                return player.put(); //baseGame.one('players', player.name).put(player);
            },
            removePlayer: function removePlayerFromApi(playerName){
                // delete /games/:gameId/players/:playerId
                return baseGame.one('players', playerName).remove();
            },

//        artifact CRUD + list
            getArtifactList: function getArtifactListFromApi(){
                // get /games/:gameId/artifacts
                return baseGame.one('artifacts').getList().then(function(artifacts){
                    return _.forEach(artifacts, enrichArtifactFromApi);
                });
            },
            getArtifact: function getArtifactFromApi(artifactId){
                // get /games/:gameId/artifacts/:artifactId
                return baseGame.one('artifacts', artifactId).get();
            },
            createArtifact: function createArtifactFromApi(artifact){
                // post /games/:gameId/artifacts/:artifactId
                return baseGame.all('artifacts').post(artifact);
            },
            moveArtifact: function moveArtifactFromApi(artifactId, from, to){
                // put '/games/:gameId/artifacts/:artifactId/location'
                return baseGame.one('artifacts', artifactId)
                    .customPUT({"from" : from, "to" : to}, 'location');
            },
            saveArtifact: function saveArtifactFromApi(artifact){
                // put /games/:gameId/artifacts/:artifactId
                return artifact.put(); //baseGame.one('artifacts', artifact.name).put(artifact);
            },
            removeArtifact: function removeArtifactFromApi(artifactId){
                // delete /games/:gameId/artifacts/:artifactId
                return baseGame.one('artifacts', artifactId).remove();
            },

//        assets CRUD + list
            getAssetList: function getAssetListFromApi(){
                // get /games/:gameId/assets
                return baseGame.one('assets').getList();
            },
            getAsset: function getAssetFromApi(assetsId){
                // get /games/:gameId/assets/:assetsId
                return baseGame.one('assets', assetsId).get();
            },
            createAsset: function createAssetFromApi(asset){
                // post /games/:gameId/assets/:assetsId
                return baseGame.all('assets').post(asset);
            },
            removeAsset: function removeAssetFromApi(assetsId){
                // delete /games/:gameId/assets/:assetsId
                return baseGame.one('assets', assetsId).remove();
            }
        };
        service.init(localStorageService.get('gameId'));
        return service;
    })
    .factory('artifactsService', function (apiService) {
        var service = {
//        artifact CRUD + list
            getArtifactsbyOwner: function getArtifactsbyOwner(owner){
                // get /games/:gameId/artifacts
                return apiService.getArtifactList().then(function(artifacts){
                    return  _.chain(artifacts).where({'owner': owner}).forEach(enrichArtifactFromApi).value();
                });
            },
            getArtifact: function (artifactId){
                return apiService.getArtifact();
            },
            createArtifact: function (artifact){
                return apiService.createArtifact(artifact);
            },
            saveArtifact: function (artifact){
                return apiService.saveArtifact(artifact);
            },
            removeArtifact: function (artifactId){
                return apiService.removeArtifact(artifactId);
            },
        };

        return service;
    })

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
    .factory('authService', function ($log, $rootScope, apiService) {
        var service = {
            logout: function () {
                $log.debug('logout called');
                return apiService.logout().then(function(){
                    $log.debug('logout executed');
                    $rootScope.$emit('logged out');
                    apiService.init(null);
                });
            },
            login: function (gameId, password) {
                $log.debug('login called', gameId, password);
                return service.isLoggedIn().then(function(loggedIn){
                    if (!loggedIn){
                        apiService.init(gameId);
                        return apiService.login(password).then(function(){
                            $log.debug('loggin executed');
                            $rootScope.$emit('logged in');
                        });
                    }
                });
            },
            isLoggedIn: function(){
                return apiService.getUser().then(function(user){
                    if (user && user !== 'null' && user.type !== "player"){
                        apiService.init(user.game);
                        $rootScope.$emit('logged in');
                        return true;
                    }
                    return false;
                });
            }
        };

        return service;
    }).factory('HttpErrorHandlerService', function ($q, $log, alertService) {
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
    })
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


    .factory('alertService', function ($rootScope, $timeout) {
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
    })

//marker:
//{
//    lat: 38.716,
//    lng: -9.13,
//    message: "I'm a static marker",
//    icon: {{icon}}
// or:
//{
//    {
//            lat: 59.91,
//            lng: 10.75,
//            message: "I want to travel here!",
//            focus: true,
//            draggable: false
//    }
//}
// img icon:
//{
//    iconUrl: 'examples/img/leaf-green.png',
//        shadowUrl: 'examples/img/leaf-shadow.png',
//    iconSize:     [38, 95], // size of the icon
//    shadowSize:   [50, 64], // size of the shadow
//    iconAnchor:   [22, 94], // point of the icon which will correspond to marker's location
//    shadowAnchor: [4, 62],  // the same for the shadow
//    popupAnchor:  [-3, -76] // point from which the popup should open relative to the iconAnchor
//}
// div icon:
//{
//    type: 'div',
//        iconSize: [230, 0],
//    html: 'Using <strong>Bold text as an icon</strong>',
//    popupAnchor:  [0, 0]
//}
    .factory('mapService', function ($rootScope, $log, $q, apiSocket, apiService) {
        var artifactMarkers = {};
        var playerMarkers = {};
        var allMarkers = {data:{}};
        var artifactMarkersInit = $q.defer();
        var playerMarkersInit = $q.defer();
        apiSocket.on('ground:sync', function (newArtifacts, ack) {
            $log.debug('ground refresh');
            // convert artifacts to map markers and save to artifactMarkers
            artifactMarkers = _.indexBy(_.map(newArtifacts, function (artifact) {
                return {
                    icon: {
                        iconUrl: '/img/potion.png',
                        iconSize:     [71, 99]
                    },
                    lng: artifact.location.coordinates[0],
                    lat: artifact.location.coordinates[1],
                    message: artifact.name,
                    id : artifact.name,
                    origLoc : artifact.location,
                    draggable: true
                };
            }), _.partial(_.uniqueId, 'rtfct'));
            allMarkers.data =  _.merge(playerMarkers, artifactMarkers);
            artifactMarkersInit.resolve();
            ack();
        });

        var relationalSize = function (origSize, factor){
            return origSize * Math.min(50 + Math.pow(1.15, factor), 150) / 100;
        };
        var player2Marker = function (player) {
            return {
                icon: {
                    iconUrl: '/img/player.png',
                    iconSize:     [relationalSize(52, player.movement), relationalSize(125, player.movement)],
                    iconAnchor:   [relationalSize(26, player.movement), relationalSize(125, player.movement)]
                },
                lng: player.location.coordinates[0],
                lat: player.location.coordinates[1],
                message: player.name,
                draggable: false
            };
        };
        apiSocket.on('players:sync', function (newPlayers) {
            $log.debug('players refresh');
            // convert players to map markers and save to playerMarkers
            playerMarkers = _.indexBy(_.map(_.filter(newPlayers, 'location'), player2Marker)
                , _.partial(_.uniqueId, 'plyr'));
            allMarkers.data =  _.merge(playerMarkers, artifactMarkers);
            playerMarkersInit.resolve();
        });
        apiSocket.on('players:set', function (player) {
            $log.debug('player update');
            if (player.location) {
                // convert artifacts to map markers
                var marker = player2Marker(player);
                playerMarkers[marker.id] = marker;
                allMarkers.data[marker.id] = marker;
            }
        });
        return {
            ready : $q.all([artifactMarkersInit.promise, playerMarkersInit.promise]),
            // bind to context by return value
            markers: allMarkers,
            defaultPosition : { // some game site
                lng: 34.811,
                lat: 32.100
            },
            handleDrag : function(event, data){
                var markerId = data.markerName;
                if (!markerId.indexOf('rtfct')){    // starts with 'rtfct'
                    var markerData = artifactMarkers[markerId];
                    var from = markerData.origLoc;
                    var to = _.clone(from, true);
                    to.coordinates[0] = data.leafletEvent.target._latlng.lng;
                    to.coordinates[1] = data.leafletEvent.target._latlng.lat;
                    apiService.moveArtifact(markerData.id, from, to);
                }
            }
        };
    });

