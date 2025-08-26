export const contracts = [
  {
    address: '0xYourContractAddress',
    abi: [
      {
        "anonymous": false,
        "inputs": [
          { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
          { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
          { "indexed": false, "internalType": "uint256", "name": "amount", "type": "uint256" },
          { "indexed": false, "internalType": "uint256", "name": "fee", "type": "uint256" },
        ],
        "name": "Transfer",
        "type": "event"
      }
    ],
    name: 'MyToken',
    startBlock: 0,
    events: ['Transferred']
  }
];

export function getContractByAddress(address) {
  return contracts.find(contract => 
    contract.address.toLowerCase() === address.toLowerCase()
  );
}

export function getAllContracts() {
  return contracts;
}