import { Red, Node } from 'node-red';
import { CronJob } from 'cron';
import { Config } from './ical-config';
import * as moment from 'moment';
import { getICal, CalEvent, countdown, addOffset, getTimezoneOffset, getConfig, IcalNode, checkDates, processRRule, formatDate, processData } from './helper';
import * as NodeCache from 'node-cache';

var parser = require('cron-parser');
var ce = require('cloneextend');

module.exports = function (RED: Red) {


    function upcomingNode(config: any) {
        RED.nodes.createNode(this, config);
        let node: IcalNode = this;
        node.cache = new NodeCache();
        node.config = getConfig(RED.nodes.getNode(config.confignode) as unknown as Config, config, null);
        node.on('input', (msg) => {
            node.config = getConfig(RED.nodes.getNode(config.confignode) as unknown as Config, config, msg);
            cronCheckJob(node);
        });
        try {
            let cron = '';

            if (config.timeout && config.timeout !== '' && parseInt(config.timeout) > 0 && config.timeoutUnits && config.timeoutUnits !== '') {
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
            }
            if (config.cron && config.cron !== '') {
                parser.parseExpression(config.cron);
                cron = config.cron;
            }

            if (cron !== '') {
                node.job = new CronJob(cron, cronCheckJob.bind(null, node));

                node.on('close', () => {
                    node.job.stop();
                    node.debug('cron stopped');
                });

                node.job.start();
            }
        } catch (err) {
            node.error('Error: ' + err.message);
            node.status({ fill: 'red', shape: 'ring', text: err.message });
        }
    }

    async function cronCheckJob(node: IcalNode) {
        if (node.job && node.job.running) {
            node.status({ fill: 'green', shape: 'dot', text: node.job.nextDate().toISOString() });
        } else {
            node.status({});
        }

        node.datesArray_old = ce.clone(node.datesArray);
        node.datesArray = [];
        try {
            let data = await checkICal(node);
            displayDates(node, node.config,data);
        } catch (err) {
            node.error('Error: ' + err);
            node.status({ fill: 'red', shape: 'ring', text: err.message });
            return;
        }
    }

    

    async function checkICal(node) {
        let data = await getICal(node, node.config);
        if (!data) {
            return;
        }
        node.debug('Ical read successfully ' + node.config.url);

        try {
            if (data) {
                var realnow = new Date();
                var preview = new Date();
                var pastview = new Date();

                if (node.config.previewUnits === 'days') {
                    if (node.config.preview == 1) {
                        preview = moment(preview).endOf('day').add(node.config.preview - 1, 'days').toDate();
                    } else {
                        preview = moment(preview).endOf('day').add(node.config.preview, 'days').toDate();
                    }
                } else {
                    preview = moment(preview)
                        .add(node.config.preview, node.config.previewUnits.charAt(0))
                        .toDate();
                }

                if (node.config.pastviewUnits === 'days') {
                    if (node.config.pastview == 1) {
                        pastview = moment(pastview).startOf('day').subtract(node.config.pastview - 1, 'days').toDate();
                    } else {
                        pastview = moment(pastview).startOf('day').subtract(node.config.pastview, 'days').toDate();
                    }
                } else {
                    pastview = moment(pastview)
                        .subtract(node.config.pastview, node.config.pastviewUnits.charAt(0))
                        .toDate();
                }
                var reslist: CalEvent[] = [];
                processData(data, realnow, pastview, preview, node, node.config, reslist);
                return reslist;
            } else {
                throw 'no Data';
            }
        } catch (e) {
            node.debug(JSON.stringify(e));
            throw 'no Data';
        }

    }



    function displayDates(node: any, config: Config,datesArray) {
        let todayEventcounter = 0;
        let tomorrowEventcounter = 0;
        let today = new Date();
        today.setHours(0, 0, 0, 0);
        let oneDay = 24 * 60 * 60 * 1000;
        let tomorrow = new Date(today.getTime() + oneDay);
        let dayAfterTomorrow = new Date(tomorrow.getTime() + oneDay);

        for (var t = 0; t < datesArray.length; t++) {
            if (datesArray[t].eventEnd.getTime() > today.getTime() && datesArray[t].eventStart.getTime() < tomorrow.getTime()) {
                todayEventcounter++;
            }
            if (datesArray[t].eventEnd.getTime() > tomorrow.getTime() && datesArray[t].eventStart.getTime() < dayAfterTomorrow.getTime()) {
                tomorrowEventcounter++;
            }
        }

        node.send({
            today: todayEventcounter,
            tomorrow: tomorrowEventcounter,
            total: datesArray.length,
            htmlTable: brSeparatedList(datesArray, config),
            payload: datesArray,
        });
    }




    function brSeparatedList(datesArray: CalEvent[], config) {
        var text = '<span>';
        var today = new Date();
        var tomorrow = new Date();
        var dayafter = new Date();
        today.setHours(0, 0, 0, 0);
        tomorrow.setDate(today.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        dayafter.setDate(today.getDate() + 2);
        dayafter.setHours(0, 0, 0, 0);

        for (var i = 0; i < datesArray.length; i++) {
            var date = formatDate(datesArray[i].eventStart, datesArray[i].eventEnd, true, datesArray[i].allDay, config);

            if (text) text += '<br/>\n';
            text += (date.text.trim() + ' ' + datesArray[i].event).trim()
            text += '</span>';
        }

        return text;
    }



    RED.nodes.registerType('ical-upcoming', upcomingNode);
};
