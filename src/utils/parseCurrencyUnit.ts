import { BigNumber } from "bignumber.js";

const parseCurrencyUnit = (magnitude: number, valueString: string) => {
  const str = valueString.replace(/,/g, ".");
  const value = new BigNumber(str);
  if (value.isNaN()) return new BigNumber(0);
  return value.times(new BigNumber(10).pow(magnitude)).integerValue();
};

export default parseCurrencyUnit;
