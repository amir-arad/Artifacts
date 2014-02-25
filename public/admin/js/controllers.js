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
    // TODO here for presentation only
    $scope.game = 'sampleGame';
    $scope.password = '1234';
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
// TODO use and set game location marker
// TODO https://github.com/leaflet-extras/leaflet-providers
// http://tombatossals.github.io/angular-leaflet-directive/examples/layers-example.html
// http://tombatossals.github.io/angular-leaflet-directive/#!/examples/tiles
admin.controllers.groundController = function($scope, mapService, apiService, position) {

    $scope.$on('leafletDirectiveMarker.dragend', function(event, data){
        var markerId = data.markerName;
        if (!markerId.indexOf('rtfct')){    // starts with 'rtfct'
            event.preventDefault();
            var markerData = artifactMarkers[markerId];
            var from = markerData.origLoc;
            var to = _.clone(from, true);
            to.coordinates[0] = data.leafletEvent.target._latlng.lng;
            to.coordinates[1] = data.leafletEvent.target._latlng.lat;
            apiService.moveArtifact(markerData.id, from, to);
        }
    });
    $scope.data = {};
    $scope.data.events= {
        map: {
            enable: ['dragend'],
                logic: 'emit'
        }
    };
    $scope.data.center =  {
        lat: position.latitude || mapService.defaultPosition.lat,
        lng: position.longitude || mapService.defaultPosition.lng,
        zoom: 17
    };

    $scope.data.artifacts = apiService.artifacts;
    $scope.data.players = apiService.players;
    var playerMarkers = {}, artifactMarkers = {};

    var relationalSize = function (origSize, factor){
        return origSize * Math.min(50 + Math.pow(1.15, factor), 150) / 100;
    };


    var refreshRtfctMarkers = function() {
        artifactMarkers = _.indexBy(_.map(apiService.artifacts, function (artifact) {
            return {
                icon: {
                    iconUrl: artifact.iconUrl,
                    iconSize: [60, 60]
                },
                lng: artifact.location.coordinates[0],
                lat: artifact.location.coordinates[1],
                message: artifact.name,
                id: artifact.name,
                origLoc: artifact.location,
                draggable: true
            };
        }), function (rtfct) {
            return 'rtfct' + rtfct.message;
        });
        $scope.data.markers = _.merge(playerMarkers, artifactMarkers);
    }
    var refreshPlyrMarkers = function() {
        playerMarkers = _.indexBy(_.map(_.filter(apiService.players, 'location'), function (player) {
            return {
                icon: {
                    iconUrl: '/img/player.png',
                    iconSize: [relationalSize(52, player.movement), relationalSize(125, player.movement)],
                    iconAnchor: [relationalSize(26, player.movement), relationalSize(125, player.movement)]
                },
                lng: player.location.coordinates[0],
                lat: player.location.coordinates[1],
                message: player.name,
                draggable: false
            };
        }), function (plyr) {
            return 'plyr' + plyr.message;
        });
        $scope.data.markers = _.merge(playerMarkers, artifactMarkers);
    }

    $scope.$watch('data.artifacts', refreshRtfctMarkers, true);
    $scope.$watch('data.players', refreshPlyrMarkers, true);

    $scope.data.markers = _.merge(playerMarkers, artifactMarkers);
    $scope.data.layers = {
        baselayers: {
            cycle: {
                name: 'OpenCycleMap',
                type: 'xyz',
                url: 'http://{s}.tile.opencyclemap.org/cycle/{z}/{x}/{y}.png',
                layerOptions: {
                    subdomains: ['a', 'b', 'c'],
                    attribution: '© OpenCycleMap contributors - © OpenStreetMap contributors',
                    continuousWorld: true
                }
            },
            osm: {
                name: 'OpenStreetMap',
                type: 'xyz',
                url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
                layerOptions: {
                    subdomains: ['a', 'b', 'c'],
                    attribution: '© OpenStreetMap contributors',
                    continuousWorld: true
                }
            },
            googleTerrain: {
                name: 'Google Terrain',
                layerType: 'TERRAIN',
                type: 'google'
            },
            googleHybrid: {
                name: 'Google Hybrid',
                layerType: 'HYBRID',
                type: 'google'
            },
            googleRoadmap: {
                name: 'Google Streets',
                layerType: 'ROADMAP',
                type: 'google'
            },
            cloudmade1: {
                name: 'Cloudmade Night Commander',
                type: 'xyz',
                url: 'http://{s}.tile.cloudmade.com/{key}/{styleId}/256/{z}/{x}/{y}.png',
                layerParams: {
                    key: '007b9471b4c74da4a6ec7ff43552b16f',
                    styleId: 999
                },
                layerOptions: {
                    subdomains: ['a', 'b', 'c'],
                    continuousWorld: true
                }
            },
            cloudmade2: {
                name: 'Cloudmade Tourist',
                type: 'xyz',
                url: 'http://{s}.tile.cloudmade.com/{key}/{styleId}/256/{z}/{x}/{y}.png',
                layerParams: {
                    key: '007b9471b4c74da4a6ec7ff43552b16f',
                    styleId: 7
                },
                layerOptions: {
                    subdomains: ['a', 'b', 'c'],
                    continuousWorld: true
                }
            }
        },
        overlays : {
            /*                wms: {
             name: 'EEUU States (WMS)',
             type: 'wms',
             visible: true,
             url: 'http://suite.opengeo.org/geoserver/usa/wms',
             layerParams: {
             layers: 'usa:states',
             format: 'image/png',
             transparent: true
             }
             }*/
        }
    };

    $scope.data.defaults = {
        minZoom: 12,
        doubleClickZoom: true,
        scrollWheelZoom: true,
        attributionControl: false

        /*,
         icon: {
         url: 'http://cdn.leafletjs.com/leaflet-0.6.4/images/marker-icon.png',
         retinaUrl: 'http://cdn.leafletjs.com/leaflet-0.6.4/images/marker-icon@2x.png',
         size: [25, 41],
         anchor: [12, 40],
         popup: [0, -40],
         shadow: {
         url: 'http://cdn.leafletjs.com/leaflet-0.6.4/images/marker-shadow.png',
         retinaUrl: 'http://cdn.leafletjs.com/leaflet-0.6.4/images/marker-shadow.png',
         size: [41, 41],
         anchor: [12, 40]
         }
         },
         path: {
         weight: 10,
         opacity: 1,
         color: '#0000ff'
         }*/
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
};

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