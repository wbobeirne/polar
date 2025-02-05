import { IChart } from '@mrblenny/react-flow-chart';
import * as LND from '@radar/lnrpc';
import { ChainInfo, WalletInfo } from 'bitcoin-core';

export interface LocalConfig {
  fallbackLng: string;
  languages: {
    [key: string]: string;
  };
}

export enum Status {
  Starting,
  Started,
  Stopping,
  Stopped,
  Error,
}

export interface CommonNode {
  // TODO: change id to a uuid
  id: number;
  networkId: number;
  name: string;
  type: 'bitcoin' | 'lightning';
  version: string;
  status: Status;
}

export interface BitcoinNode extends CommonNode {
  type: 'bitcoin';
  implementation: 'bitcoind' | 'btcd';
  ports: {
    rpc: number;
  };
}

export interface LightningNode extends CommonNode {
  type: 'lightning';
  implementation: 'LND' | 'c-lightning' | 'eclair';
  backendName: string;
}

export interface LndNode extends LightningNode {
  paths: {
    tlsCert: string;
    adminMacaroon: string;
    readonlyMacaroon: string;
  };
  ports: {
    rest: number;
    grpc: number;
  };
}

export enum LndVersion {
  latest = '0.8.0-beta',
  '0.8.0-beta' = '0.8.0-beta',
  '0.7.1-beta' = '0.7.1-beta',
}

export interface Network {
  id: number;
  name: string;
  status: Status;
  path: string;
  nodes: {
    bitcoin: BitcoinNode[];
    lightning: LndNode[];
  };
}

export interface DockerLibrary {
  saveComposeFile: (network: Network) => Promise<void>;
  start: (network: Network) => Promise<void>;
  stop: (network: Network) => Promise<void>;
  saveNetworks: (networks: NetworksFile) => Promise<void>;
  loadNetworks: () => Promise<NetworksFile>;
}

export interface BitcoindLibrary {
  waitUntilOnline: (port?: number) => Promise<boolean>;
  getBlockchainInfo: (port?: number) => Promise<ChainInfo>;
  getWalletInfo: (port?: number) => Promise<WalletInfo>;
  mine: (numBlocks: number, port?: number) => Promise<string[]>;
  sendFunds: (node: BitcoinNode, addr: string, amount: number) => Promise<string>;
}

export interface LndLibrary {
  waitUntilOnline(node: LndNode): Promise<boolean>;
  getInfo: (node: LndNode) => Promise<LND.GetInfoResponse>;
  getWalletBalance: (node: LndNode) => Promise<LND.WalletBalanceResponse>;
  getNewAddress: (node: LndNode) => Promise<LND.NewAddressResponse>;
  openChannel: (from: LndNode, to: LndNode, amount: string) => Promise<LND.ChannelPoint>;
  listChannels: (node: LndNode) => Promise<LND.ListChannelsResponse>;
  pendingChannels: (node: LndNode) => Promise<LND.PendingChannelsResponse>;
}

export interface StoreInjections {
  dockerService: DockerLibrary;
  bitcoindService: BitcoindLibrary;
  lndService: LndLibrary;
}

export interface NetworksFile {
  networks: Network[];
  charts: Record<number, IChart>;
}
