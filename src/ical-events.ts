
import { Red, Node } from 'node-red';
import { CronJob } from 'cron';
import * as parser from 'cron-parser';
import { KalenderEvents, CalEvent, Config } from 'kalender-events';
import { IcalNode, getConfig } from './helper';

module.exports = function (RED: Red) {
    let newCronJobs = new Map();
    let startedCronJobs = {};
    function eventsNode(config: any) {
        RED.nodes.createNode(this, config);
        let node: IcalNode = this;

        try {

            node.config = getConfig(RED.nodes.getNode(config.confignode) as unknown as Config, config, null);
            node.kalenderEvents = new KalenderEvents(node.config);

            node.on('input', (msg: any) => {
                node.config = getConfig(RED.nodes.getNode(config.confignode) as unknown as Config, config, msg);
                node.kalenderEvents = new KalenderEvents(node.config);
                cronCheckJob(node);
            });

            node.on('close', () => {
                node.debug("cron stopped");
                if (startedCronJobs) {
                    for (let key in startedCronJobs) {
                        if (startedCronJobs.hasOwnProperty(key)) {
                            node.debug(key + " stopped")
                            //@ts-ignore
                            startedCronJobs[key].stop();
                        }
                    }
                }
            });

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
                node.config.preview = config.timeout;
                node.config.previewUnits = config.timeoutUnits;
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
        let dateNow = new Date();
        let possibleUids = [];
        let data = await node.kalenderEvents.getEvents();
        if (!data) {
            return;
        }
        var reslist: CalEvent[] = node.kalenderEvents.processData(data, new Date(), new Date(), node.kalenderEvents.addOffset(new Date(), node.config.preview, node.config.previewUnits));

        node.debug('Ical read successfully ' + node.config.url);
        if (data) {
            for (let k in data) {
                if (data.hasOwnProperty(k)) {
                    let ev = data[k];

                    const eventStart = new Date(ev.start);
                    const eventEnd = new Date(ev.end);
                    if (ev.type == 'VEVENT') {
                        if (eventStart > dateNow) {
                            let uid = ev.uid + "start";
                            possibleUids.push(uid);
                            const event: CalEvent = {
                                summary: ev.summary,
                                topic: ev.summary,
                                id: uid,
                                location: ev.location,
                                eventStart: new Date(ev.start),
                                eventEnd: new Date(ev.end),
                                description: ev.description,
                                calendarName: ev.calendarName,
                                countdown: node.kalenderEvents.countdown(new Date(ev.start))
                            }


                            if (node.config.offset) {
                                if (node.config?.offsetUnits === 'seconds') {
                                    eventStart.setSeconds(eventStart.getSeconds() + node.config.offset);
                                } else if (node.config?.offsetUnits === 'hours') {
                                    eventStart.setMinutes(eventStart.getMinutes() + node.config.offset);
                                } else if (node.config?.offsetUnits === 'days') {
                                    eventStart.setDate(eventStart.getDate() + node.config.offset);
                                } else {
                                    eventStart.setMinutes(eventStart.getMinutes() + node.config.offset);
                                }
                            }


                            let job2 = new CronJob(eventStart, cronJobStart.bind(null, event, node));
                            //@ts-ignore
                            let cronJob = startedCronJobs[uid];
                            console.log(cronJob)
                            if (!newCronJobs.has(uid) && !cronJob) {
                                newCronJobs.set(uid, job2);
                                node.debug("new - " + uid);
                            }
                            else if (cronJob) {
                                cronJob.stop();
                                job2 = new CronJob(eventStart, cronJobStart.bind(null, event, node));
                                newCronJobs.set(uid, job2);
                                node.debug("started - " + uid);
                            }
                        }
                        if (eventEnd > dateNow) {
                            let uid = ev.uid + "end";
                            possibleUids.push(uid);
                            const event: CalEvent = {
                                summary: ev.summary,
                                topic: ev.summary,
                                id: uid,
                                location: ev.location,
                                eventStart: new Date(ev.start),
                                eventEnd: new Date(ev.end),
                                description: ev.description,
                                calendarName: ev.calendarName,
                                countdown: node.kalenderEvents.countdown(new Date(ev.start))
                            }

                            if (node.config.offset) {
                                if (node.config?.offsetUnits === 'seconds') {
                                    eventEnd.setSeconds(eventEnd.getSeconds() + node.config.offset);
                                } else if (node.config?.offsetUnits === 'hours') {
                                    eventEnd.setMinutes(eventEnd.getMinutes() + node.config.offset);
                                } else if (node.config?.offsetUnits === 'days') {
                                    eventEnd.setDate(eventEnd.getDate() + node.config.offset);
                                } else {
                                    eventEnd.setMinutes(eventEnd.getMinutes() + node.config.offset);
                                }
                            }

                            let job2 = new CronJob(eventEnd, cronJobEnd.bind(null, event, node));
                            //@ts-ignore
                            let cronJob = startedCronJobs[uid];
                            //@ts-ignore
                            if (!newCronJobs.has(uid) && !startedCronJobs[uid]) {
                                newCronJobs.set(uid, job2);
                                node.debug("new - " + uid);
                            }
                            //@ts-ignore
                            else if (startedCronJobs[uid]) {
                                cronJob.stop();
                                job2 = new CronJob(eventStart, cronJobEnd.bind(null, event, node));
                                newCronJobs.set(uid, job2);
                                node.debug("started - " + uid);
                            }
                        }
                    }
                }
            }

            if (newCronJobs) {
                newCronJobs.forEach((job, key) => {
                    try {
                        job.start();
                        node.debug("starting - " + key);
                        //@ts-ignore
                        startedCronJobs[key] = job;
                    } catch (newCronErr) {
                        node.error(newCronErr);
                    }

                });
            }

            newCronJobs.clear();
        }

        for (let key in startedCronJobs) {
            if (startedCronJobs.hasOwnProperty(key)) {
                //@ts-ignore
                if (startedCronJobs[key].running == false) {
                    //@ts-ignore
                    delete startedCronJobs[key];
                }
                else if (!(possibleUids.includes(key, 0))) {
                    //@ts-ignore
                    startedCronJobs[key].stop();
                    //@ts-ignore
                    delete startedCronJobs[key];
                }
            }
        }

    }

    function cronJobStart(event: any, node: Node) {
        node.send([{
            payload: event
        }]);
    }

    function cronJobEnd(event: any, node: Node) {
        node.send([null, {
            payload: event
        }]);
    }

    RED.nodes.registerType("ical-events", eventsNode);
}