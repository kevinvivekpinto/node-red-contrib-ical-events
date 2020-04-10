var helper = require("node-red-node-test-helper");
var chai = require("chai");
var icalUpcomingNode = require("../dist/ical-upcoming.js");
var icalConfigNode = require("../dist/ical-config.js");
const nodeIcal = require("node-ical");
const moment = require("moment");
var sinon = require('sinon');
const test_helper = require('./test_helper');
var expect = chai.expect;
chai.use(require('chai-like'));
chai.use(require('chai-things')); // Don't swap these two
helper.init(require.resolve('node-red'));

describe('Upcoming Node', function () {

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
            { id: "c1", type: "ical-config", url: "https://domain.com/calendar.ics" },
            { id: "n1", type: "ical-upcoming", confignode: "c1" }
        ];

        helper.load([icalConfigNode, icalUpcomingNode], flow, function () {
            var n1 = helper.getNode("n1");
            n1.should.have.property('type', 'ical-upcoming');
            done();
        });
    });
});
