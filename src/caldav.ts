import { Config } from './ical-config';

const dav = require('dav');
const moment = require('moment');
const IcalExpander = require('ical-expander');
import * as  ical from 'node-ical';
import { convertEvents } from './helper';

export function CalDav(node, config: Config) {
    const calName = config.calendar;
    this.pastWeeks = config.pastWeeks || 0;
    this.futureWeeks = config.futureWeeks || 4;

    let startDate = moment().startOf('day').subtract(this.pastWeeks, 'weeks');
    let endDate = moment().endOf('day').add(this.futureWeeks, 'weeks');
    const filters = [{
        type: 'comp-filter',
        attrs: { name: 'VCALENDAR' },
        children: [{
            type: 'comp-filter',
            attrs: { name: 'VEVENT' },
            children: [{
                type: 'time-range',
                attrs: {
                    start: startDate.format('YYYYMMDD[T]HHmmss[Z]'),
                    end: endDate.format('YYYYMMDD[T]HHmmss[Z]'),
                },
            }],
        }],
    }];

    const xhr = new dav.transport.Basic(
        new dav.Credentials({
            username: config.username,
            password: config.password,
        }),
    );

    let calDavUri = config.url;
    let url = new URL(calDavUri);
    return dav.createAccount({ server: calDavUri, xhr: xhr, loadCollections: true, loadObjects: true })
        .then((account) => {
            let promises = [];
            if (!account.calendars) {
                node.error('CalDAV -> no calendars found.');
                return;
            }

            for (let calendar of account.calendars) {

                if (!calName || !calName.length || (calName && calName.length && calName.toLowerCase() === calendar.displayName.toLowerCase())) {
                    promises.push(dav.listCalendarObjects(calendar, { xhr: xhr, filters: filters })
                        .then((calendarEntries) => {
                            let retEntries = {};
                            for (let calendarEntry of calendarEntries) {
                                const ics = calendarEntry.calendarData;
                                if (ics) {
                                    const icalExpander = new IcalExpander({ ics, maxIterations: 100 });
                                    const events = icalExpander.between(startDate.toDate(), endDate.toDate());

                                    convertEvents(events).forEach(event => {
                                        event.calendarName = calendar.displayName;
                                        retEntries[event.uid] = event;
                                    });
                                }
                            }
                            return retEntries;
                        }),
                    );

                    promises.push(dav.listCalendarObjects(calendar, { xhr: xhr, filters: filters })
                        .then((calendarEntries) => {
                            let retEntries = {};
                            for (let calendarEntry of calendarEntries) {
                                if (calendarEntry.calendar.objects) {
                                    for (let calendarObject of calendarEntry.calendar.objects) {
                                        if (calendarObject.data && calendarObject.data.href) {
                                            let ics = url.origin + calendarObject.data.href;
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

                                            return ical.fromURL(ics, header).then(data => {
                                                for (var k in data) {
                                                    var ev = data[k];
                                                    ev.calendarName = calendar.displayName;
                                                    retEntries[ev.uid] = ev;
                                                }
                                                return retEntries;
                                            });
                                        }
                                    }
                                }
                            }
                        }),
                    );
                }
            }
            return Promise.all(promises);
        }, function(err) {
            node.error('CalDAV -> get calendars went wrong. ' + err);
        });

}
