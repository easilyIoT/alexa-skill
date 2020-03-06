const axios = require("axios");


class Parser {
        static Discovery = "Discovery";
        static LockController = "LockController";
        static ThermostatController = "ThermostatController";
        static PowerController = "PowerController";

        static didDirectiveExists(event) {
                return "directive" in event;
        }

        static isPayloadVersionValid(event) {
                return event.directive.header.payloadVersion === "3";
        }

        static didNamespaceExists(event) {
                return event.directive && event.directive.header && event.directive.header.namespace;
        }

        static getNamespace(event) {
                return event.directive.header.namespace;
        }

        static isDiscovery(namespace) {
                return namespace === `Alexa.${this.Discovery}`
        }

        static isLockController(namespace) {
                return namespace === `Alexa.${this.LockController}`;
        }

        static isThermostatController(namespace) {
                return namespace === `Alexa.${this.ThermostatController}`;
        }

        static isPowerController(namespace) {
                return namespace === `Alexa.${this.PowerController}`;
        }
}

module.exports = Parser;