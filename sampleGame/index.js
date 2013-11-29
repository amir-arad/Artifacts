/**
 * a module to init a sample game in the Artifacts application
 * User: amira
 * Date: 11/29/13
 * Time: 3:35 PM
 */


module.exports = function(app, config) {

    function sampleGameExists(){

    }


    function initSampleGame(){

    }

    if (sampleGameExists() && config.bootstrapSampleGame !== 'force') return;
    initSampleGame();
}