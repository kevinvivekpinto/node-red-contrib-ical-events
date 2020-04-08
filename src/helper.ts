import { CronJob } from 'cron';
import { Node } from 'node-red';
import * as NodeCache from 'node-cache';
import { Config } from 'kalender-events';

export interface Job {
    id: string,
    cronjob: any
}

export interface IcalNode extends Node {
    datesArray_old: any;
    datesArray: any;
    job: CronJob;
    config: Config;
    cache: NodeCache;
}
