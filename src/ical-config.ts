import { Config } from 'kalender-events';
interface IcalConfig extends Config{
    name?: string;
}

module.exports = function (RED: any) {
    function icalConfig(config: IcalConfig) {
        RED.nodes.createNode(this, config);

        this.url = config.url;
        this.caldav = config.caldav;
        this.username = config.username;
        this.password = config.password;

        this.name = config.name;
        this.language = config.language;
        this.replacedates = config.replacedates;
        this.calendar = config.calendar;
    }

    RED.nodes.registerType('ical-config', icalConfig);
};
