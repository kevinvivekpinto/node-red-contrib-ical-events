import moment = require('moment');
import { loadEventsForDay } from './icloud';
import { CalDav, Fallback } from './caldav';
import { Config } from './ical-config';
import { CronJob } from 'cron';
import { Node } from 'node-red';
import * as NodeCache from 'node-cache';
var RRule = require('rrule').RRule;

var ce = require('cloneextend');

const nodeIcal = require('node-ical');

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

export interface CalEvent {
    summary?: string,
    topic?: string,
    location?: string,
    eventStart?: Date
    eventEnd?: Date,
    date?: string,
    event?: string,
    description?: string,
    id?: string,
    allDay?: boolean,
    rule?: string,
    on?: boolean,
    off?: boolean,
    countdown?: object,
    calendarName?: string

}

export async function getICal(node: IcalNode, config) {
    try {
        let data = await getEvents(node, config);
        if (node.cache) {
            if (data) {
                node.cache.set("events", data);
            }
        }
        return data;
    } catch (err) {
        if (node.cache) {
            return node.cache.get("events");
        }
    }
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
        offsetUnits: msg?.offsetUnits || node?.offsetUnits || 'm'
    } as Config;
}

export function convertEvents(events) {
    let retEntries = [];
    if (events) {
        if (Array.isArray(events)) {
            events.forEach(event => {
                let ev = convertScrapegoat(event.data);
                retEntries.push(ev);
            });
        }
        else {
            if (events.events) {
                events.events.forEach(event => {
                    let ev = convertEvent(event);
                    retEntries.push(ev);
                });
            }
            if (events.occurrences && events.occurrences.length > 0) {
                events.occurrences.forEach(event => {
                    let ev = convertEvent(event);
                    retEntries.push(ev);
                });
            }
        }
    }

    return retEntries;
}

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function convertEvent(e) {
    if (e) {
        let startDate = e.startDate?.toJSDate() || e.start;
        let endDate = e.endDate?.toJSDate() || e.end;

        const recurrence = e.recurrenceId;

        if (e.item) {
            e = e.item
        }
        if (e.type && e.type !== "VEVENT") {
            return;
        }
        if (e.duration?.wrappedJSObject) {
            delete e.duration.wrappedJSObject
        }

        let uid = e.uid || uuidv4();
        if (recurrence) {
            uid += new Date(recurrence.year, recurrence.month, recurrence.day, recurrence.hour, recurrence.minute, recurrence.second).getTime().toString();
        } else {
            uid += startDate.getTime().toString();
        }

        let duration = e.duration;
        let allday = false;
        if (!duration) {
            var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
            seconds = Number(seconds);
            allday = ((seconds % 86400) === 0)
        } else {
            allday = ((duration.toSeconds() % 86400) === 0)
        }

        return {
            start: startDate,
            end: endDate,
            summary: e.summary || '',
            description: e.description || '',
            attendees: e.attendees,
            duration: e.duration?.toICALString(),
            durationSeconds: e.duration?.toSeconds(),
            location: e.location || '',
            organizer: e.organizer || '',
            uid: uid,
            isRecurring: false,
            datetype: 'date',
            type: 'VEVENT',
            allDay: allday,
            calendarName: null
        }
    }
}

function convertScrapegoat(e) {
    if (e) {
        let startDate = moment(e.start).toDate();
        let endDate = moment(e.end).toDate();

        const recurrence = e.recurrenceId;

        if (e.duration?.wrappedJSObject) {
            delete e.duration.wrappedJSObject
        }

        let uid = e.uid || uuidv4();
        uid += startDate.getTime().toString();

        let duration = e.duration;
        let allday = false;
        if (!duration) {
            var seconds = (endDate.getTime() - startDate.getTime()) / 1000;
            seconds = Number(seconds);
            allday = ((seconds % 86400) === 0)
        } else {
            allday = ((duration.toSeconds() % 86400) === 0)
        }

        return {
            start: startDate,
            end: endDate,
            summary: e.title || '',
            description: e.title || '',
            attendees: e.attendees,
            duration: e.duration?.toICALString(),
            durationSeconds: e.duration?.toSeconds(),
            location: e.location || '',
            organizer: e.organizer || '',
            uid: uid,
            isRecurring: false,
            datetype: 'date',
            type: 'VEVENT',
            allDay: allday,
            calendarName: null
        }
    }
}

export function getTimezoneOffset(date) {
    var offset = 0;
    var zone = moment.tz.zone(moment.tz.guess());
    if (zone && date) {
        offset = zone.utcOffset(date.getTime());
    }
    return offset;
}

export function addOffset(time, offset) {
    return new Date(time.getTime() + offset * 60 * 1000);
}

export function countdown(date) {

    var seconds = (date.getTime() - new Date().getTime()) / 1000;
    seconds = Number(seconds);

    var d = Math.floor(seconds / (3600 * 24));
    var h = Math.floor(seconds % (3600 * 24) / 3600);
    var m = Math.floor(seconds % 3600 / 60);
    var s = Math.floor(seconds % 60);

    return {
        days: d,
        hours: h,
        minutes: m,
        seconds: s,
    };
}

async function getEvents(node: IcalNode, config) {
    if (config.caldav && config.caldav === 'icloud') {
        const now = moment();
        const when = now.toDate();
        let list = await loadEventsForDay(moment(when), node);
        return list;
    } else if (config.caldav && JSON.parse(config.caldav) === true) {
        node.debug('caldav');
        try {
            let data = await CalDav(node, config);
            let retEntries = {};
            if (data) {
                for (let events of data) {
                    for (let event in events) {
                        var ev = events[event];
                        retEntries[ev.uid] = ev;
                    }
                }
            }
            return retEntries;
        } catch{
            return Fallback(node);
        }

    } else {
        if (node.config?.url?.match(/^https?:\/\//)) {
            let header = {};
            let username = node.config.username;
            let password = node.config.password;

            if (username && password) {
                var auth = 'Basic ' + Buffer.from(username + ':' + password).toString('base64');
                header = {
                    headers: {
                        'Authorization': auth,
                    },
                };
            }

            return await nodeIcal.async.fromURL(node.config.url, header);
        } else {
            if (!node.config.url) {
                node.error("URL/File is not defined");
                node.status({ fill: 'red', shape: 'ring', text: "URL/File is not defined" });
                return {};
            }
            return await nodeIcal.async.parseFile(node.config.url);
        }
    }
}

export function processRRule(ev, preview, today, realnow, node: IcalNode, config) {
    var eventLength = ev.end.getTime() - ev.start.getTime();
    var options = RRule.parseString(ev.rrule.toString());
    options.dtstart = addOffset(ev.start, -getTimezoneOffset(ev.start));
    if (options.until) {
        options.until = addOffset(options.until, -getTimezoneOffset(options.until));
    }
    node.debug('options:' + JSON.stringify(options));

    var rule = new RRule(options);
    var now2 = new Date();
    now2.setHours(0, 0, 0, 0);
    var now3 = new Date(now2.getTime() - eventLength);
    if (now2 < now3) now3 = now2;
    node.debug(
        'RRule event:' +
        ev.summary +
        '; start:' +
        ev.start.toString() +
        '; preview:' +
        preview.toString() +
        '; today:' +
        today +
        '; now2:' +
        now2 +
        '; now3:' +
        now3 +
        '; rule:' +
        JSON.stringify(rule)
    );

    var dates = [];
    try {
        dates = rule.between(now3, preview, true);
    } catch (e) {
        node.error(
            'Issue detected in RRule, event ignored; ' +
            e.stack +
            '\n' +
            'RRule object: ' +
            JSON.stringify(rule) +
            '\n' +
            'now3: ' +
            now3 +
            '\n' +
            'preview: ' +
            preview +
            '\n' +
            'string: ' +
            ev.rrule.toString() +
            '\n' +
            'options: ' +
            JSON.stringify(options)
        );
    }

    node.debug('dates:' + JSON.stringify(dates));
    let reslist = [];
    if (dates.length > 0) {
        for (var i = 0; i < dates.length; i++) {
            var ev2 = ce.clone(ev);
            var start = dates[i];
            ev2.start = addOffset(start, getTimezoneOffset(start));

            var end = new Date(start.getTime() + eventLength);
            ev2.end = addOffset(end, getTimezoneOffset(end));

            node.debug('   ' + i + ': Event (' + JSON.stringify(ev2.exdate) + '):' + ev2.start.toString() + ' ' + ev2.end.toString());

            var checkDate = true;
            if (ev2.exdate) {
                for (var d in ev2.exdate) {
                    if (ev2.exdate[d].getTime() === ev2.start.getTime()) {
                        checkDate = false;
                        node.debug('   ' + i + ': sort out');
                        break;
                    }
                }
            }
            if (checkDate && ev.recurrences) {
                for (var dOri in ev.recurrences) {
                    let recurrenceid = ev.recurrences[dOri].recurrenceid
                    if (recurrenceid) {
                        if (recurrenceid.getTime() === ev2.start.getTime()) {
                            ev2 = ce.clone(ev.recurrences[dOri]);
                            node.debug('   ' + i + ': different recurring found replaced with Event:' + ev2.start + ' ' + ev2.end);
                        }
                    }
                }
            }


            if (checkDate) {
                reslist.push(ev2);
            }
        }
    }
    return reslist;
}

export function processData(data, realnow, pastview, preview, node, config, reslist) {
    var processedEntries = 0;

    for (var k in data) {
        var ev = data[k];
        delete data[k];

        if (ev.type === 'VEVENT') {
            if (!ev.end) {
                ev.end = ce.clone(ev.start);
                if (!ev.start.getHours() && !ev.start.getMinutes() && !ev.start.getSeconds()) {
                    ev.end.setDate(ev.end.getDate() + 1);
                }
            }

            if (ev.rrule === undefined) {
                checkDates(ev, preview, pastview, realnow, ' ', node, config, reslist);
            } else {
                let evlist=processRRule(ev, preview, pastview, realnow, node, config);
                for(let ev2 of evlist){
                    checkDates(ev2, preview, pastview, realnow, ' rrule ', node, config,reslist);
                }
                
            }
        }

        if (++processedEntries > 100) {
            break;
        }
    }
    if (!Object.keys(data).length) {
        return;
    } else {
        processData(data, realnow, pastview, preview, node, config, reslist);
    }
}

export function checkDates(ev, preview, pastview, realnow, rule, node, config: Config, reslist: CalEvent[]) {
    var fullday = false;
    var reason;
    var date;

    if (ev.summary && ev.summary.hasOwnProperty('val')) {
        reason = ev.summary.val;
    } else {
        reason = ev.summary;
    }
    var location = ev.location || '';

    if (!ev.start) return;
    if (!ev.end) ev.end = ev.start;
    ev.start = new Date(ev.start);
    ev.end = new Date(ev.end);
    if (
        !ev.start.getHours() &&
        !ev.start.getMinutes() &&
        !ev.start.getSeconds() &&
        !ev.end.getHours() &&
        !ev.end.getMinutes() &&
        !ev.end.getSeconds()
    ) {
        if (ev.end.getTime() == ev.start.getTime() && ev.datetype == 'date') {
            ev.end.setDate(ev.end.getDate() + 1);
        }
        if (ev.end.getTime() !== ev.start.getTime()) {
            fullday = true;
        }
    }

    let output = false;
    if (node.config.trigger == 'match') {
        let regex = new RegExp(node.config.filter);
        if (regex.test(ev.summary)) output = true;
    } else if (node.config.trigger == 'nomatch') {
        let regex = new RegExp(node.config.filter);
        if (!regex.test(ev.summary)) output = true;
    } else {
        output = true;
    }
    if (output) {
        node.debug('Event: ' + JSON.stringify(ev))
        if (fullday) {
            if (
                (ev.start < preview && ev.start >= pastview) ||
                (ev.end > pastview && ev.end <= preview) ||
                (ev.start < pastview && ev.end > pastview)
            ) {
                date = formatDate(ev.start, ev.end, true, true, config);

                insertSorted(reslist, {
                    date: date.text.trim(),
                    summary: ev.summary,
                    topic: ev.summary,
                    calendarName: ev.calendarName,
                    event: reason,
                    eventStart: new Date(ev.start.getTime()),
                    eventEnd: new Date(ev.end.getTime()),
                    description: ev.description,
                    id: ev.uid,
                    allDay: true,
                    rule: rule,
                    location: location,
                    countdown: countdown(new Date(ev.start))
                });

                node.debug('Event (full day) added : ' + JSON.stringify(rule) + ' ' + reason + ' at ' + date.text);
            }
        } else {
            // Event with time              
            if (
                (ev.start >= pastview && ev.start < preview) ||
                (ev.end >= realnow && ev.end <= preview) ||
                (ev.start < realnow && ev.end > realnow)
            ) {
                date = formatDate(ev.start, ev.end, true, false, config);
                insertSorted(reslist, {
                    date: date.text.trim(),
                    event: reason,
                    summary: ev.summary,
                    topic: ev.summary,
                    calendarName: ev.calendarName,
                    eventStart: new Date(ev.start.getTime()),
                    eventEnd: new Date(ev.end.getTime()),
                    description: ev.description,
                    id: ev.uid,
                    allDay: false,
                    rule: rule,
                    location: location,
                    countdown: countdown(new Date(ev.start))
                });
                node.debug('Event with time added: ' + JSON.stringify(rule) + ' ' + reason + ' at ' + date.text);
            }
        }
    }
}

function insertSorted(arr: CalEvent[], element: CalEvent) {
    if (!arr.length) {
        arr.push(element);
    } else {
        if (arr[0].eventStart > element.eventStart) {
            arr.unshift(element);
        } else if (arr[arr.length - 1].eventStart < element.eventStart) {
            arr.push(element);
        } else {
            if (arr.length === 1) {
                arr.push(element);
            } else {
                for (var i = 0; i < arr.length - 1; i++) {
                    if (arr[i].eventStart <= element.eventStart && element.eventStart < arr[i + 1].eventStart) {
                        arr.splice(i + 1, 0, element);
                        element = null;
                        break;
                    }
                }
                if (element) arr.push(element);
            }
        }
    }
}

export function formatDate(_date, _end: Date, withTime, fullday, config) {
    var day = _date.getDate();
    var month = _date.getMonth() + 1;
    var year = _date.getFullYear();
    var endday = _end.getDate();
    var endmonth = _end.getMonth() + 1;
    var endyear = _end.getFullYear();
    var _time = '';
    var alreadyStarted = _date < new Date();

    if (withTime) {
        var hours = _date.getHours();
        var minutes = _date.getMinutes();

        if (!alreadyStarted) {
            if (hours < 10) hours = '0' + hours.toString();
            if (minutes < 10) minutes = '0' + minutes.toString();
            _time = ' ' + hours + ':' + minutes;
        }
        var timeDiff = _end.getTime() - _date.getTime();
        if (timeDiff === 0 && hours === 0 && minutes === 0) {
            _time = ' ';
        } else if (timeDiff > 0) {
            if (!alreadyStarted) {
                _time += '-';
            } else {
                _time += ' ';
            }

            var endhours = _end.getHours().toString();
            var endminutes = _end.getMinutes().toString();

            if (parseInt(endhours) < 10) endhours = '0' + endhours.toString();

            if (parseInt(endminutes) < 10) endminutes = '0' + endminutes.toString();
            _time += endhours + ':' + endminutes;

            var startDayEnd = new Date();
            startDayEnd.setFullYear(_date.getFullYear());
            startDayEnd.setMonth(_date.getMonth());
            startDayEnd.setDate(_date.getDate() + 1);
            startDayEnd.setHours(0, 0, 0, 0);

            if (_end > startDayEnd) {
                var start = new Date();
                if (!alreadyStarted) {
                    start.setDate(_date.getDate());
                    start.setMonth(_date.getMonth());
                    start.setFullYear(_date.getFullYear());
                }
                start.setHours(0, 0, 1, 0);
                var fullTimeDiff = timeDiff;
                timeDiff = _end.getTime() - start.getTime();

                if (fullTimeDiff >= 24 * 60 * 60 * 1000) {
                    _time += '+' + Math.floor(timeDiff / (24 * 60 * 60 * 1000));
                }
            } else if (config.replacedates && _end.getHours() === 0 && _end.getMinutes() === 0) {
                _time = ' ';
            }
        }
    }
    var _class = '';
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    var d2 = new Date();
    d2.setDate(d.getDate() + 1);

    var todayOnly = false;
    if (
        day === d.getDate() &&
        month === d.getMonth() + 1 &&
        year === d.getFullYear() &&
        endday === d2.getDate() &&
        endmonth === d2.getMonth() + 1 &&
        endyear === d2.getFullYear() &&
        fullday
    ) {
        todayOnly = true;
    }

    if (todayOnly || !alreadyStarted) {
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_today';
        }

        d.setDate(d.getDate() + 1);
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_tomorrow';
        }

        d.setDate(d.getDate() + 1);
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_dayafter';
        }

        d.setDate(d.getDate() + 1);
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_3days';
        }

        d.setDate(d.getDate() + 1);
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_4days';
        }

        d.setDate(d.getDate() + 1);
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_5days';
        }

        d.setDate(d.getDate() + 1);
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_6days';
        }

        d.setDate(d.getDate() + 1);
        if (day === d.getDate() && month === d.getMonth() + 1 && year === d.getFullYear()) {
            _class = 'ical_oneweek';
        }

        if (config.replacedates) {
            if (_class === 'ical_today')
                return {
                    text: _('today', config) + _time,
                    _class: _class,
                };
            if (_class === 'ical_tomorrow') return { text: _('tomorrow', config) + _time, _class: _class };
            if (_class === 'ical_dayafter') return { text: _('dayafter', config) + _time, _class: _class };
            if (_class === 'ical_3days') return { text: _('3days', config) + _time, _class: _class };
            if (_class === 'ical_4days') return { text: _('4days', config) + _time, _class: _class };
            if (_class === 'ical_5days') return { text: _('5days', config) + _time, _class: _class };
            if (_class === 'ical_6days') return { text: _('6days', config) + _time, _class: _class };
            if (_class === 'ical_oneweek') return { text: _('oneweek', config) + _time, _class: _class };
        }
    } else {
        _class = 'ical_today';
        var daysleft = Math.round((_end.getDate() - new Date().getDate()) / (1000 * 60 * 60 * 24));
        var hoursleft = Math.round((_end.getDate() - new Date().getDate()) / (1000 * 60 * 60));

        if (config.replacedates) {
            var _left = _('left', config) !== ' ' ? ' ' + _('left', config) : '';
            var text;
            if (daysleft === 42) {
                text = _('6week_left', config);
            } else if (daysleft === 35) {
                text = _('5week_left', config);
            } else if (daysleft === 28) {
                text = _('4week_left', config);
            } else if (daysleft === 21) {
                text = _('3week_left', config);
            } else if (daysleft === 14) {
                text = _('2week_left', config);
            } else if (daysleft === 7) {
                text = _('1week_left', config);
            } else if (daysleft >= 1) {
                if (config.language === 'ru') {
                    var c = daysleft % 10;
                    var cc = Math.floor(daysleft / 10) % 10;
                    if (daysleft === 1) {
                        text = (_('still', config) !== ' ' ? _('still', config) : '') + ' ' + daysleft + ' ' + _('day', config) + _left;
                    } else if (cc > 1 && (c > 1 || c < 5)) {
                        text = (_('still', config) !== ' ' ? _('still', config) : '') + ' ' + daysleft + ' ' + 'дня' + _left;
                    } else {
                        text = (_('still', config) !== ' ' ? _('still', config) : '') + ' ' + daysleft + ' ' + _('days', config) + _left;
                    }
                } else {
                    text =
                        (_('still', config) !== ' ' ? _('still', config) : '') +
                        ' ' +
                        daysleft +
                        ' ' +
                        (daysleft === 1 ? _('day', config) : _('days', config)) +
                        _left;
                }
            } else {
                if (config.language === 'ru') {
                    var c = hoursleft % 10;
                    var cc = Math.floor(hoursleft / 10) % 10;
                    if (hoursleft === 1) {
                        text = (_('still', config) !== ' ' ? _('still', config) : '') + ' ' + hoursleft + ' ' + _('hour', config) + _left;
                    } else if (cc !== 1 && (c > 1 || c < 5)) {
                        text = (_('still', config) !== ' ' ? _('still', config) : '') + ' ' + hoursleft + ' ' + 'часа' + _left;
                    } else {
                        text = (_('still', config) !== ' ' ? _('still', config) : '') + ' ' + hoursleft + ' ' + _('hours', config) + _left;
                    }
                } else {
                    text =
                        (_('still', config) !== ' ' ? _('still', config) : '') +
                        ' ' +
                        hoursleft +
                        ' ' +
                        (hoursleft === 1 ? _('hour', config) : _('hours', config)) +
                        _left;
                }
            }
        } else {
            day = _end.getDate();
            if (fullday) {
                day -= 1;
                withTime = false;
            }
            month = _end.getMonth() + 1;
            year = _end.getFullYear();

            if (day < 10) day = '0' + day.toString();
            if (month < 10) month = '0' + month.toString();

            text = day + '.' + month + '.';
            text += year;

            if (withTime) {
                let endhours = _end.getHours().toString();
                let endminutes = _end.getMinutes().toString();

                if (parseInt(endhours) < 10) {
                    endhours = '0' + endhours.toString();
                }
                if (parseInt(endminutes) < 10) {
                    endminutes = '0' + endminutes.toString();
                }
                text += ' ' + endhours + ':' + endminutes;
            }
        }

        return { text: text, _class: _class };
    }

    if (day < 10) day = '0' + day.toString();
    if (month < 10) month = '0' + month.toString();

    return {
        text: (day + '.' + month + '.' + year + _time).trim(),
        _class: _class,
    };
}


function _(text, config) {
    if (!text) return '';

    if (dictionary[text]) {
        var newText = dictionary[text][config.language];
        if (newText) {
            return newText;
        } else if (config.language !== 'en') {
            newText = dictionary[text].en;
            if (newText) {
                return newText;
            }
        }
    }
    return text;
}

let dictionary = {
    today: {
        en: 'Today',
        it: 'Oggi',
        es: 'Hoy',
        pl: 'Dzisiaj',
        fr: "Aujourd'hui",
        de: 'Heute',
        ru: 'Сегодня',
        nl: 'Vandaag',
    },
    tomorrow: {
        en: 'Tomorrow',
        it: 'Domani',
        es: 'Mañana',
        pl: 'Jutro',
        fr: 'Demain',
        de: 'Morgen',
        ru: 'Завтра',
        nl: 'Morgen',
    },
    dayafter: {
        en: 'Day After Tomorrow',
        it: 'Dopodomani',
        es: 'Pasado mañana',
        pl: 'Pojutrze',
        fr: 'Après demain',
        de: 'Übermorgen',
        ru: 'Послезавтра',
        nl: 'Overmorgen',
    },
    '3days': {
        en: 'In 3 days',
        it: 'In 3 giorni',
        es: 'En 3 días',
        pl: 'W 3 dni',
        fr: 'Dans 3 jours',
        de: 'In 3 Tagen',
        ru: 'Через 2 дня',
        nl: 'Over 3 dagen',
    },
    '4days': {
        en: 'In 4 days',
        it: 'In 4 giorni',
        es: 'En 4 días',
        pl: 'W 4 dni',
        fr: 'Dans 4 jours',
        de: 'In 4 Tagen',
        ru: 'Через 3 дня',
        nl: 'Over 4 dagen',
    },
    '5days': {
        en: 'In 5 days',
        it: 'In 5 giorni',
        es: 'En 5 días',
        pl: 'W ciągu 5 dni',
        fr: 'Dans 5 jours',
        de: 'In 5 Tagen',
        ru: 'Через 4 дня',
        nl: 'Over 5 dagen',
    },
    '6days': {
        en: 'In 6 days',
        it: 'In 6 giorni',
        es: 'En 6 días',
        pl: 'W ciągu 6 dni',
        fr: 'Dans 6 jours',
        de: 'In 6 Tagen',
        ru: 'Через 5 дней',
        nl: 'Over 6 dagen',
    },
    oneweek: {
        en: 'In one week',
        it: 'In una settimana',
        es: 'En una semana',
        pl: 'W jeden tydzień',
        fr: 'Dans une semaine',
        de: 'In einer Woche',
        ru: 'Через неделю',
        nl: 'Binnen een week',
    },
    '1week_left': {
        en: 'One week left',
        it: 'Manca una settimana',
        es: 'Queda una semana',
        pl: 'Został jeden tydzień',
        fr: 'Reste une semaine',
        de: 'Noch eine Woche',
        ru: 'Ещё неделя',
        nl: 'Over een week',
    },
    '2week_left': {
        en: 'Two weeks left',
        it: 'Due settimane rimaste',
        es: 'Dos semanas restantes',
        pl: 'Zostały dwa tygodnie',
        fr: 'Il reste deux semaines',
        de: 'Noch zwei Wochen',
        ru: 'Ещё две недели',
        nl: 'Over twee weken',
    },
    '3week_left': {
        en: 'Three weeks left',
        it: 'Tre settimane rimanenti',
        es: 'Tres semanas quedan',
        pl: 'Pozostały trzy tygodnie',
        fr: 'Trois semaines restantes',
        de: 'Noch drei Wochen',
        ru: 'Ещё три недели',
        nl: 'Over drie weken',
    },
    '4week_left': {
        en: 'Four weeks left',
        it: 'Quattro settimane rimaste',
        es: 'Cuatro semanas quedan',
        pl: 'Pozostały cztery tygodnie',
        fr: 'Quatre semaines à gauche',
        de: 'Noch vier Wochen',
        ru: 'Ещё три недели',
        nl: 'Over vier weken',
    },
    '5week_left': {
        en: 'Five weeks left',
        it: 'Cinque settimane rimaste',
        es: 'Quedan cinco semanas',
        pl: 'Pozostało pięć tygodni',
        fr: 'Cinq semaines à gauche',
        de: 'Noch fünf Wochen',
        ru: 'Ещё пять недель',
        nl: 'Over vijf weken',
    },
    '6week_left': {
        en: 'Six weeks left',
        it: 'Sei settimane a sinistra',
        es: 'Seis semanas restantes',
        pl: 'Pozostało sześć tygodni',
        fr: 'Six semaines à gauche',
        de: 'Noch sechs Wochen',
        ru: 'Ещё шесть недель',
        nl: 'Over zes weken',
    },
    left: {
        en: 'left',
        it: 'sinistra',
        es: 'izquierda',
        pl: 'lewo',
        fr: 'la gauche',
        de: ' ',
        ru: 'осталось',
        nl: 'over',
    },
    still: { en: ' ', it: '', es: '', pl: '', fr: '', de: 'Noch', ru: ' ', nl: 'nog' },
    days: { en: 'days', it: 'Giorni', es: 'dias', pl: 'dni', fr: 'journées', de: 'Tage', ru: 'дней', nl: 'dagen' },
    day: { en: 'day', it: 'giorno', es: 'día', pl: 'dzień', fr: 'journée', de: 'Tag', ru: 'день', nl: 'dag' },
    hours: {
        en: 'hours',
        it: 'ore',
        es: 'horas',
        pl: 'godziny',
        fr: 'heures',
        de: 'Stunden',
        ru: 'часов',
        nl: 'uren',
    },
    hour: { en: 'hour', it: 'ora', es: 'hora', pl: 'godzina', fr: 'heure', de: 'Stunde', ru: 'час', nl: 'uur' },
};
