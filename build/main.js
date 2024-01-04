"use strict";
/*
 * Created with @iobroker/create-adapter v1.26.3
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
const utils = require("@iobroker/adapter-core");
const axios_1 = require("axios");
const API_BASE = 'https://ext-api.airthings.com';
const EXCLUDED_TYPES = [
    'HUB',
    'HOME',
    'PRO',
    'CLOUDBERRY',
    'AGGREGATED_GROUP',
    'ZONE_GROUP',
    'AP_1',
    'UNKNOWN'
];
const EXCLUDED_SAMPLES = [
    'time',
    'battery',
    'relayDeviceType'
];
class AirthingsCloud extends utils.Adapter {
    constructor(options = {}) {
        super(Object.assign(Object.assign({}, options), { name: 'airthings-cloud' }));
        this.on('ready', this.onReady.bind(this));
        //this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    authenticate() {
        return __awaiter(this, void 0, void 0, function* () {
            this.log.info('Authenticating with Client ID: ' + this.config.client_id);
            try {
                const resp = yield axios_1.default.post('https://accounts-api.airthings.com/v1/token', {
                    'grant_type': 'client_credentials',
                    'client_id': this.config.client_id,
                    'client_secret': this.config.client_secret,
                    'scope': ['read:device:current_values']
                });
                if (resp.status === 200) {
                    this.setState('info.connection', true, true);
                    this.token = resp.data.access_token;
                    this.tokenExpiration = Date.now() + (resp.data.expires_in * 1000);
                    this.log.info('Authentication successful');
                    return true;
                }
                else {
                    this.setState('info.connection', false, true);
                    this.log.error(`Authentication failed: ${JSON.stringify(resp.data)}`);
                    if (this.updateTimerId) {
                        clearInterval(this.updateTimerId);
                    }
                    return false;
                }
            }
            catch (ex) {
                this.log.error('Failed to authenticate ' + ex);
                return false;
            }
        });
    }
    getToken() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.tokenExpiration || !this.token || Date.now() > (this.tokenExpiration - 60000)) {
                yield this.authenticate();
            }
            return this.token;
        });
    }
    syncDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            const resp = yield axios_1.default.get(`${API_BASE}/v1/devices`, {
                headers: {
                    Authorization: `Bearer ${yield this.getToken()}`
                }
            });
            // @TODO Remove deleted devices
            yield this.setObjectNotExistsAsync('devices', {
                type: 'folder',
                native: {},
                common: {
                    name: 'Devices'
                }
            });
            this.log.info(`Syncing ${resp.data.devices.length} devices`);
            for (const device of resp.data.devices) {
                this.log.debug(`Device: ${JSON.stringify(device)}`);
                yield this.createAirthingDevice(device);
            }
        });
    }
    createAirthingDevice(device) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.setObjectNotExistsAsync(`devices.${device.id}`, {
                type: 'device',
                native: {},
                common: {
                    name: device.segment.name,
                }
            });
            yield this.setObjectNotExistsAsync(`devices.${device.id}.id`, {
                type: 'state',
                native: {},
                common: {
                    name: 'ID',
                    type: 'string',
                    desc: 'Device ID',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.id`, device.id, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.type`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Type',
                    type: 'string',
                    desc: 'Device Type',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.type`, device.deviceType, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.name`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Name',
                    type: 'string',
                    desc: 'Product Name',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.name`, device.productName, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.sensors`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Sensors',
                    type: 'array',
                    desc: 'Available Sensors',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.sensors`, device.sensors, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.battery`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Battery',
                    type: 'number',
                    desc: 'Battery percentage',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setObjectNotExistsAsync(`devices.${device.id}.relay_device_type`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Relay Type',
                    type: 'string',
                    desc: 'Relay Device Type',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setObjectNotExistsAsync(`devices.${device.id}.rssi`, {
                type: 'state',
                native: {},
                common: {
                    name: 'RSSI',
                    type: 'number',
                    desc: 'Signal strength',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setObjectNotExistsAsync(`devices.${device.id}.segment`, {
                type: 'channel',
                native: {},
                common: {
                    name: 'Segment'
                }
            });
            yield this.setObjectNotExistsAsync(`devices.${device.id}.segment.id`, {
                type: 'state',
                native: {},
                common: {
                    name: 'ID',
                    type: 'string',
                    desc: 'Segment ID',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.segment.id`, device.segment.id, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.segment.name`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Name',
                    type: 'string',
                    desc: 'Segment Name',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.segment.name`, device.segment.name, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.segment.started`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Started',
                    type: 'string',
                    desc: 'Segment started',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.segment.started`, device.segment.started, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.segment.active`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Active',
                    type: 'boolean',
                    desc: 'Segment active',
                    read: true,
                    write: false,
                    role: 'indicator'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.segment.active`, device.segment.active, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.location`, {
                type: 'channel',
                native: {},
                common: {
                    name: 'Location'
                }
            });
            yield this.setObjectNotExistsAsync(`devices.${device.id}.location.id`, {
                type: 'state',
                native: {},
                common: {
                    name: 'ID',
                    type: 'string',
                    desc: 'Location ID',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.location.id`, device.location.id, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.location.name`, {
                type: 'state',
                native: {},
                common: {
                    name: 'Name',
                    type: 'string',
                    desc: 'Location Name',
                    read: true,
                    write: false,
                    role: 'value'
                }
            });
            yield this.setStateAsync(`devices.${device.id}.location.name`, device.location.name, true);
            yield this.setObjectNotExistsAsync(`devices.${device.id}.samples`, {
                type: 'channel',
                native: {},
                common: {
                    name: 'Sample values'
                }
            });
        });
    }
    updateSamples() {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield this.getDevicesAsync();
            for (const device of devices) {
                const type = (_a = (yield this.getStateAsync(`${device._id}.type`))) === null || _a === void 0 ? void 0 : _a.val;
                const active = (_b = (yield this.getStateAsync(`${device._id}.segment.active`))) === null || _b === void 0 ? void 0 : _b.val;
                if (active && !EXCLUDED_TYPES.includes(type !== null && type !== void 0 ? type : 'UNKNOWN')) {
                    this.log.debug(`Update device samples: ${device._id}`);
                    yield this.updateDeviceSamples(device._id);
                }
                else {
                    this.log.debug(`Device ${device._id} is excluded`);
                }
            }
        });
    }
    updateDeviceSamples(deviceId) {
        var _a, _b;
        return __awaiter(this, void 0, void 0, function* () {
            const deviceSerial = (_a = (yield this.getStateAsync(`${deviceId}.id`))) === null || _a === void 0 ? void 0 : _a.val;
            const resp = yield axios_1.default.get(`${API_BASE}/v1/devices/${deviceSerial}/latest-samples`, {
                headers: {
                    Authorization: `Bearer ${yield this.getToken()}`
                }
            });
            if (resp.status !== 200) {
                return;
            }
            const data = resp.data.data;
            const ts = ((_b = data.time) !== null && _b !== void 0 ? _b : (Date.now() / 1000)) * 1000;
            if (data.battery) {
                yield this.setStateAsync(`${deviceId}.battery`, {
                    val: data.battery,
                    ack: true,
                    ts,
                    lc: ts,
                    from: this.namespace
                }, true);
            }
            if (data.relayDeviceType) {
                yield this.setStateAsync(`${deviceId}.relay_device_type`, {
                    val: data.relayDeviceType,
                    ack: true,
                    ts,
                    lc: ts,
                    from: this.namespace
                }, true);
            }
            for (const sampleKey in data) {
                if (!EXCLUDED_SAMPLES.includes(sampleKey)) {
                    yield this.setObjectNotExistsAsync(`${deviceId}.samples.${sampleKey}`, {
                        type: 'state',
                        native: {},
                        common: {
                            name: sampleKey,
                            type: 'number',
                            desc: sampleKey,
                            read: true,
                            write: false,
                            role: 'value'
                        }
                    });
                    yield this.setStateAsync(`${deviceId}.samples.${sampleKey}`, {
                        val: data[sampleKey],
                        ack: true,
                        ts,
                        lc: ts,
                        from: this.namespace
                    }, true);
                }
            }
        });
    }
    updateTimer() {
        this.log.debug('Update samples');
        this.updateSamples().then(() => {
            this.log.debug('Sample update finished');
        });
    }
    /**
     * Is called when databases are connected and adapter received configuration.
     */
    onReady() {
        return __awaiter(this, void 0, void 0, function* () {
            // Reset the connection indicator during startup
            this.setState('info.connection', false, true);
            if (!(yield this.authenticate())) {
                return;
            }
            yield this.syncDevices();
            yield this.updateSamples();
            setInterval(this.updateTimer, this.config.update_interval * 60000);
        });
    }
    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    onUnload(callback) {
        try {
            if (this.updateTimerId) {
                clearInterval(this.updateTimerId);
            }
            callback();
        }
        catch (e) {
            callback();
        }
    }
}
if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options) => new AirthingsCloud(options);
}
else {
    // otherwise start the instance directly
    (() => new AirthingsCloud())();
}
