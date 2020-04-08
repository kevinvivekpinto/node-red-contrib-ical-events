
import { Red, Node } from 'node-red';
import * as crypto from "crypto-js";
import { CronJob } from 'cron';
import { Config } from 'kalender-events';
import { getICal, CalEvent, countdown, addOffset, getTimezoneOffset, getConfig, IcalNode, processRRule, processData } from 'kalender-events';
import * as NodeCache from 'node-cache';
var RRule = require('rrule').RRule;
var ce = require('cloneextend');

module.exports = function (RED: Red) {
    function sensorNode(config: any) {
        RED.nodes.createNode(this, config);
        let node: IcalNode = this;

        try {
            node.config = getConfig(RED.nodes.getNode(config.confignode) as unknown as Config, config, null);
            node.cache = new NodeCache();
            node.on('input', (msg:any) => {
                node.config = getConfig(RED.nodes.getNode(config.confignode) as unknown as Config, config, msg);
                cronCheckJob(node);
            });

            if (config.timeout && config.timeout !== "" && config.timeoutUnits && config.timeoutUnits !== "") {
                let cron = '0 0 * * * *';

                switch (config.timeoutUnits) {
                    case 'seconds':
                        cron = `*/${config.timeout} * * * * *`;
                        break;
                    case 'minutes':
                        cron = `0 */${config.timeout} * * * *`;
                        break;
                    case 'hours':
                        cron = `0 0 */${config.timeout} * * *`;
                        break;
                    case 'days':
                        cron = `0 0 0 */${config.timeout} * *`;
                        break;
                    default:
                        break;
                }
                node.job = new CronJob(cron, cronCheckJob.bind(null, node));
                node.job.start();

                node.on('close', () => {
                    node.job.stop();
                });
            }

            cronCheckJob(node);
        }
        catch (err) {
            node.error('Error: ' + err.message);
            node.status({ fill: "red", shape: "ring", text: err.message })
        }
    }

    async function cronCheckJob(node: IcalNode) {
        if (node.job && node.job.running) {
            node.status({ fill: "green", shape: "dot", text: node.job.nextDate().toISOString() });
        }
        else {
            node.status({});
        }

        var dateNow = new Date();
        let data = await getICal(node, node.config);
        node.debug('Ical read successfully ' + node.config.url);
        if (!data) return;

        let current = false;
        let last = node.context().get('on');

        var reslist: CalEvent[] = [];
        processData(data, new Date(), new Date(), addOffset(new Date(), 24 * 60), node, node.config, reslist);

        for (let k in reslist) {
            if (reslist.hasOwnProperty(k)) {
                let ev = reslist[k];
                if (ev.eventStart <= dateNow && ev.eventEnd >= dateNow) {

                    let output = false;
                    if (node.config.trigger == 'match') {
                        let regex = new RegExp(node.config.filter)
                        if (regex.test(ev.summary)) output = true;
                    } else if (node.config.trigger == 'nomatch') {
                        let regex = new RegExp(node.config.filter)
                        if (!regex.test(ev.summary)) output = true;
                    } else {
                        output = true;
                    }

                    let event: CalEvent = {
                        on: false
                    }
                    if (output) {
                        event = ev
                        event.on = true;
                    }
                    node.send({
                        payload: event
                    });
                    current = true;

                    if (last != current) {
                        node.send([null, {
                            payload: event
                        }]);
                    }
                }
            }
        }

        if (!current) {
            const event = {
                on: false
            }

            node.send({
                payload: event
            });

            if (last != current) {
                node.send([null, {
                    payload: event
                }]);
            }
        }

        node.context().set('on', current);
    }

    RED.nodes.registerType("ical-sensor", sensorNode);
}