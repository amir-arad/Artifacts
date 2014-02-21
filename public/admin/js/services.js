
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
                $log.debug('starting game reporting');
                apiSocket.emit('connect', {});       // start reporting data after login
                apiService.startReportToGame();
            }
            connected = true;
        });
        function cleanup() {
            if (connected) {
                $log.debug('cleaning up game reporting');
                apiService.stopReportToGame();
                apiSocket.emit('disconnect');
            }
            connected = false;
        }
        $rootScope.$on('logged out', cleanup);
        $rootScope.$on('$destroy', cleanup);
    }])
    .factory('_',  function () {
        return window._; // assumes loDash has already been loaded on the page
    }).factory('apiSocket', function ($log, socketFactory) {
        $log.debug('creating API socket');
        var result = socketFactory({
            prefix: 'api:'
        });
        return result;
    });

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
/**
 * creates restangular objects to communicate with the server API.
 * each API method returns a promise object that can be listened upon using then(callback)
 * @param $log
 * @param Restangular
 * @returns {{init: Function, login: Function}}
 */
module.factory('apiService', function ($log, Restangular, _, localStorageService) {


    function replaceRepo(repository, newItems) {
        Array.prototype.splice.apply(repository, [0, repository.length].concat(newItems));
    }

    var groundInit = $q.defer();
    var ground = [];

    apiSocket.on('ground:sync', function (artifacts, ack) {
        $log.debug('ground refresh');
        var enrichedArtifacts = _.forEach(newArtifacts, enrichArtifactFromApi);
        replaceRepo(ground, artifacts);
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
});


module.factory('artifactsService', function (apiService) {
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
});


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
module.factory('logService', function () {
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
});

/**
 * Launch schemas resource
 * @param $log angular's logging service
 * @param Restangular REST service
 */
module.factory('authService', function ($log, apiService) {
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
});


module.factory('HttpErrorHandlerService', function ($q, $log, alertService) {
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
});


module.factory('alertService', function ($rootScope, $timeout) {
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
});

