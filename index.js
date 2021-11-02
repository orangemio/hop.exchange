const fs = require('fs');
const readline = require('readline');
const axios = require('axios');
const Web3 = require("web3")
const Tx = require('ethereumjs-tx');
const { reject } = require('lodash');
const bridgeABI = require('./bridge.json');


const infura = `https://polygon-mainnet.infura.io/v3/babe53e1426743b292601e347893b4da`
const web3 = new Web3(new Web3.providers.HttpProvider(infura))

const defaultGasPrice = web3.utils.toBN('35000000000') //WEI 35Gwei
const defaultSendETH = web3.utils.toBN('2000000000000000000') //2 Matic, 单向桥，默认有去无回
const destnationChainId = 100 // xDai
const fromChainId = 137 //Matic
const defaultGasLimit = 300000
const bonderFee = web3.utils.toBN('600000000000000000') //0.6 Matic //桥额外手续费


const filePath = `./20211103025050_addresses_with_keys.txt`
const bridgeAddress = '0x884d1aa15f9957e1aeaa86a82a72e49bc2bfcbe3'

let bridge = new web3.eth.Contract(bridgeABI, bridgeAddress);

const accounts = [];
const accountsWithKey = [];

async function processLineByLine() {
    const fileStream = fs.createReadStream(filePath);

    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        const arr = line.split( ',' );
        accounts.push(arr[0]);
        accountsWithKey.push({
        address:arr[0],
        privateKey:arr[1]
        })
    }
}


async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array)
    }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function  main(){

    await processLineByLine();

    asyncForEach(accountsWithKey, async ({address, privateKey}, i) => {
            await sleep(20000);
            const data = await bridge.methods.swapAndSend(
                destnationChainId, 
                address,     // Address
                defaultSendETH, //Amount
                bonderFee,   // bonderFee
                0,           //amountOutMin
                Math.floor( (Date.now() + ( 3600 * 1000 * 24)) / 1000), //deadline
                0,           //destinationAmountOutMin       
                Math.floor( (Date.now() + ( 3600 * 1000 * 24)) / 1000), // destinationDeadline 
            ).encodeABI()
            
            const tx = {}
            tx.data = data
            tx.to = bridgeAddress
            tx.nonce = await web3.eth.getTransactionCount(address)
            tx.gasPrice = web3.utils.toHex(defaultGasPrice)
            tx.gasLimit = web3.utils.toHex(defaultGasLimit)
            tx.value = web3.utils.toHex(defaultSendETH)
            tx.chainId = fromChainId
            const _tx = new Tx(tx)
            _tx.sign(Buffer.from(privateKey,'hex'))
            const serializedTx = _tx.serialize()
            
            try{
                await web3.eth.sendSignedTransaction(`0x${serializedTx.toString('hex')}`)
                console.log(`交易完成: ${address} `)
            }catch(e){
                console.log(`Error: ${address}, ${e}`)
            }

        }
    )
}

main()

  

