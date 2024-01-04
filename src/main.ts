/*
 * Created with @iobroker/create-adapter v1.26.3
 */

// The adapter-core module gives you access to the core ioBroker functions
// you need to create an adapter
import * as utils from '@iobroker/adapter-core';

const axios = require('axios');

const API_BASE: string = 'https://ext-api.airthings.com';

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

  public constructor(options: Partial<utils.AdapterOptions> = {}) {
    super({
            ...options,
            name: 'airthings-cloud',
          });
    this.on('ready', this.onReady.bind(this));
    //this.on('stateChange', this.onStateChange.bind(this));
    // this.on('objectChange', this.onObjectChange.bind(this));
    // this.on('message', this.onMessage.bind(this));
    this.on('unload', this.onUnload.bind(this));
  }

  private async authenticate(): Promise<boolean> {
    this.log.info('Authenticating with Client ID: ' + this.config.client_id);

    const resp = await axios.post('https://accounts-api.airthings.com/v1/token', {
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
    } else {
      this.setState('info.connection', false, true);

      this.log.error(`Authentication failed: ${JSON.stringify(resp.data)}`);

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
    const resp = await axios.get(`${API_BASE}/v1/devices`, {
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

    for (let device of resp.data.devices) {
      this.log.debug(`Device: ${JSON.stringify(device)}`);

      await this.createDevice(device);
    }
  }

  private async createDevice(device: any): Promise<void> {
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
        role: 'value'
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

  /**
   * Is called when databases are connected and adapter received configuration.
   */
  private async onReady(): Promise<void> {
    // Reset the connection indicator during startup
    this.setState('info.connection', false, true);

    if (!await this.authenticate()) {
      return;
    }

    await this.syncDevices();
  }

  /**
   * Is called when adapter shuts down - callback has to be called under any circumstances!
   */
  private onUnload(callback: () => void): void {
    try {
      // Here you must clear all timeouts or intervals that may still be active
      // clearTimeout(timeout1);
      // clearTimeout(timeout2);
      // ...
      // clearInterval(interval1);

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
