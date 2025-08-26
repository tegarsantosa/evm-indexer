import { ethers } from 'ethers';
import { EventEmitter } from 'events';

export class ContractListener extends EventEmitter {
  constructor(provider, contractConfig) {
    super();
    this.provider = provider;
    this.contractConfig = contractConfig;
    this.contract = new ethers.Contract(
      contractConfig.address,
      contractConfig.abi,
      provider
    );
    this.eventFilters = new Map();
    this.listeners = [];
    this.setupEventFilters();
  }

  setupEventFilters() {
    const eventNames = this.contractConfig.events || [];

    if (eventNames.length === 0) {
      Object.keys(this.contract.interface.events).forEach(eventName => {
        const filter = this.contract.filters[eventName]();
        this.eventFilters.set(eventName, filter);
      });
    } else {
      eventNames.forEach(eventName => {
        if (this.contract.filters[eventName]) {
          const filter = this.contract.filters[eventName]();
          this.eventFilters.set(eventName, filter);
        }
      });
    }
  }

  async getHistoricalEvents(fromBlock, toBlock) {
    const events = [];

    for (const [eventName, filter] of this.eventFilters) {
      try {
        const eventLogs = await this.contract.queryFilter(filter, fromBlock, toBlock);
        events.push(...eventLogs);
      } catch (error) {
        throw new Error(`Failed to query ${eventName} events: ${error.message}`);
      }
    }

    return events.sort((a, b) => {
      if (a.blockNumber !== b.blockNumber) {
        return a.blockNumber - b.blockNumber;
      }
      return a.logIndex - b.logIndex;
    });
  }

  startListening() {
    for (const [eventName, filter] of this.eventFilters) {
      const listener = (...args) => {
        const event = args[args.length - 1];
        this.emit('event', event);
      };

      this.contract.on(filter, listener);
      this.listeners.push(() => this.contract.off(filter, listener));
    }
  }

  stopListening() {
    this.listeners.forEach(cleanup => cleanup());
    this.listeners = [];
  }

  getAddress() {
    return this.contractConfig.address;
  }

  getName() {
    return this.contractConfig.name;
  }

  getEvents() {
    return this.contractConfig.events;
  }

  getConfig() {
    return this.contractConfig;
  }
}