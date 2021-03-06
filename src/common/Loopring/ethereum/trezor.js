export async function getAddress(path) {
  path = path || "m/44'/60'/0'/0/0";
  return new Promise((resolve) => {
    window.TrezorConnect.ethereumGetAddress(path, function (result) {
      if (result.success) {
        resolve(result.address)
      } else {
        throw new Error(result.error);
      }
    });
  })
}

export async function trezorSign({path, hash}) {
  path = path || "m/44'/60'/0'/0/0";
  return new Promise((resolve) => {
    window.TrezorConnect.ethereumSignMessage(path, hash, function (result) {
      if (result.success) {
        console.log('Address:',result.address);
        console.log('Result:',result);
        resolve(result.signature)
      } else {
        console.error('Error:', result.error); // error message
      }
    });
  })
}



