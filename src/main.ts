/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';

import axios from 'axios';

const API_BASE: string = 'https://ext-api.airthings.com';

const EXCLUDED_TYPES: string[] = [
    'HUB',
    'HOME',
    'PRO',
    'CLOUDBERRY',
    'AGGREGATED_GROUP',
    'ZONE_GROUP',
    'AP_1',
    'UNKNOWN'
];

const EXCLUDED_SAMPLES: string[] = [
    'time',
    'battery',
    'relayDeviceType',
    'rssi'
];

// Load your modules here, e.g.:
// import * as fs from "fs";

// Augment the adapter.config object with the actual types
// TODO: delete this in the next version
declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace ioBroker {
        interface AdapterConfig {
            client_id: string;
            client_secret: string;
            update_interval: number;
        }
    }
}

class AirthingsCloud extends utils.Adapter {

    token?: string;
    tokenExpiration?: number;

    updateTimerId?: ioBroker.Interval;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({...options, name: 'airthings-cloud'});
        this.on('ready', this.onReady.bind(this));
        //this.on('stateChange', this.onStateChange.bind(this));
        // this.on('objectChange', this.onObjectChange.bind(this));
        // this.on('message', this.onMessage.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async authenticate(): Promise<boolean> {
        this.log.info('Authenticating with Client ID: ' + this.config.client_id);

        try {
            const resp = await axios.post('https://accounts-api.airthings.com/v1/token', {
                'grant_type': 'client_credentials',
                'client_id': this.config.client_id,
                'client_secret': this.config.client_secret,
                'scope': ['read:device:current_values']
            });

            if (resp.status === 200) {
                //this.setState('info.connection', true, true);

                this.token = resp.data.access_token;
                this.tokenExpiration = Date.now() + (resp.data.expires_in * 1000);

                this.log.info('Authentication successful');

                return true;
            } else {
                //this.setState('info.connection', false, true);

                this.log.error(`Authentication failed: ${JSON.stringify(resp.data)}`);

                if (this.updateTimerId) {
                    clearInterval(this.updateTimerId);
                }

                return false;
            }
        } catch (ex) {
            this.log.error('Failed to authenticate ' + ex);

            return false;
        }
    }

    private async getToken(): Promise<string> {
        if (!this.tokenExpiration || !this.token || Date.now() > (this.tokenExpiration - 60_000)) {
            await this.authenticate();
        }

        return this.token!;
    }

    private async syncDevices(): Promise<void> {
        const resp = await axios.get(`${API_BASE}/v1/devices?showInactive=true`, {
            headers: {
                Authorization: `Bearer ${await this.getToken()}`
            }
        });

        // @TODO Remove deleted devices

        await this.setObjectNotExistsAsync('devices', {
            type: 'folder',
            native: {},
            common: {
                name: 'Devices'
            }
        });

        this.log.info(`Syncing ${resp.data.devices.length} devices`);

        for (const device of resp.data.devices) {
            this.log.debug(`Device: ${JSON.stringify(device)}`);

            await this.createAirthingDevice(device);
        }
    }

    private async createAirthingDevice(device: any): Promise<void> {
        await this.setObjectNotExistsAsync(`devices.${device.id}`, {
            type: 'device',
            native: {},
            common: {
                name: device.segment.name,
            }
        });

        await this.setObjectNotExistsAsync(`devices.${device.id}.id`, {
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
        await this.setStateAsync(`devices.${device.id}.id`, device.id, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.type`, {
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
        await this.setStateAsync(`devices.${device.id}.type`, device.deviceType, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.name`, {
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
        await this.setStateAsync(`devices.${device.id}.name`, device.productName, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.sensors`, {
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
        await this.setStateAsync(`devices.${device.id}.sensors`, device.sensors, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.battery`, {
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

        await this.setObjectNotExistsAsync(`devices.${device.id}.relay_device_type`, {
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

        await this.setObjectNotExistsAsync(`devices.${device.id}.rssi`, {
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

        await this.setObjectNotExistsAsync(`devices.${device.id}.segment`, {
            type: 'channel',
            native: {},
            common: {
                name: 'Segment'
            }
        });

        await this.setObjectNotExistsAsync(`devices.${device.id}.segment.id`, {
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
        await this.setStateAsync(`devices.${device.id}.segment.id`, device.segment.id, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.segment.name`, {
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
        await this.setStateAsync(`devices.${device.id}.segment.name`, device.segment.name, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.segment.started`, {
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
        await this.setStateAsync(`devices.${device.id}.segment.started`, device.segment.started, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.segment.active`, {
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
        await this.setStateAsync(`devices.${device.id}.segment.active`, device.segment.active, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.location`, {
            type: 'channel',
            native: {},
            common: {
                name: 'Location'
            }
        });

        await this.setObjectNotExistsAsync(`devices.${device.id}.location.id`, {
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
        await this.setStateAsync(`devices.${device.id}.location.id`, device.location.id, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.location.name`, {
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
        await this.setStateAsync(`devices.${device.id}.location.name`, device.location.name, true);

        await this.setObjectNotExistsAsync(`devices.${device.id}.samples`, {
            type: 'channel',
            native: {},
            common: {
                name: 'Sample values'
            }
        });
    }

    private async updateSamples(): Promise<void> {
        const devices = await this.getDevicesAsync();

        for (const device of devices) {
            try {
                const type = (await this.getStateAsync(`${device._id}.type`))?.val as string;
                const active = (await this.getStateAsync(`${device._id}.segment.active`))?.val;

                if (active && !EXCLUDED_TYPES.includes(type ?? 'UNKNOWN')) {
                    this.log.debug(`Update device samples: ${device._id}`);

                    await this.updateDeviceSamples(device._id);
                } else {
                    this.log.debug(`Device ${device._id} is excluded`);
                }
            } catch (ex) {
                this.log.error(`Failed to update device ${device._id} ` + ex);
            }
        }
    }

    private async updateDeviceSamples(deviceId: string): Promise<void> {
        const deviceSerial = (await this.getStateAsync(`${deviceId}.id`))?.val as string;

        const resp = await axios.get(`${API_BASE}/v1/devices/${deviceSerial}/latest-samples`, {
            headers: {
                Authorization: `Bearer ${await this.getToken()}`
            }
        });

        if (resp.status !== 200) {
            return;
        }

        const data = resp.data.data;
        const ts = (data.time ?? (Date.now() / 1_000)) * 1_000;

        if (data.battery) {
            await this.setStateAsync(`${deviceId}.battery`, {
                val: data.battery,
                ack: true,
                ts,
                lc: ts,
                from: this.namespace
            }, true);
        }

        if (data.relayDeviceType) {
            await this.setStateAsync(`${deviceId}.relay_device_type`, {
                val: data.relayDeviceType,
                ack: true,
                ts,
                lc: ts,
                from: this.namespace
            }, true);
        }

        if (data.rssi) {
            await this.setStateAsync(`${deviceId}.rssi`, {
                val: data.rssi,
                ack: true,
                ts,
                lc: ts,
                from: this.namespace
            }, true);
        }

        for (const sampleKey in data) {
            if (!EXCLUDED_SAMPLES.includes(sampleKey)) {
                await this.setObjectNotExistsAsync(`${deviceId}.samples.${sampleKey}`, {
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

                await this.setStateAsync(`${deviceId}.samples.${sampleKey}`, {
                    val: data[sampleKey],
                    ack: true,
                    ts,
                    lc: ts,
                    from: this.namespace
                }, true);
            }
        }
    }

    private updateTimer(): void {
        this.log.debug('Update samples');

        try {
            this.updateSamples().then(() => {
                this.log.debug('Sample update finished');
            });
        } catch (ex) {
            this.log.error('Failed to update samples ' + ex);
        }
    }

    /**
     * Is called when databases are connected and adapter received configuration.
     */
    private async onReady(): Promise<void> {
        // Reset the connection indicator during startup
        //this.setState('info.connection', false, true);
        this.setState('info.connection', true, true);

        if (!await this.authenticate()) {
            return;
        }

        try {
            await this.syncDevices();

            await this.updateSamples();
        } catch (ex) {
            this.log.error('Error on initial sync ' + ex);
        }

        this.updateTimerId = this.setInterval(() => this.updateTimer(), this.config.update_interval * 60_000);
    }

    /**
     * Is called when adapter shuts down - callback has to be called under any circumstances!
     */
    private onUnload(callback: () => void): void {
        try {
            if (this.updateTimerId) {
                this.clearInterval(this.updateTimerId);
            }

            this.setState('info.connection', false, true);

            callback();
        } catch (e) {
            callback();
        }
    }
}

if (module.parent) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new AirthingsCloud(options);
} else {
    // otherwise start the instance directly
    (() => new AirthingsCloud())();
}
