'use strict';



const Parser = require("./Parser");
const ResourceServer = require("./ResourceServer");
const AlexaResponse = require("./AlexaResponse");

exports.handler = async function (event, context) {

    // Dump the request for logging
    console.log("index.handler request  -----");
    console.log(JSON.stringify(event));

    if (context !== undefined) {
        console.log("index.handler context  -----");
        console.log(JSON.stringify(context));
    }

    const parser = new Parser(event);

    // Validate we have an Alexa directive
    if (!Parser.didDirectiveExists(event)) {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INVALID_DIRECTIVE",
                    "message": "Missing key: directive"
                }
            });
        return sendResponse(aer.get());
    }

    // Check the payload version
    if (!Parser.isPayloadVersionValid(event)) {
        let aer = new AlexaResponse(
            {
                "name": "ErrorResponse",
                "payload": {
                    "type": "INTERNAL_ERROR",
                    "message": "This skill only supports Smart Home API version 3"
                }
            });
        return sendResponse(aer.get())
    }

    if (!Parser.didNamespaceExists(event))
        return sendResponse(new AlexaResponse({
            name: "ErrorResponse",
            payload: {
                type: "INVALID_VALUE",
                message: "Namespace not found"
            }
        }))

    const namespace = Parser.getNamespace(event);
    
    if (namespace === "Alexa") {
        if (event.directive.header.name === "ReportState") {
            const resourceServer = new ResourceServer(event.directive.endpoint.scope.token);
            const endpointId = event.directive.endpoint.endpointId;
            const correlationToken = event.directive.header.correlationToken;

            const isValidToken = await resourceServer.isTokenValid();

            if (!isValidToken) {
                const aer = new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "EXPIRED_AUTHORIZATION_CREDENTIAL",
                        message: "Token Expired"
                    }
                })

                return sendResponse(aer.get());
            }


            try {
                const group = await resourceServer.getGroup(endpointId);

            

                const aer = new AlexaResponse({
                    token: resourceServer.token,
                    correlationToken,
                    endpointId,
                    name: "StateReport"
                });

                let isOnline = true;

                for (const device of group.devices) {

                    let value, name;
                    switch (device.type) {
                        case "LockController":
                            value = device.state === "none" ? "UNLOCKED" : device.state.toUpperCase();
                            name = "lockState";

                            break;

                        case "TemperatureSensor":
                            value = {
                                value: parseFloat(device.state === "none" ? "20.1" : device.state),
                                scale: "CELSIUS"
                            };
                            name = "temperature";

                            break;

                        case "ThermostatController":
                            value = {
                                value: device.state === "none" ? "20.0" : device.state,
                                scale: "CELSIUS"
                            };
                            name = "targetSetpoint";

                            break;

                        case "PowerController":
                            value = device.state === "none" ? "OFF" : device.state;
                            name = "powerState";

                            break;

                        default:
                            value = "none";
                            break;

                    };

                    aer.addContextProperty({
                        namespace: `Alexa.${device.type}`,
                        name,
                        value,
                        timeOfSample: Date.now(),
                        uncertaintyInMilliseconds: 1000
                    });

                    if (!device.isOnline)
                        isOnline = false;

                }

                aer.addContextProperty({
                    namespace: "Alexa.EndpointHealth",
                    name: "connectivity",
                    value: isOnline ? "OK" : "UNREACHABLE",
                    timeOfSample: Date.now(),
                    uncertaintyInMilliseconds: 1000
                });

                return sendResponse(aer.get());
            } catch (e) {
                const aer = new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "INTERNAL_ERROR",
                        message: e
                    }
                })

                return sendResponse(aer.get());
            }
        }
    } else {

        /*if (namespace.toLowerCase() === 'alexa.authorization') {
            const aar = new AlexaResponse({ "namespace": "Alexa.Authorization", "name": "AcceptGrant.Response", });
            return sendResponse(aar.get());
        }*/

        if (Parser.isDiscovery(namespace)) {
            const resourceServer = new ResourceServer(event.directive.payload.scope.token);
            
            const isValidToken = await resourceServer.isTokenValid();
            
            if (!isValidToken) {
                const aer = new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "EXPIRED_AUTHORIZATION_CREDENTIAL",
                        message: "Token Expired"
                    }
                })

                return sendResponse(aer.get());
            }

            const adr = new AlexaResponse({
                namespace: "Alexa.Discovery",
                name: "Discover.Response"
            });

            try {
                const groups = await resourceServer.getGroups();


                for (const group of groups) {

                    const capabilities = [];
                    let categories = [];

                    capabilities.push(adr.createPayloadEndpointCapability());

                    for (const device of group.devices) {

                        categories = categories.concat(device.categories);


                        switch (device.type) {
                            case "LockController":
                                capabilities.push(adr.createPayloadEndpointCapability({
                                    interface: `Alexa.${device.type}`,
                                    supported: [
                                        {
                                            name: "lockState"
                                        }
                                    ],
                                    proactivelyReported: true,
                                    retrievable: true,
                                }));

                                break;

                            case "ThermostatController":
                                capabilities.push(adr.createPayloadEndpointCapability({
                                    interface: `Alexa.${device.type}`,
                                    supported: [
                                        {
                                            name: "targetSetpoint"
                                        }
                                    ],
                                    proactivelyReported: true,
                                    retrievable: true,
                                    configuration: {
                                        supportedModes: ["OFF", "AUTO"],
                                        supportsScheduling: false
                                    }
                                }));

                                capabilities.push(adr.createPayloadEndpointCapability({
                                    interface: "Alexa.PowerController",
                                    supported: [
                                        {
                                            name: "powerState"
                                        }
                                    ],
                                    proactivelyReported: true,
                                    retrievable: true
                                }))
                                break;

                            case "TemperatureSensor":
                                capabilities.push(adr.createPayloadEndpointCapability({
                                    interface: `Alexa.${device.type}`,
                                    supported: [
                                        {
                                            name: "temperature"
                                        }
                                    ],
                                    proactivelyReported: true,
                                    retrievable: true,
                                }));
                                break;

                            case "PowerController":
                                capabilities.push(adr.createPayloadEndpointCapability({
                                    interface: `Alexa.${device.type}`,
                                    supported: [
                                        {
                                            name: "powerState"
                                        }
                                    ],
                                    proactivelyReported: true,
                                    retrievable: true,
                                }));

                                break;

                            default: {
                                capabilities.push(adr.createPayloadEndpointCapability({
                                    "interface": `Alexa.${device.type}`,
                                    "supported": [
                                        {
                                            "name": "state"
                                        }
                                    ],
                                    "proactivelyReported": true,
                                    "retrievable": true
                                }));

                                break;
                            }
                        }

                    }

                    capabilities.push(adr.createPayloadEndpointCapability({
                        interface: "Alexa.EndpointHealth",
                        supported: [
                            {
                                name: "connectivity"
                            }
                        ],
                        "proactivelyReported": true,
                        "retrievable": true
                    }));

                    adr.addPayloadEndpoint({
                        friendlyName: group.name,
                        description: group.description,
                        endpointId: group._id,
                        capabilities: capabilities,
                        displayCategories: group.categories,
                        manufacturerName: "Easily IoT",
                        cookie: {},
                    });
                }

                return sendResponse(adr.get());

            } catch (e) {
                return sendResponse(new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "INTERNAL_ERROR",
                        message: e
                    }
                }))
            }
        }

        if (Parser.isLockController(namespace)) {

            const endpoint_id = event.directive.endpoint.endpointId;
            const token = event.directive.endpoint.scope.token;
            const correlationToken = event.directive.header.correlationToken;
            const name = event.directive.header.name;

            const resourceServer = new ResourceServer(event.directive.endpoint.scope.token);

            const isValidToken = await resourceServer.isTokenValid();
            if (!isValidToken) {
                const aer = new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "EXPIRED_AUTHORIZATION_CREDENTIAL",
                        message: "Token Expired"
                    }
                })

                return sendResponse(aer.get());
            }

            const aer = new AlexaResponse({
                correlationToken,
                token,
                endpoint_id
            });


            try {
                const group = await resourceServer.getGroup(endpoint_id);

                if (!resourceServer.didGroupHasAController(group, Parser.LockController))
                    return sendResponse(new AlexaResponse({
                        name: "ErrorResponse",
                        payload: {
                            type: "INTERNAL_ERROR",
                            message: "LockController is not part of \`" + group.name + "\` Group"
                        }
                    }));

                const device = resourceServer.getDeviceFromGroup(group, Parser.LockController);

                if (name === "Lock") {
                    await resourceServer.triggerDoorLock(device._id);

                    aer.addContextProperty({
                        namespace: "Alexa.LockController",
                        name: "lockState",
                        value: "LOCKED",
                        timeOfSample: Date.now(),
                        uncertaintyInMilliseconds: 1000
                    });


                } else if (name === "Unlock") {
                    await resourceServer.triggerDoorUnlock(device._id);

                    aer.addContextProperty({
                        namespace: "Alexa.LockController",
                        name: "lockState",
                        value: "UNLOCKED",
                        timeOfSample: Date.now(),
                        uncertaintyInMilliseconds: 1000
                    });

                } else {
                    return sendResponse(new AlexaResponse({
                        name: "ErrorResponse",
                        payload: {
                            type: "INTERNAL_ERROR",
                            message: "Name not supported"
                        }
                    }))
                }

                aer.addContextProperty({
                    namespace: "Alexa.EndpointHealth",
                    name: "connectivity",
                    "value": device.isOnline ? "OK" : "UNREACHABLE",
                    timeOfSample: Date.now(),
                    uncertaintyInMilliseconds: 0
                })

                return sendResponse(aer.get());

            } catch (e) {
                return sendResponse(new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "INTERNAL_ERROR",
                        message: e.response ? e.response.data.message : e.stack
                    }
                }))
            }
        }

        if (Parser.isPowerController(namespace)) {
            const endpoint_id = event.directive.endpoint.endpointId;
            const token = event.directive.endpoint.scope.token;
            const correlationToken = event.directive.header.correlationToken;
            const name = event.directive.header.name;

            const resourceServer = new ResourceServer(event.directive.endpoint.scope.token);

            const isValidToken = await resourceServer.isTokenValid();
            if (!isValidToken) {
                const aer = new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "EXPIRED_AUTHORIZATION_CREDENTIAL",
                        message: "Token Expired"
                    }
                })

                return sendResponse(aer.get());
            }

            const aer = new AlexaResponse({
                correlationToken,
                token,
                endpoint_id
            });


            try {
                const group = await resourceServer.getGroup(endpoint_id);

                if (!resourceServer.didGroupHasAController(group, Parser.PowerController))
                    return sendResponse(new AlexaResponse({
                        name: "ErrorResponse",
                        payload: {
                            type: "INTERNAL_ERROR",
                            message: "PowerController is not part of \`" + group.name + "\` Group"
                        }
                    }));

                const device = resourceServer.getDeviceFromGroup(group, Parser.PowerController);

                if (name === "TurnOn") {
                    await resourceServer.triggerTurnOn(device._id);

                    aer.addContextProperty({
                        namespace: "Alexa.PowerController",
                        name: "powerState",
                        value: "ON",
                        timeOfSample: Date.now(),
                        uncertaintyInMilliseconds: 1000
                    });

                } else if (name === "TurnOff") {
                    await resourceServer.triggerTurnOff(device._id);

                    aer.addContextProperty({
                        namespace: "Alexa.PowerController",
                        name: "powerState",
                        value: "OFF",
                        timeOfSample: Date.now(),
                        uncertaintyInMilliseconds: 1000
                    });

                } else {
                    return sendResponse(new AlexaResponse({
                        name: "ErrorResponse",
                        payload: {
                            type: "INTERNAL_ERROR",
                            message: "Name not supported"
                        }
                    }))
                }

                aer.addContextProperty({
                    namespace: "Alexa.EndpointHealth",
                    name: "connectivity",
                    "value": device.isOnline ? "OK" : "UNREACHABLE",
                    timeOfSample: Date.now(),
                    uncertaintyInMilliseconds: 0
                })

                return sendResponse(aer.get());

            } catch (e) {
                return sendResponse(new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "INTERNAL_ERROR",
                        message: e
                    }
                }))
            }
        }

        if (Parser.isThermostatController(namespace)) {
            const endpoint_id = event.directive.endpoint.endpointId;
            const token = event.directive.endpoint.scope.token;
            const correlationToken = event.directive.header.correlationToken;
            const name = event.directive.header.name;

            const newValue = event.directive.payload.targetSetpoint.value;


            const resourceServer = new ResourceServer(event.directive.endpoint.scope.token);

            const isValidToken = await resourceServer.isTokenValid();
            if (!isValidToken) {
                const aer = new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "EXPIRED_AUTHORIZATION_CREDENTIAL",
                        message: "Token Expired"
                    }
                })

                return sendResponse(aer.get());
            }

            const aer = new AlexaResponse({
                correlationToken,
                token,
                endpoint_id
            });

            try {
                const group = await resourceServer.getGroup(endpoint_id);

                if (!resourceServer.didGroupHasAController(group, Parser.ThermostatController))
                    return sendResponse(new AlexaResponse({
                        name: "ErrorResponse",
                        payload: {
                            type: "INTERNAL_ERROR",
                            message: "ThermostatController is not part of \`" + group.name + "\` Group"
                        }
                    }));

                const device = resourceServer.getDeviceFromGroup(group, Parser.ThermostatController);

                if (name === "SetTargetTemperature") {

                    await resourceServer.setTemperature(device._id, newValue);

                    aer.addContextProperty({
                        namespace: `Alexa.ThermostatController`,
                        name: "targetSetpoint",
                        value: {
                            value: newValue,
                            scale: "CELSIUS"
                        },
                        timeOfSample: Date.now(),
                        uncertaintyInMilliseconds: 1000
                    })


                } else {

                    return sendResponse(new AlexaResponse({
                        name: "ErrorResponse",
                        payload: {
                            type: "INTERNAL_ERROR",
                            message: "Name not supported"
                        }
                    }))
                }

                aer.addContextProperty({
                    namespace: "Alexa.EndpointHealth",
                    name: "connectivity",
                    "value": device.isOnline ? "OK" : "UNREACHABLE",
                    timeOfSample: Date.now(),
                    uncertaintyInMilliseconds: 0
                })

                return sendResponse(aer.get());
            } catch (e) {


                return sendResponse(new AlexaResponse({
                    name: "ErrorResponse",
                    payload: {
                        type: "INTERNAL_ERROR",
                        message: e.response ? e.response.data.message : e.stack
                    }
                }))
            }
        }

        return sendResponse(new AlexaResponse({
            name: "ErrorResponse",
            payload: {
                type: "INTERNAL_ERROR",
                message: "No controller match"
            }
        }))
    }

};

function sendResponse(response) {
    // TODO Validate the response
    console.log("index.handler response -----");
    console.log(JSON.stringify(response));
    return response
}

