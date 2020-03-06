const { default: axios } = require("axios");

const { RESOURCE_SERVER_URL } = require("./config");

module.exports = class ResourceServer {
        constructor(token) {
                this._token = token;

                axios.defaults.headers['Authorization'] = token;
                axios.interceptors.request.use(config => {
                        console.log(`Making a request to ${config.url}`)
                        return config;
                }, error => Promise.reject(error));
        }

        async isTokenValid() {
                try {
                        console.log(`Making a request to ${RESOURCE_SERVER_URL}/auth/verify`);
                        await axios.post(`${RESOURCE_SERVER_URL}/auth/verify`);
                        return true;
                } catch (e) {
                        console.log("Error => ", e);
                        return false;
                }
        }

        async getGroups() {
                const { data } = await axios.get(`${RESOURCE_SERVER_URL}/api/group`);
                return data.groups;
        }
        async getDevices() {
                const { data } = await axios.get(`${RESOURCE_SERVER_URL}/api/device`);
                return data.devices;
        }
        
        async getGroup(groupID) {
                const { data } = await axios.get(`${RESOURCE_SERVER_URL}/api/group/${groupID}`);
                return data.group;
        }

        async getDevice(deviceID) {
                const { data } = await axios.get(`${RESOURCE_SERVER_URL}/api/device/${deviceID}`);
                return data.device;
        }

        didGroupHasAController(group, controller) {
                return group.devices.map(device => device.type === controller).indexOf(true) >= 0;
        }

        getDeviceFromGroup(group, controller) {
                return group.devices.find(device => device.type === controller);
        }

        async triggerDoorLock(deviceID) {
                await axios.post(`${RESOURCE_SERVER_URL}/api/device/${deviceID}/lock`);
        }

        async triggerDoorUnlock(deviceID) {
                await axios.post(`${RESOURCE_SERVER_URL}/api/device/${deviceID}/unlock`);
        }

        async triggerTurnOn(deviceID) {
                await axios.post(`${RESOURCE_SERVER_URL}/api/device/${deviceID}/turnON`);
        }

        async triggerTurnOff(deviceID) {
                await axios.post(`${RESOURCE_SERVER_URL}/api/device/${deviceID}/turnOFF`);
        }

        async setTemperature(deviceID, temperature) {
                await axios.post(`${RESOURCE_SERVER_URL}/api/device/${deviceID}/setTemperature`, {
                        temperature
                });
        }

       

        get token() {
                return this._token;
        }
}