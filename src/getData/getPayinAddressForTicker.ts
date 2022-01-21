import testPayinAddress from "../../testPayinAddress.json";

const getPayinAddressForTicker = (ticker: string): string => {
  // @ts-ignore
  const payinAddress = testPayinAddress?.[ticker];

  if (!payinAddress) {
    throw new Error(`No payinAddress found for ticker '${ticker}'`);
  }

  return payinAddress;
};

export default getPayinAddressForTicker;
