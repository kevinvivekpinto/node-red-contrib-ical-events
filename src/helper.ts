import { CronJob } from 'cron';
import { Node } from 'node-red';
import KalenderEvents, { Config } from 'kalender-events';

export interface Job {
    id: string,
    cronjob: any
}

export interface IcalNode extends Node {
    datesArray_old: any;
    datesArray: any;
    job: CronJob;
    config: Config;
    kalenderEvents: KalenderEvents
}

export function getConfig(config: Config, node: any, msg: any): Config {
    return {
        url: msg?.url || config?.url,
        language: msg?.language || config?.language,
        replacedates: msg?.replacedates || config?.replacedates,
        caldav: msg?.caldav || config?.caldav,
        username: msg?.username || config?.username,
        password: msg?.password || config?.password,
        calendar: msg?.calendar || config?.calendar,
        filter: msg?.filter || node.filter,
        trigger: msg?.trigger || node.trigger || 'always',
        preview: parseInt(msg?.preview || node?.preview || node?.endpreview || 10),
        previewUnits: msg?.previewUnits || node?.previewUnits || node?.endpreviewUnits || 'd',
        pastview: parseInt(msg?.pastview || node?.pastview || 0),
        pastviewUnits: msg?.pastviewUnits || node?.pastviewUnits || 'd',
        offset: parseInt(msg?.offset || node?.offset || 0),
        offsetUnits: msg?.offsetUnits || node?.offsetUnits || 'm',
        rejectUnauthorized: msg?.rejectUnauthorized || node?.rejectUnauthorized || false
    } as Config;
}