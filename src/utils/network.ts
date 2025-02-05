import { join } from 'path';
import detectPort from 'detect-port';
import { BitcoinNode, LndNode, LndVersion, Network, Status } from 'types';
import { networksPath } from './config';
import { range } from './numbers';

// long path games
const getFilePaths = (name: string, network: Network) => {
  // add polar prefix to the name. ex: polar-n1-lnd-1
  const prefix = (name: string) => `polar-n${network.id}-${name}`;
  // returns /volumes/lnd/polar-n1-lnd-1
  const lndDataPath = (name: string) =>
    join(network.path, 'volumes', 'lnd', prefix(name));
  // returns /volumes/lnd/polar-n1-lnd-1/tls.cert
  const lndCertPath = (name: string) => join(lndDataPath(name), 'tls.cert');
  // returns /data/chain/bitcoin/regtest
  const macaroonPath = join('data', 'chain', 'bitcoin', 'regtest');
  // returns /volumes/lnd/polar-n1-lnd-1/data/chain/bitcoin/regtest/admin.amacaroon
  const lndMacaroonPath = (name: string, macaroon: string) =>
    join(lndDataPath(name), macaroonPath, `${macaroon}.macaroon`);

  return {
    tlsCert: lndCertPath(name),
    adminMacaroon: lndMacaroonPath(name, 'admin'),
    readonlyMacaroon: lndMacaroonPath(name, 'readonly'),
  };
};

export const createLndNetworkNode = (
  network: Network,
  version: LndVersion,
  status: Status,
): LndNode => {
  const index = network.nodes.lightning.length;
  const name = `lnd-${index + 1}`;
  return {
    id: index,
    networkId: network.id,
    name: name,
    type: 'lightning',
    implementation: 'LND',
    version,
    status,
    backendName: network.nodes.bitcoin[0].name,
    paths: getFilePaths(name, network),
    ports: {
      rest: 8081 + index,
      grpc: 10001 + index,
    },
  };
};

export const createBitcoindNetworkNode = (
  network: Network,
  status: Status,
): BitcoinNode => {
  const index = network.nodes.bitcoin.length;
  const name = `bitcoind-${index + 1}`;
  return {
    id: index,
    networkId: network.id,
    name: name,
    type: 'bitcoin',
    implementation: 'bitcoind',
    version: '0.18.1',
    status,
    ports: { rpc: 18443 },
  };
};

export const createNetwork = (config: {
  id: number;
  name: string;
  lndNodes: number;
  bitcoindNodes: number;
  status?: Status;
}): Network => {
  const { id, name, lndNodes, bitcoindNodes } = config;
  // need explicit undefined check because Status.Starting is 0
  const status = config.status !== undefined ? config.status : Status.Stopped;

  const network: Network = {
    id: id,
    name,
    status,
    path: join(networksPath, id.toString()),
    nodes: {
      bitcoin: [],
      lightning: [],
    },
  };

  range(bitcoindNodes).forEach(() => {
    network.nodes.bitcoin.push(createBitcoindNetworkNode(network, status));
  });

  range(lndNodes).forEach(() => {
    network.nodes.lightning.push(
      createLndNetworkNode(network, LndVersion.latest, status),
    );
  });

  return network;
};

/**
 * Checks a range of port numbers to see if they are open on the current operating system.
 * Returns a new array of port numbers that are confirmed available
 * @param requestedPorts the ports to check for availability. ** must be in ascending order
 *
 * @example if port 10002 is in use
 * getOpenPortRange([10001, 10002, 10003]) -> [10001, 10004, 10005]
 */
export const getOpenPortRange = async (requestedPorts: number[]): Promise<number[]> => {
  const openPorts: number[] = [];

  for (let port of requestedPorts) {
    if (openPorts.length) {
      // adjust to check after the previous open port if necessary, since the
      const lastOpenPort = openPorts[openPorts.length - 1];
      if (port <= lastOpenPort) {
        port = lastOpenPort + 1;
      }
    }
    const openPort = await detectPort(port);
    openPorts.push(openPort);
  }
  return openPorts;
};

/**
 * Ensures the ports specified on the nodes are available on the host OS.
 * This fuction mutates the network object supplied
 * @param network the network with nodes to verify ports of
 */
export const ensureOpenPorts = async (network: Network): Promise<boolean> => {
  let updated = false;

  // filter out nodes that are already started since their ports are in use by themselves
  const bitcoin = network.nodes.bitcoin.filter(n => n.status !== Status.Started);
  if (bitcoin.length) {
    const existingPorts = bitcoin.map(n => n.ports.rpc);
    const openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => (bitcoin[index].ports.rpc = port));
      updated = true;
    }
  }

  // filter out nodes that are already started since their ports are in use by themselves
  const lightning = network.nodes.lightning.filter(n => n.status !== Status.Started);
  if (lightning.length) {
    let existingPorts = lightning.map(n => n.ports.grpc);
    let openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => (lightning[index].ports.grpc = port));
      updated = true;
    }

    existingPorts = lightning.map(n => n.ports.rest);
    openPorts = await getOpenPortRange(existingPorts);
    if (openPorts.join() !== existingPorts.join()) {
      openPorts.forEach((port, index) => (lightning[index].ports.rest = port));
      updated = true;
    }
  }

  return updated;
};
