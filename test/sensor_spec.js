var should = require("should");
var helper = require("node-red-node-test-helper");
var icalSensorNode = require("../dist/ical-sensor.js");
var icalConfigNode = require("../dist/ical-config.js");
const moment = require("moment");
var sinon = require('sinon');
const test_helper = require('./test_helper');
const nodeIcal = require("node-ical");
var chai = require("chai");
var expect = chai.expect;
chai.use(require('chai-like'));
chai.use(require('chai-things')); // Don't swap these two

helper.init(require.resolve('node-red'));

describe('Sensor Node', function () {

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload().then(function () {
            helper.stopServer(done);
        });
    });

       it('should be loaded', function (done) {
        var flow = [
            { id: "c1", type: "ical-config" },
            { id: "n1", type: "ical-sensor", config: "c1" }
        ];

        helper.load([icalConfigNode, icalSensorNode], flow, function () {
            var n1 = helper.getNode("n1");
            n1.should.have.property('type', 'ical-sensor');
            done();
        });
    });
});
